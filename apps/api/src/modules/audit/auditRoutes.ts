import type { FastifyInstance } from "fastify";
import type { Services } from "../../server.js";
import { requireUser } from "../auth/authMiddleware.js";

export function registerAuditRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/audit", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { events: await services.auditLog.list() };
  });
}
