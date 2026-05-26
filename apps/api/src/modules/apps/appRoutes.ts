import type { FastifyInstance } from "fastify";
import { AppDeploymentActionSchema, BackupRequestSchema, CreateAppDeploymentSchema, RollbackAppDeploymentSchema, UpdateAppDeploymentSchema } from "@lxpanel/shared";
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

  app.get<{ Querystring: { deploymentId?: string } }>("/api/apps/deployments/health", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const input = BackupRequestSchema.parse({ backupId: request.query.deploymentId ?? "" });
    return { health: await services.appStore.checkHealth(input.backupId) };
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

  app.patch("/api/apps/deployments", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = UpdateAppDeploymentSchema.parse(request.body);
    const deployment = await services.appStore.updateDeployment(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "app.upgrade", target: deployment.name, ip: request.ip, status: deployment.status === "failed" ? "error" : "success", detail: deployment.lastOutputTail });
    return { deployment };
  });

  app.post("/api/apps/deployments/rollback", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = RollbackAppDeploymentSchema.parse(request.body);
    const deployment = await services.appStore.rollbackDeployment(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "app.rollback", target: deployment.name, ip: request.ip, status: deployment.status === "failed" ? "error" : "success", detail: deployment.lastOutputTail });
    return { deployment };
  });
}
