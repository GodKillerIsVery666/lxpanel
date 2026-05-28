import type { FastifyBaseLogger } from "fastify";
import type { AuditLog } from "../audit/auditLog.js";
import type { AlertService } from "../alerts/alertService.js";
import type { BackupStore } from "../backups/backupStore.js";
import type { DatabaseStore } from "../databases/databaseStore.js";
import type { MonitoringService } from "../monitoring/monitoringService.js";
import type { NotificationService } from "../notifications/notificationService.js";
import type { PlatformStore } from "../platform/platformStore.js";
import type { TaskStore } from "../tasks/taskStore.js";

/** 调度器执行审计保留的最小间隔（1 小时），避免每次 tick 都扫描 */
const auditRetentionCooldownMs = 3_600_000;

export class SchedulerService {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private lastAuditRetentionTick = 0;

  constructor(
    private readonly taskStore: TaskStore,
    private readonly backupStore: BackupStore,
    private readonly databaseStore: DatabaseStore,
    private readonly alertService: AlertService,
    private readonly monitoringService: MonitoringService,
    private readonly notificationService: NotificationService,
    private readonly auditLog: AuditLog,
    private readonly logger: FastifyBaseLogger,
    private readonly platformStore?: PlatformStore
  ) {}

  start(intervalMs = 30_000): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = undefined;
  }

  async tick(now = new Date()): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const runs = await this.taskStore.runDueScheduledTasks(now);
      for (const run of runs) {
        await this.auditLog.append({ actor: "scheduler", action: "task.run", target: run.taskName, status: run.status === "success" ? "success" : "error" });
      }
      const backup = await this.backupStore.runDueBackup(now);
      if (backup) {
        await this.auditLog.append({ actor: "scheduler", action: "backup.create", target: backup.fileName, status: "success" });
      }
      const databaseBackups = await this.databaseStore.runDueScheduledBackups(now);
      for (const result of databaseBackups) {
        await this.auditLog.append({ actor: "scheduler", action: "database.backup.scheduled", target: result.connectionId, status: result.status === "success" ? "success" : "error", detail: result.error ?? result.outputTail });
      }
      const cleanup = await this.databaseStore.cleanupExpiredBackups(now);
      if (cleanup.removed > 0 || cleanup.issues.length > 0) {
        await this.auditLog.append({ actor: "scheduler", action: "database.backup.cleanup", target: "database-backups", status: cleanup.issues.length > 0 ? "error" : "success", detail: `removed=${cleanup.removed};retained=${cleanup.retained}` });
      }
      await this.monitoringService.recordLocalSample(now);
      const alerts = await this.alertService.check(now);
      const deliveries = await this.notificationService.notifyAlerts(alerts);
      for (const alert of alerts) {
        await this.auditLog.append({ actor: "scheduler", action: `alert.${alert.type}`, target: alert.target, status: alert.level === "critical" ? "error" : "success", detail: alert.message });
      }
      for (const delivery of deliveries) {
        await this.auditLog.append({ actor: "scheduler", action: "notification.send", target: delivery.channelName, status: delivery.status === "success" ? "success" : "error", detail: delivery.error });
      }
      // 定时执行审计保留清理（冷却期内跳过）
      if (this.platformStore && now.getTime() - this.lastAuditRetentionTick >= auditRetentionCooldownMs) {
        this.lastAuditRetentionTick = now.getTime();
        await this.runAuditRetentionTick(now);
      }
    } catch (error) {
      this.logger.error(error, "scheduler tick failed");
    } finally {
      this.running = false;
    }
  }

  private async runAuditRetentionTick(now: Date): Promise<void> {
    try {
      const policies = await this.platformStore!.auditRetentionPolicies();
      const enabledPolicies = policies.filter((p) => p.enabled && !p.legalHold);
      if (enabledPolicies.length === 0) {
        return;
      }
      for (const policy of enabledPolicies) {
        const evaluation = await this.platformStore!.evaluateAuditRetention({
          workspace: policy.workspace,
          eventType: policy.eventType,
          eventCount: 5000
        });
        if (evaluation.legalHold) {
          continue;
        }
        const events = await this.auditLog.list({ limit: 5000, ...(policy.eventType !== "*" ? { action: policy.eventType } : {}) });
        const eligibleEvents = events.filter((e) => {
          const eventTime = new Date(e.time).getTime();
          return now.getTime() - eventTime > evaluation.retainDays * 86_400_000;
        });
        if (eligibleEvents.length === 0) {
          continue;
        }
        // 调度器直接归档 + 清理（不经过审批）
        if (evaluation.archiveBeforeDelete) {
          await this.auditLog.exportSignedPackage({ format: "jsonl", ...(policy.eventType !== "*" ? { action: policy.eventType } : {}) }).catch(() => undefined);
        }
        const pruneResult = await this.auditLog.prune(evaluation.retainDays);
        await this.auditLog.append({
          actor: "scheduler",
          action: "platform.audit_retention.execute",
          target: `${policy.workspace}:${policy.eventType}`,
          status: "success",
          detail: `scheduled;removed=${pruneResult.removed};remaining=${pruneResult.remaining};retainDays=${evaluation.retainDays}`
        });
      }
    } catch (error) {
      this.logger.warn({ err: error }, "scheduled audit retention tick failed");
    }
  }
}
