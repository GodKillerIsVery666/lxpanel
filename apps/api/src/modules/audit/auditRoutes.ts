import type { FastifyInstance } from "fastify";
import { AuditExportQuerySchema, AuditQuerySchema, AuditRetentionSchema } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { requireRole, requireUser } from "../auth/authMiddleware.js";

export function registerAuditRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/audit", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const query = AuditQuerySchema.parse(request.query);
    return { events: await services.auditLog.list(query) };
  });

  app.get("/api/audit/export", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const query = AuditExportQuerySchema.parse(request.query);
    const content = await services.auditLog.export(query);
    const extension = query.format === "csv" ? "csv" : "jsonl";
    await services.auditLog.append({ actor: user.username, action: "audit.export", target: extension, ip: request.ip, status: "success" });
    reply.header("content-type", query.format === "csv" ? "text/csv; charset=utf-8" : "application/x-ndjson; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="lxpanel-audit.${extension}"`);
    return content;
  });

  app.delete("/api/audit", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = AuditRetentionSchema.parse(request.query);
    const result = await services.auditLog.prune(input.retainDays);
    await services.auditLog.append({ actor: user.username, action: "audit.prune", target: `${input.retainDays}d`, ip: request.ip, status: "success", detail: `removed=${result.removed}` });
    return { result };
  });
}
