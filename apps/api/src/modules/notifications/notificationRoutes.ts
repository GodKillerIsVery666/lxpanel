import type { FastifyInstance, FastifyReply } from "fastify";
import { CreateNotificationChannelSchema, NotificationSecretRotationSchema, NotificationTestSchema, UpdateNotificationChannelSchema } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { requireRole } from "../auth/authMiddleware.js";

export function registerNotificationRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/notifications", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    return { channels: await services.notificationService.listChannels(), deliveries: await services.notificationService.listDeliveries() };
  });

  app.post("/api/notifications", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = CreateNotificationChannelSchema.parse(request.body);
    const channel = await tryNotificationWrite(reply, () => services.notificationService.createChannel(input, user.username));
    if (!channel) {
      return;
    }
    await services.auditLog.append({ actor: user.username, action: "notification.create", target: channel.name, ip: request.ip, status: "success" });
    return { channel };
  });

  app.patch("/api/notifications", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = UpdateNotificationChannelSchema.parse(request.body);
    const channel = await tryNotificationWrite(reply, () => services.notificationService.updateChannel(input, user.username));
    if (!channel) {
      return;
    }
    await services.auditLog.append({ actor: user.username, action: "notification.update", target: channel.name, ip: request.ip, status: "success" });
    return { channel };
  });

  app.delete<{ Querystring: { channelId?: string } }>("/api/notifications", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const channelId = request.query.channelId ?? "";
    if (!channelId) {
      await reply.code(400).send({ message: "缺少通知渠道 ID。" });
      return;
    }
    const deleted = await services.notificationService.deleteChannel(channelId);
    if (!deleted) {
      await reply.code(404).send({ message: "通知渠道不存在。" });
      return;
    }
    await services.auditLog.append({ actor: user.username, action: "notification.delete", target: channelId, ip: request.ip, status: "success" });
    return { ok: true };
  });

  app.post("/api/notifications/test", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = NotificationTestSchema.parse(request.body);
    const delivery = await services.notificationService.testChannel(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "notification.test", target: input.channelId, ip: request.ip, status: delivery.status === "success" ? "success" : "error", detail: delivery.error });
    return { delivery };
  });

  app.post("/api/notifications/rotate-secret", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = NotificationSecretRotationSchema.parse(request.body ?? {});
    const result = await tryNotificationWrite(reply, () => services.notificationService.rotateWebhookSecrets(input, user.username));
    if (!result) {
      return;
    }
    await services.auditLog.append({ actor: user.username, action: "notification.secret.rotate", target: "webhook", ip: request.ip, status: result.failed > 0 ? "error" : "success", detail: JSON.stringify({ rotated: result.rotated, failed: result.failed }) });
    return { result };
  });
}

async function tryNotificationWrite<T>(reply: FastifyReply, action: () => Promise<T>): Promise<T | null> {
  try {
    return await action();
  } catch (error) {
    await reply.code(400).send({ message: error instanceof Error ? error.message : "通知渠道操作失败。" });
    return null;
  }
}
