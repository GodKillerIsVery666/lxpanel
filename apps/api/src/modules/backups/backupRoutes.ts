import type { FastifyInstance } from "fastify";
import type { Services } from "../../server.js";
import { requireRole } from "../auth/authMiddleware.js";

export function registerBackupRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/backups", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { backups: await services.backupStore.listBackups() };
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
}
