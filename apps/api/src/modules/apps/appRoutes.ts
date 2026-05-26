import type { FastifyInstance } from "fastify";
import { AppDeploymentActionSchema, CreateAppDeploymentSchema } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { requireRole, requireUser } from "../auth/authMiddleware.js";

export function registerAppRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/apps/templates", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { templates: services.appStore.listTemplates() };
  });

  app.get("/api/apps/deployments", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { deployments: await services.appStore.listDeployments() };
  });

  app.post("/api/apps/deployments", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = CreateAppDeploymentSchema.parse(request.body);
    const deployment = await services.appStore.createDeployment(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "app.deploy", target: deployment.name, ip: request.ip, status: deployment.status === "failed" ? "error" : "success", detail: deployment.lastOutputTail });
    return { deployment };
  });

  app.post("/api/apps/deployments/action", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = AppDeploymentActionSchema.parse(request.body);
    const deployment = await services.appStore.runAction(input, user.username);
    await services.auditLog.append({ actor: user.username, action: `app.${input.action}`, target: deployment.name, ip: request.ip, status: deployment.status === "failed" ? "error" : "success", detail: deployment.lastOutputTail });
    return { deployment };
  });
}
