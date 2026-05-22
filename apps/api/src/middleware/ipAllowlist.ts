import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config/env.js";

export function registerIpAllowlist(app: FastifyInstance, config: AppConfig): void {
  if (config.ipAllowlist.length === 0) {
    return;
  }
  app.addHook("onRequest", async (request, reply) => {
    const ip = normalizeIp(request.ip);
    const allowed = config.ipAllowlist.some((entry) => normalizeIp(entry) === ip);
    if (!allowed) {
      request.log.warn({ ip }, "request denied by ip allowlist");
      await reply.code(403).send({ message: "当前 IP 不在允许列表。" });
    }
  });
}

function normalizeIp(value: string): string {
  if (value.startsWith("::ffff:")) {
    return value.slice(7);
  }
  return value === "::1" ? "127.0.0.1" : value;
}