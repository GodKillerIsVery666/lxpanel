import type { FastifyInstance } from "fastify";
import type { Services } from "../../server.js";
import { requireUser } from "../auth/authMiddleware.js";

export function registerMonitoringRoutes(app: FastifyInstance, services: Services): void {
  app.get<{ Querystring: { hostId?: string; limit?: string } }>("/api/monitoring/samples", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const limit = parseLimit(request.query.limit);
    return { samples: await services.monitoringService.listSamples(request.query.hostId, limit) };
  });

  app.get<{ Querystring: { hostId?: string } }>("/api/monitoring/latest", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { sample: await services.monitoringService.latest(request.query.hostId) };
  });
}

function parseLimit(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const limit = Number.parseInt(value, 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
    return undefined;
  }
  return limit;
}
