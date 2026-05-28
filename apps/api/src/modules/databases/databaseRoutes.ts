import type { FastifyInstance } from "fastify";
import { CreateDatabaseConnectionSchema, DatabaseBackupRequestSchema, DatabaseRestoreDrillRequestSchema, DatabaseRestoreRequestSchema, UpdateDatabaseConnectionSchema } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { requireRole } from "../auth/authMiddleware.js";
import { enforceResourceApproval } from "../platform/approvalGuard.js";

export function registerDatabaseRoutes(app: FastifyInstance, services: Services): void {
  app.get<{ Querystring: { workspace?: string } }>("/api/databases", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    return { connections: await services.databaseStore.listConnections(request.query.workspace) };
  });

  app.post("/api/databases", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = CreateDatabaseConnectionSchema.parse(request.body);
    const connection = await services.databaseStore.createConnection(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "database.create", target: connection.name, ip: request.ip, status: "success" });
    return { connection };
  });

  app.patch("/api/databases", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = UpdateDatabaseConnectionSchema.parse(request.body);
    const connection = await services.databaseStore.updateConnection(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "database.update", target: connection.name, ip: request.ip, status: "success" });
    return { connection };
  });

  app.delete<{ Querystring: { connectionId?: string } }>("/api/databases", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const connectionId = request.query.connectionId ?? "";
    if (!connectionId) {
      await reply.code(400).send({ message: "缺少数据库连接 ID。" });
      return;
    }
    const deleted = await services.databaseStore.deleteConnection(connectionId);
    if (!deleted) {
      await reply.code(404).send({ message: "数据库连接不存在。" });
      return;
    }
    await services.auditLog.append({ actor: user.username, action: "database.delete", target: connectionId, ip: request.ip, status: "success" });
    return { ok: true };
  });

  app.post("/api/databases/backup", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = DatabaseBackupRequestSchema.parse(request.body);
    const approved = await enforceResourceApproval(services, reply, { workspace: input.workspace, resourceType: "database", resourceId: input.connectionId, action: "database.backup", ...(input.approvalId ? { approvalId: input.approvalId } : {}) }, user.username);
    if (!approved) {
      return;
    }
    const result = await services.databaseStore.backupConnection(input.connectionId, user.username);
    await services.auditLog.append({ actor: user.username, action: "database.backup", target: input.connectionId, ip: request.ip, status: result.status === "success" ? "success" : "error", detail: result.error ?? result.outputTail });
    return { result };
  });

  app.post("/api/databases/cleanup", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const result = await services.databaseStore.cleanupExpiredBackups();
    await services.auditLog.append({ actor: user.username, action: "database.backup.cleanup", target: "database-backups", ip: request.ip, status: result.issues.length > 0 ? "error" : "success", detail: `removed=${result.removed};retained=${result.retained}` });
    return { result };
  });

  app.post("/api/databases/restore-drill", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = DatabaseRestoreDrillRequestSchema.parse(request.body);
    const result = await services.databaseStore.runRestoreDrill(input.connectionId, user.username);
    await services.auditLog.append({ actor: user.username, action: "database.restore_drill", target: input.connectionId, ip: request.ip, status: result.status === "success" || result.status === "skipped" ? "success" : "error", detail: result.error ?? result.outputTail });
    return { result };
  });

  app.post("/api/databases/wal-archive", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const body = (request.body ?? {}) as Record<string, unknown>;
    const connectionId = typeof body.connectionId === "string" ? body.connectionId : "";
    if (!connectionId) {
      await reply.code(400).send({ message: "缺少 connectionId。" });
      return;
    }
    const result = await services.databaseStore.archiveWal(connectionId);
    await services.auditLog.append({ actor: user.username, action: "database.wal_archive", target: connectionId, ip: request.ip, status: result.status === "success" ? "success" : "error", detail: result.walFile ?? result.error });
    return { result };
  });

  app.post("/api/databases/restore", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = DatabaseRestoreRequestSchema.parse(request.body);
    const approved = await enforceResourceApproval(services, reply, { workspace: "default", resourceType: "database", resourceId: input.connectionId, action: "database.restore", ...(request.body && typeof request.body === "object" && "approvalId" in request.body ? { approvalId: String((request.body as Record<string, unknown>).approvalId) } : {}) }, user.username);
    if (!approved) {
      return;
    }
    const result = await services.databaseStore.runRestore(input.connectionId, input.targetDatabaseUrl);
    await services.auditLog.append({ actor: user.username, action: "database.restore", target: input.connectionId, ip: request.ip, status: result.status === "success" ? "success" : "error", detail: result.error ?? result.outputTail });
    return { result };
  });
}
