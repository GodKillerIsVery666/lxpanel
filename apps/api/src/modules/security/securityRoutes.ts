import type { FastifyInstance } from "fastify";
import type { SecurityPosture } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { requireUser } from "../auth/authMiddleware.js";

export function registerSecurityRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/security/posture", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const recommendations: string[] = [];
    if (!services.config.cookieSecure) {
      recommendations.push("生产环境建议启用 LXPANEL_COOKIE_SECURE=true 并放在 HTTPS 后面。");
    }
    if (services.config.sessionSecret.includes("dev-change-me")) {
      recommendations.push("请设置强随机 LXPANEL_SESSION_SECRET。");
    }
    const posture: SecurityPosture = {
      setupRequired: !(await services.authStore.hasUsers()),
      cookieSecure: services.config.cookieSecure,
      managedRoots: services.config.fileRoots,
      logRoots: services.config.logRoots,
      connectorCount: await services.connectorStore.count(),
      userCount: await services.authStore.countUsers(),
      taskCount: await services.taskStore.countTasks(),
      backupCount: await services.backupStore.countBackups(),
      recommendations
    };
    return { posture };
  });
}
