import type { FastifyBaseLogger } from "fastify";
import type { AuditLog } from "../audit/auditLog.js";
import type { BackupStore } from "../backups/backupStore.js";
import type { TaskStore } from "../tasks/taskStore.js";

export class SchedulerService {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly taskStore: TaskStore,
    private readonly backupStore: BackupStore,
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
    } catch (error) {
      this.logger.error(error, "scheduler tick failed");
    } finally {
      this.running = false;
    }
  }
}
