import type { FastifyInstance } from "fastify";

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get("/api/health", () => ({
    ok: true,
    name: "lxpanel",
    time: new Date().toISOString()
  }));
}
