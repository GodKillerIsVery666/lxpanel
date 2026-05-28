import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import type { AppConfig } from "./config/env.js";
import { loadConfig } from "./config/env.js";
import type { StateStore } from "./lib/stateStore.js";
import { registerIpAllowlist } from "./middleware/ipAllowlist.js";
import { registerSecurityHeaders } from "./middleware/securityHeaders.js";
import { registerStaticWeb } from "./middleware/staticWeb.js";
import { AuditLog } from "./modules/audit/auditLog.js";
import { registerAuditRoutes } from "./modules/audit/auditRoutes.js";
import { registerAlertRoutes } from "./modules/alerts/alertRoutes.js";
import { AlertService } from "./modules/alerts/alertService.js";
import { registerAppRoutes } from "./modules/apps/appRoutes.js";
import { AppStore } from "./modules/apps/appStore.js";
import { registerApprovalRoutes } from "./modules/approvals/approvalRoutes.js";
import { ApprovalStore } from "./modules/approvals/approvalStore.js";
import { registerAuthRoutes } from "./modules/auth/authRoutes.js";
import { AuthStore } from "./modules/auth/authStore.js";
import { BackupStore } from "./modules/backups/backupStore.js";
import { registerBackupRoutes } from "./modules/backups/backupRoutes.js";
import { registerConnectorRoutes } from "./modules/connectors/connectorRoutes.js";
import { ConnectorStore } from "./modules/connectors/connectorStore.js";
import { registerDatabaseRoutes } from "./modules/databases/databaseRoutes.js";
import { DatabaseStore } from "./modules/databases/databaseStore.js";
import { registerDocsRoutes } from "./modules/docs/docsRoutes.js";
import { registerDockerRoutes } from "./modules/docker/dockerRoutes.js";
import { registerFileRoutes } from "./modules/files/fileRoutes.js";
import { registerHealthRoutes } from "./modules/health/healthRoutes.js";
import { registerHostRoutes } from "./modules/hosts/hostRoutes.js";
import { HostService } from "./modules/hosts/hostService.js";
import { registerLogRoutes } from "./modules/logs/logRoutes.js";
import { registerMonitoringRoutes } from "./modules/monitoring/monitoringRoutes.js";
import { MonitoringService } from "./modules/monitoring/monitoringService.js";
import { registerNotificationRoutes } from "./modules/notifications/notificationRoutes.js";
import { NotificationService } from "./modules/notifications/notificationService.js";
import { registerPlatformRoutes } from "./modules/platform/platformRoutes.js";
import { PlatformStore } from "./modules/platform/platformStore.js";
import { SchedulerService } from "./modules/scheduler/schedulerService.js";
import { registerSecurityRoutes } from "./modules/security/securityRoutes.js";
import type { PanelState } from "./modules/state/panelState.js";
import { createPanelStateStore } from "./modules/state/stateStoreFactory.js";
import { registerSystemRoutes } from "./modules/system/systemRoutes.js";
import { TaskStore } from "./modules/tasks/taskStore.js";
import { registerTaskRoutes } from "./modules/tasks/taskRoutes.js";
import { registerUserRoutes } from "./modules/users/userRoutes.js";

export interface Services {
  config: AppConfig;
  stateStore: StateStore<PanelState>;
  authStore: AuthStore;
  connectorStore: ConnectorStore;
  taskStore: TaskStore;
  backupStore: BackupStore;
  alertService: AlertService;
  hostService: HostService;
  monitoringService: MonitoringService;
  notificationService: NotificationService;
  appStore: AppStore;
  databaseStore: DatabaseStore;
  platformStore: PlatformStore;
  approvalStore: ApprovalStore;
  auditLog: AuditLog;
}

export async function createServices(config: AppConfig): Promise<Services> {
  const stateStore = await createPanelStateStore(config);
  return {
    config,
    stateStore,
    authStore: new AuthStore(stateStore),
    connectorStore: new ConnectorStore(stateStore),
    taskStore: new TaskStore(stateStore, config.fileRoots),
    backupStore: new BackupStore(stateStore, config.dataDir, config.sessionSecret),
    alertService: new AlertService(stateStore),
    hostService: new HostService(stateStore),
    monitoringService: new MonitoringService(stateStore),
    notificationService: new NotificationService(stateStore, undefined, config.webhookAllowlist, config.sessionSecret),
    appStore: new AppStore(stateStore, config.dataDir),
    databaseStore: new DatabaseStore(stateStore, config.dataDir, config.sessionSecret),
    platformStore: new PlatformStore(stateStore),
    approvalStore: new ApprovalStore(stateStore),
    auditLog: new AuditLog(join(config.dataDir, "audit.jsonl"))
  };
}

export async function buildApp(config: AppConfig = loadConfig()): Promise<FastifyInstance> {
  const loggerConfig: Record<string, unknown> = { level: config.logLevel };
  // JSON 格式日志（默认）：结构化输出到 stdout，适用于 ELK/Loki
  if (config.logFormat === "text") {
    loggerConfig.transport = { target: "pino-pretty", options: { colorize: true } };
  }
  const app = Fastify({ logger: loggerConfig });
  const services = await createServices(config);
  const scheduler = new SchedulerService(services.taskStore, services.backupStore, services.databaseStore, services.alertService, services.monitoringService, services.notificationService, services.auditLog, app.log, services.platformStore);

  await app.register(cookie);
  await app.register(cors, { credentials: true, origin: config.allowedOrigins });
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  registerIpAllowlist(app, config);
  registerSecurityHeaders(app, config);

  app.setErrorHandler(async (error, request, reply) => {
    app.log.error(error);
    // 根据 Accept-Language 选择错误消息语言
    const lang = (request.headers["accept-language"] ?? "zh-CN").startsWith("en") ? "en" : "zh";
    const messages: Record<string, { validation: string; internal: string }> = {
      zh: { validation: "请求参数不合法。", internal: "服务内部错误。" },
      en: { validation: "Invalid request parameters.", internal: "Internal server error." }
    };
    const msg = messages[lang] ?? { validation: "请求参数不合法。", internal: "服务内部错误。" };
    if (error instanceof ZodError) {
      await reply.code(400).send({ message: msg.validation });
      return;
    }
    await reply.code(500).send({ message: msg.internal });
  });

  registerHealthRoutes(app, services);
  registerDocsRoutes(app, services);
  registerAuthRoutes(app, services);
  registerUserRoutes(app, services);
  registerSystemRoutes(app, services);
  registerHostRoutes(app, services);
  registerMonitoringRoutes(app, services);
  registerFileRoutes(app, services);
  registerLogRoutes(app, services);
  registerDockerRoutes(app, services);
  registerAppRoutes(app, services);
  registerDatabaseRoutes(app, services);
  registerPlatformRoutes(app, services);
  registerTaskRoutes(app, services);
  registerBackupRoutes(app, services);
  registerAlertRoutes(app, services);
  registerNotificationRoutes(app, services);
  registerConnectorRoutes(app, services);
  registerApprovalRoutes(app, services);
  registerAuditRoutes(app, services);
  registerSecurityRoutes(app, services);
  await registerStaticWeb(app, config);
  scheduler.start();
  app.addHook("onClose", () => {
    scheduler.stop();
    services.stateStore.close?.();
  });

  return app;
}

const currentFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ? resolve(process.argv[1]) : "";

if (entryFile === currentFile) {
  const config = loadConfig();
  const app = await buildApp(config);
  try {
    await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}
