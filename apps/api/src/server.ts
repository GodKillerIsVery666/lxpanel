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
import { JsonStore } from "./lib/jsonStore.js";
import { registerIpAllowlist } from "./middleware/ipAllowlist.js";
import { AuditLog } from "./modules/audit/auditLog.js";
import { registerAuditRoutes } from "./modules/audit/auditRoutes.js";
import { registerAuthRoutes } from "./modules/auth/authRoutes.js";
import { AuthStore } from "./modules/auth/authStore.js";
import { BackupStore } from "./modules/backups/backupStore.js";
import { registerBackupRoutes } from "./modules/backups/backupRoutes.js";
import { registerConnectorRoutes } from "./modules/connectors/connectorRoutes.js";
import { ConnectorStore } from "./modules/connectors/connectorStore.js";
import { registerDockerRoutes } from "./modules/docker/dockerRoutes.js";
import { registerFileRoutes } from "./modules/files/fileRoutes.js";
import { registerHealthRoutes } from "./modules/health/healthRoutes.js";
import { registerLogRoutes } from "./modules/logs/logRoutes.js";
import { registerSecurityRoutes } from "./modules/security/securityRoutes.js";
import { createInitialPanelState, type PanelState } from "./modules/state/panelState.js";
import { registerSystemRoutes } from "./modules/system/systemRoutes.js";
import { TaskStore } from "./modules/tasks/taskStore.js";
import { registerTaskRoutes } from "./modules/tasks/taskRoutes.js";
import { registerUserRoutes } from "./modules/users/userRoutes.js";

export interface Services {
  config: AppConfig;
  authStore: AuthStore;
  connectorStore: ConnectorStore;
  taskStore: TaskStore;
  backupStore: BackupStore;
  auditLog: AuditLog;
}

export function createServices(config: AppConfig): Services {
  const stateStore = new JsonStore<PanelState>(join(config.dataDir, "state.json"), createInitialPanelState);
  return {
    config,
    authStore: new AuthStore(stateStore),
    connectorStore: new ConnectorStore(stateStore),
    taskStore: new TaskStore(stateStore, config.fileRoots),
    backupStore: new BackupStore(stateStore, config.dataDir),
    auditLog: new AuditLog(join(config.dataDir, "audit.jsonl"))
  };
}

export async function buildApp(config: AppConfig = loadConfig()): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: config.logLevel } });
  const services = createServices(config);

  await app.register(cookie);
  await app.register(cors, { credentials: true, origin: config.allowedOrigins });
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  registerIpAllowlist(app, config);

  app.setErrorHandler(async (error, _request, reply) => {
    app.log.error(error);
    if (error instanceof ZodError) {
      await reply.code(400).send({ message: "请求参数不合法。" });
      return;
    }
    await reply.code(500).send({ message: "服务内部错误。" });
  });

  registerHealthRoutes(app, services);
  registerAuthRoutes(app, services);
  registerUserRoutes(app, services);
  registerSystemRoutes(app, services);
  registerFileRoutes(app, services);
  registerLogRoutes(app, services);
  registerDockerRoutes(app, services);
  registerTaskRoutes(app, services);
  registerBackupRoutes(app, services);
  registerConnectorRoutes(app, services);
  registerAuditRoutes(app, services);
  registerSecurityRoutes(app, services);

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
