import type { FastifyInstance } from "fastify";
import { ChangeOwnPasswordSchema, CreateUserSchema, ResetUserPasswordSchema, UpdateUserRoleSchema } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { requireRole, requireUser } from "../auth/authMiddleware.js";

export function registerUserRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/users", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { users: await services.authStore.listUsers() };
  });

  app.post("/api/users", async (request, reply) => {
    const actor = await requireRole(request, reply, services, "owner");
    if (!actor) {
      return;
    }
    const input = CreateUserSchema.parse(request.body);
    const user = await services.authStore.createUser(input);
    await services.auditLog.append({ actor: actor.username, action: "user.create", target: user.username, ip: request.ip, status: "success" });
    return { user };
  });

  app.patch("/api/users/role", async (request, reply) => {
    const actor = await requireRole(request, reply, services, "owner");
    if (!actor) {
      return;
    }
    const input = UpdateUserRoleSchema.parse(request.body);
    const user = await services.authStore.updateUserRole(input.userId, input.role);
    await services.auditLog.append({ actor: actor.username, action: "user.role", target: user.username, ip: request.ip, status: "success" });
    return { user };
  });

  app.post("/api/users/password", async (request, reply) => {
    const actor = await requireRole(request, reply, services, "owner");
    if (!actor) {
      return;
    }
    const input = ResetUserPasswordSchema.parse(request.body);
    await services.authStore.resetPassword(input.userId, input.password);
    await services.auditLog.append({ actor: actor.username, action: "user.password.reset", target: input.userId, ip: request.ip, status: "success" });
    return { ok: true };
  });

  app.post("/api/users/me/password", async (request, reply) => {
    const actor = await requireUser(request, reply, services);
    if (!actor) {
      return;
    }
    const input = ChangeOwnPasswordSchema.parse(request.body);
    await services.authStore.changeOwnPassword(actor.id, input.currentPassword, input.newPassword);
    await services.auditLog.append({ actor: actor.username, action: "user.password.change", target: actor.username, ip: request.ip, status: "success" });
    return { ok: true };
  });

  app.delete<{ Querystring: { userId?: string } }>("/api/users", async (request, reply) => {
    const actor = await requireRole(request, reply, services, "owner");
    if (!actor) {
      return;
    }
    const userId = request.query.userId;
    if (!userId) {
      await reply.code(400).send({ message: "缺少 userId。" });
      return;
    }
    await services.authStore.deleteUser(userId);
    await services.auditLog.append({ actor: actor.username, action: "user.delete", target: userId, ip: request.ip, status: "success" });
    return { ok: true };
  });
}
