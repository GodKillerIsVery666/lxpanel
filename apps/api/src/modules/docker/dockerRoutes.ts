import type { FastifyInstance } from "fastify";
import { DockerContainerActionSchema } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { requireRole, requireUser } from "../auth/authMiddleware.js";
import { getDockerStatus, listDockerContainers, listDockerImages, runDockerContainerAction } from "./dockerService.js";

export function registerDockerRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/docker/status", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    return { status: await getDockerStatus() };
  });

  app.get("/api/docker/containers", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { containers: await listDockerContainers() };
  });

  app.get("/api/docker/images", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { images: await listDockerImages() };
  });

  app.post("/api/docker/containers/action", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const body = DockerContainerActionSchema.parse(request.body);
    await runDockerContainerAction(body.id, body.action);
    await services.auditLog.append({ actor: user.username, action: `docker.${body.action}`, target: body.id, ip: request.ip, status: "success" });
    return { ok: true };
  });
}
