import type { FastifyInstance } from "fastify";
import { DismissAlertSchema, UpdateAlertThresholdSchema } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { requireRole, requireUser } from "../auth/authMiddleware.js";

export function registerAlertRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/alerts", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { events: await services.alertService.listEvents(), summary: await services.alertService.getSummary() };
  });

  app.get("/api/alerts/thresholds", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { thresholds: await services.alertService.getThresholds() };
  });

  app.patch("/api/alerts/thresholds", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const body = UpdateAlertThresholdSchema.parse(request.body);
    const thresholds = await services.alertService.updateThreshold(body, user.username);
    await services.auditLog.append({ actor: user.username, action: "alerts.threshold.update", target: body.type, ip: request.ip, status: "success" });
    return { thresholds };
  });

  app.post("/api/alerts/check", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const events = await services.alertService.check();
    await services.auditLog.append({ actor: user.username, action: "alerts.check", target: "resources", ip: request.ip, status: "success", detail: `${events.length} alerts` });
    return { events, summary: await services.alertService.getSummary() };
  });

  app.post("/api/alerts/dismiss", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const body = DismissAlertSchema.parse(request.body);
    const event = await services.alertService.dismissAlert(body.alertId, user.username);
    await services.auditLog.append({ actor: user.username, action: "alerts.dismiss", target: body.alertId, ip: request.ip, status: "success" });
    return { event };
  });
}
