import type { FastifyInstance } from "fastify";
import { BackupRequestSchema, BackupRestoreRequestSchema, CreateRemoteBackupTargetSchema, RemoteBackupSyncSchema, UpdateBackupScheduleSchema, UpdateRemoteBackupTargetSchema } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { sendApprovalError } from "../approvals/approvalRoutes.js";
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

  app.post("/api/backups/verify", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = BackupRequestSchema.parse(request.body);
    const verification = await services.backupStore.verifyBackup(input.backupId);
    await services.auditLog.append({ actor: user.username, action: "backup.verify", target: verification.fileName, ip: request.ip, status: verification.ok ? "success" : "error", detail: verification.issues.join("; ") });
    return { verification };
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
    try {
      await services.approvalStore.consume({ approvalId: input.approvalId, action: "backup.restore", target: input.backupId, actor: user.username });
    } catch (error) {
      if (await sendApprovalError(reply, error)) {
        return;
      }
      throw error;
    }
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

  app.get<{ Querystring: { workspace?: string } }>("/api/backups/remote-targets", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { targets: await services.backupStore.listRemoteTargets(request.query.workspace) };
  });

  app.post("/api/backups/remote-targets", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = CreateRemoteBackupTargetSchema.parse(request.body);
    const target = await services.backupStore.createRemoteTarget(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "backup.remote.create", target: target.name, ip: request.ip, status: "success" });
    return { target };
  });

  app.patch("/api/backups/remote-targets", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = UpdateRemoteBackupTargetSchema.parse(request.body);
    const target = await services.backupStore.updateRemoteTarget(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "backup.remote.update", target: target.name, ip: request.ip, status: "success" });
    return { target };
  });

  app.post("/api/backups/remote-sync", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = RemoteBackupSyncSchema.parse(request.body);
    const results = await services.backupStore.syncRemote(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "backup.remote.sync", target: input.backupId, ip: request.ip, status: results.some((result) => result.status === "failed") ? "error" : "success", detail: JSON.stringify(results.map((result) => ({ target: result.targetName, status: result.status }))) });
    return { results };
  });
}
