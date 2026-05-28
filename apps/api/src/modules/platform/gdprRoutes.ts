import type { FastifyInstance } from "fastify";
import type { Services } from "../../server.js";
import { requireRole } from "../auth/authMiddleware.js";

/**
 * GDPR 数据合规 API
 * 提供用户数据导出、数据保留策略可视化等功能
 */
export function registerGdprRoutes(app: FastifyInstance, services: Services): void {
  // 导出用户个人数据
  app.get("/api/platform/gdpr/export", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const state = await services.stateStore.read();
    const userData = state.users.find((u) => u.id === user.id);
    if (!userData) {
      await reply.code(404).send({ message: "用户数据不存在。" });
      return;
    }
    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        id: userData.id,
        username: userData.username,
        role: userData.role,
        displayName: userData.displayName,
        email: userData.email,
        createdAt: userData.createdAt
      },
      sessions: (state.sessions ?? []).filter((s) => s.userId === user.id).map((s) => ({
        createdAt: s.createdAt,
        expiresAt: s.expiresAt
      })),
      apiTokens: (state.apiTokens ?? []).filter((t) => t.userId === user.id).map((t) => ({
        name: t.name,
        scopes: t.scopes,
        createdAt: t.createdAt,
        expiresAt: t.expiresAt
      })),
      auditEvents: await services.auditLog.list({ actor: user.username, limit: 100 })
    };
    reply.header("content-type", "application/json; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="lxpanel-gdpr-export-${user.username}.json"`);
    return exportData;
  });

  // 数据保留策略概览
  app.get("/api/platform/gdpr/retention-policies", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const state = await services.stateStore.read();
    const policies = {
      auditRetention: state.auditRetentionPolicies ?? [],
      backupRetention: state.backupSchedule?.everyHours ?? 24,
      snapshotRetention: 100, // 保留最近 100 份快照
      dataRetentionDays: 365
    };
    return { policies };
  });

  // 删除用户数据（账户注销）
  app.post("/api/platform/gdpr/delete-user", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const { userId } = (request.body ?? {}) as { userId?: string };
    if (!userId) {
      await reply.code(400).send({ message: "需要用户 ID。" });
      return;
    }
    if (userId === user.id) {
      await reply.code(400).send({ message: "不能删除自己的账号。" });
      return;
    }
    await services.stateStore.update((state) => ({
      data: {
        ...state,
        users: (state.users ?? []).filter((u) => u.id !== userId),
        sessions: (state.sessions ?? []).filter((s) => s.userId !== userId),
        apiTokens: (state.apiTokens ?? []).filter((t) => t.userId !== userId)
      },
      result: undefined
    }));
    await services.auditLog.append({
      actor: user.username, action: "gdpr.delete_user",
      target: userId, ip: request.ip, status: "success"
    });
    return { ok: true };
  });
}
