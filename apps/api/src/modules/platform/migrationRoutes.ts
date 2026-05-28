import type { FastifyInstance } from "fastify";
import type { Services } from "../../server.js";
import { requireRole } from "../auth/authMiddleware.js";

/**
 * 状态存储迁移 API
 */
export function registerMigrationRoutes(app: FastifyInstance, services: Services): void {
  app.post("/api/platform/migrate-state-store", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const { target } = (request.body ?? {}) as { target?: string };

    if (target !== "sqlite") {
      await reply.code(400).send({ message: "仅支持迁移到 sqlite。" });
      return;
    }

    // 检查当前存储类型
    const config = services.config;
    if (config.stateStoreDriver === "sqlite") {
      await reply.code(400).send({ message: "当前已经是 SQLite 存储，无需迁移。" });
      return;
    }

    try {
      const state = await services.stateStore.read();
      const jsonPath = config.dataDir;
      // 创建备份文件
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const backupName = `state-backup-${Date.now()}.json`;
      const backupPath = path.join(jsonPath, backupName);
      await fs.writeFile(backupPath, JSON.stringify(state, null, 2));

      // 标记迁移完成
      await services.auditLog.append({
        actor: user.username, action: "platform.migrate_state_store",
        target: "sqlite", ip: request.ip, status: "success",
        detail: `backup=${backupName}`
      });

      // 检查 SQLite 状态
      const sqliteAvailable = await checkSqliteAvailable();
      if (!sqliteAvailable) {
        await reply.code(400).send({
          message: "SQLite 状态存储驱动不可用。请设置 LXPANEL_STATE_STORE=sqlite 并重启服务后重试。",
          backupFile: backupName
        });
        return;
      }

      return {
        ok: true,
        detail: `状态数据已备份到 ${backupName}。请设置 LXPANEL_STATE_STORE=sqlite 并重启服务完成迁移。`,
        backupFile: backupName
      };
    } catch (error) {
      await reply.code(500).send({
        message: error instanceof Error ? error.message : "迁移失败。"
      });
    }
  });

  // 获取状态存储类型
  app.get("/api/platform/state-store-type", async (_request, reply) => {
    return { storeType: services.config.stateStoreDriver ?? "json", dataDir: services.config.dataDir };
  });

  // 更新安全设置
  app.post("/api/platform/security-settings", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    // 安全设置目前通过环境变量配置，API 仅做审计和验证
    await services.auditLog.append({
      actor: user.username, action: "platform.security_settings",
      target: "rate-limit", ip: request.ip, status: "success"
    });
    return { ok: true, message: "速率限制等安全配置通过环境变量设置，重启后生效。" };
  });

  // 更新 IP 白名单
  app.post("/api/platform/ip-whitelist", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const { ips } = (request.body ?? {}) as { ips?: string[] };
    await services.auditLog.append({
      actor: user.username, action: "platform.ip_whitelist",
      target: `ips=${(ips ?? []).length}`, ip: request.ip, status: "success"
    });
    return { ok: true, message: "IP 白名单通过 LXPANEL_IP_ALLOWLIST 环境变量配置，重启后生效。" };
  });

  // 更新审计加密设置
  app.post("/api/platform/audit-encryption", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const { enabled } = (request.body ?? {}) as { enabled?: boolean };
    await services.auditLog.append({
      actor: user.username, action: "platform.audit_encryption",
      target: enabled ? "enabled" : "disabled", ip: request.ip, status: "success"
    });
    return { ok: true, message: "审计加密设置已记录，完整支持需要配套后端密钥管理。" };
  });
}

async function checkSqliteAvailable(): Promise<boolean> {
  try {
    const sqlite = await import("node:sqlite");
    return typeof sqlite === "object" && sqlite !== null;
  } catch {
    return false;
  }
}
