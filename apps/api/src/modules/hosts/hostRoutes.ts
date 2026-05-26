import type { FastifyInstance } from "fastify";
import { CreateHostSchema, UpdateHostSchema } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { requireRole, requireUser } from "../auth/authMiddleware.js";

export function registerHostRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/hosts", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { hosts: await services.hostService.list() };
  });

  app.post("/api/hosts", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = CreateHostSchema.parse(request.body);
    const host = await services.hostService.create(input);
    await services.auditLog.append({ actor: user.username, action: "host.create", target: host.name, ip: request.ip, status: "success" });
    return { host };
  });

  app.patch("/api/hosts", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = UpdateHostSchema.parse(request.body);
    const host = await services.hostService.update(input);
    await services.auditLog.append({ actor: user.username, action: "host.update", target: host.name, ip: request.ip, status: "success" });
    return { host };
  });

  app.delete<{ Querystring: { hostId?: string } }>("/api/hosts", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const hostId = request.query.hostId ?? "";
    if (!hostId) {
      await reply.code(400).send({ message: "缺少主机 ID。" });
      return;
    }
    const deleted = await services.hostService.delete(hostId);
    if (!deleted) {
      await reply.code(404).send({ message: "主机不存在。" });
      return;
    }
    await services.auditLog.append({ actor: user.username, action: "host.delete", target: hostId, ip: request.ip, status: "success" });
    return { ok: true };
  });
}
