import type { FastifyInstance } from "fastify";
import { CreateHostGroupSchema, CreateHostSchema, HostBatchCommandSchema, HostSshSessionRequestSchema, UpdateHostSchema } from "@lxpanel/shared";
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

  app.get("/api/hosts/groups", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { groups: await services.hostService.listGroups() };
  });

  app.post("/api/hosts/groups", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = CreateHostGroupSchema.parse(request.body);
    const group = await services.hostService.createGroup(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "host.group.create", target: group.name, ip: request.ip, status: "success" });
    return { group };
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

  app.post("/api/hosts/batch-command", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = HostBatchCommandSchema.parse(request.body);
    const targets = await services.hostService.resolveCommandTargets(input.hostIds);
    const commands = [];
    for (const target of targets) {
      commands.push(await services.connectorStore.createCommand({ connectorId: target.connectorId, command: input.command, args: input.args }, user.username));
    }
    await services.auditLog.append({ actor: user.username, action: "host.batch_command", target: `${commands.length} hosts`, ip: request.ip, status: "success", detail: input.command });
    return { commands };
  });

  app.post("/api/hosts/ssh-session", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = HostSshSessionRequestSchema.parse(request.body);
    const target = (await services.hostService.resolveCommandTargets([input.hostId]))[0];
    if (!target) {
      await reply.code(404).send({ message: "主机不存在。" });
      return;
    }
    const destination = `${input.username ? `${input.username}@` : ""}${target.host.address ?? target.host.name}`;
    const command = await services.connectorStore.createCommand({ connectorId: target.connectorId, command: "ssh", args: [destination] }, user.username);
    await services.auditLog.append({ actor: user.username, action: "host.ssh_session", target: target.host.name, ip: request.ip, status: "success" });
    return { command };
  });
}
