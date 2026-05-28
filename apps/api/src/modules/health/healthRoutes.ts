import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import type { FastifyInstance } from "fastify";
import type { Services } from "../../server.js";

export function registerHealthRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/health", async () => {
    const state = await services.stateStore.read();
    return {
      ok: true,
      name: "lxpanel",
      version: "1.0.0",
      time: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      memory: process.memoryUsage(),
      state: {
        users: state.users.length,
        hosts: (state.hosts ?? []).length,
        connectors: state.connectors.length,
        backups: (state.backups ?? []).length,
        auditEvents: await countAuditLines(services),
        stateBytes: Buffer.byteLength(JSON.stringify(state), "utf8")
      }
    };
  });

  app.get("/api/health/live", () => ({
    ok: true,
    time: new Date().toISOString()
  }));

  app.get("/api/health/ready", async (_request, reply) => {
    const checks = {
      dataDir: false,
      stateReadable: false,
      auditWritable: false
    };
    try {
      await mkdir(services.config.dataDir, { recursive: true });
      await access(services.config.dataDir, constants.R_OK | constants.W_OK);
      checks.dataDir = true;
      const state = await services.stateStore.read();
      checks.stateReadable = Array.isArray(state.users);
      await services.auditLog.list({ limit: 1 });
      checks.auditWritable = true;
      const allOk = Object.values(checks).every(Boolean);
      if (!allOk) {
        await reply.code(503).send({ ok: false, checks, time: new Date().toISOString() });
        return;
      }
      return { ok: true, checks, time: new Date().toISOString() };
    } catch (error) {
      app.log.error(error);
      await reply.code(503).send({ ok: false, checks, time: new Date().toISOString() });
    }
  });
}

async function countAuditLines(services: Services): Promise<number> {
  try {
    const events = await services.auditLog.list({ limit: 1 });
    return events.length > 0 ? -1 : 0; // 无法精确计数，返回 -1 表示有数据
  } catch {
    return 0;
  }
}
