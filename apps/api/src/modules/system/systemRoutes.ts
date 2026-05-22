import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Services } from "../../server.js";
import { requireUser } from "../auth/authMiddleware.js";
import { getSystemOverview, listProcesses, listServices, runServiceAction } from "./systemService.js";

const ServiceActionSchema = z.object({
  name: z.string().min(1).max(160),
  action: z.enum(["start", "stop", "restart"])
});

export function registerSystemRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/system/overview", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { overview: getSystemOverview() };
  });

  app.get("/api/system/processes", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { processes: await listProcesses() };
  });

  app.get("/api/system/services", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { services: await listServices() };
  });

  app.post("/api/system/services/action", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const body = ServiceActionSchema.parse(request.body);
    await runServiceAction(body.name, body.action);
    await services.auditLog.append({ actor: user.username, action: `service.${body.action}`, target: body.name, ip: request.ip, status: "success" });
    return { ok: true };
  });
}
