import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import type { FastifyInstance } from "fastify";
import type { Services } from "../../server.js";

export function registerHealthRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/health", () => ({
    ok: true,
    name: "lxpanel",
    time: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    memory: process.memoryUsage()
  }));

  app.get("/api/health/live", () => ({
    ok: true,
    time: new Date().toISOString()
  }));

  app.get("/api/health/ready", async (_request, reply) => {
    try {
      await mkdir(services.config.dataDir, { recursive: true });
      await access(services.config.dataDir, constants.R_OK | constants.W_OK);
      return { ok: true, dataDirWritable: true, time: new Date().toISOString() };
    } catch (error) {
      app.log.error(error);
      await reply.code(503).send({ ok: false, dataDirWritable: false, time: new Date().toISOString() });
    }
  });
}
