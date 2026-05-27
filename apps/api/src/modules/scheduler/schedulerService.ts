import type { FastifyBaseLogger } from "fastify";
import type { AuditLog } from "../audit/auditLog.js";
import type { AlertService } from "../alerts/alertService.js";
import type { BackupStore } from "../backups/backupStore.js";
import type { DatabaseStore } from "../databases/databaseStore.js";
import type { MonitoringService } from "../monitoring/monitoringService.js";
import type { NotificationService } from "../notifications/notificationService.js";
import type { TaskStore } from "../tasks/taskStore.js";

export class SchedulerService {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly taskStore: TaskStore,
    private readonly backupStore: BackupStore,
    private readonly databaseStore: DatabaseStore,
    private readonly alertService: AlertService,
    private readonly monitoringService: MonitoringService,
    private readonly notificationService: NotificationService,
    private readonly auditLog: AuditLog,
    private readonly logger: FastifyBaseLogger
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
      await this.monitoringService.recordLocalSample(now);
      const alerts = await this.alertService.check(now);
      const deliveries = await this.notificationService.notifyAlerts(alerts);
      for (const alert of alerts) {
        await this.auditLog.append({ actor: "scheduler", action: `alert.${alert.type}`, target: alert.target, status: alert.level === "critical" ? "error" : "success", detail: alert.message });
      }
      for (const delivery of deliveries) {
        await this.auditLog.append({ actor: "scheduler", action: "notification.send", target: delivery.channelName, status: delivery.status === "success" ? "success" : "error", detail: delivery.error });
      }
    } catch (error) {
      this.logger.error(error, "scheduler tick failed");
    } finally {
      this.running = false;
    }
  }
}
