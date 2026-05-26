import type { FastifyInstance } from "fastify";
import { BackupRequestSchema, BackupRestoreRequestSchema, UpdateBackupScheduleSchema } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { requireRole } from "../auth/authMiddleware.js";
import { sessionCookieName } from "../auth/authMiddleware.js";

export function registerBackupRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/backups", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { backups: await services.backupStore.listBackups(), schedule: await services.backupStore.getSchedule() };
  });

  app.post("/api/backups", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const backup = await services.backupStore.createBackup(user.username);
    await services.auditLog.append({ actor: user.username, action: "backup.create", target: backup.fileName, ip: request.ip, status: "success" });
    return { backup };
  });

  app.get<{ Querystring: { backupId?: string } }>("/api/backups/download", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = BackupRequestSchema.parse(request.query);
    const { backup, content } = await services.backupStore.readBackupFile(input.backupId);
    await services.auditLog.append({ actor: user.username, action: "backup.download", target: backup.fileName, ip: request.ip, status: "success" });
    reply.header("content-type", "application/json; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="${backup.fileName}"`);
    return content;
  });

  app.post("/api/backups/restore", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = BackupRestoreRequestSchema.parse(request.body);
    const result = await services.backupStore.restoreBackup(input.backupId, user.username);
    await services.auditLog.append({ actor: user.username, action: "backup.restore", target: result.restored.fileName, ip: request.ip, status: "success" });
    reply.clearCookie(sessionCookieName, { path: "/" });
    return result;
  });

  app.patch("/api/backups/schedule", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = UpdateBackupScheduleSchema.parse(request.body);
    const schedule = await services.backupStore.updateSchedule(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "backup.schedule", target: `every-${schedule.everyHours}h`, ip: request.ip, status: "success" });
    return { schedule };
  });
}
