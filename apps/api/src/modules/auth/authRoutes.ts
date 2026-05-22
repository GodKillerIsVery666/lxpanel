import type { FastifyInstance, FastifyReply } from "fastify";
import { LoginRequestSchema, SetupRequestSchema } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { signValue, verifySignedValue } from "../../lib/sessionCookie.js";
import { readAuthenticatedUser, requireUser, sessionCookieName } from "./authMiddleware.js";

export function registerAuthRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/auth/status", async (request) => {
    const user = await readAuthenticatedUser(request, services);
    return {
      setupRequired: !(await services.authStore.hasUsers()),
      user
    };
  });

  app.post("/api/auth/setup", async (request, reply) => {
    const setupRequired = !(await services.authStore.hasUsers());
    if (!setupRequired) {
      await reply.code(409).send({ message: "初始化已完成。" });
      return;
    }
    const body = SetupRequestSchema.parse(request.body);
    const user = await services.authStore.createInitialAdmin(body.username, body.password);
    await services.auditLog.append({ actor: user.username, action: "auth.setup", target: "admin", ip: request.ip, status: "success" });
    const session = await services.authStore.createSession(user.id);
    setSessionCookie(reply, services, session);
    return { user };
  });

  app.post("/api/auth/login", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } }
  }, async (request, reply) => {
    const body = LoginRequestSchema.parse(request.body);
    const user = await services.authStore.verifyLogin(body.username, body.password);
    if (!user) {
      await services.auditLog.append({ actor: body.username, action: "auth.login", target: "session", ip: request.ip, status: "denied" });
      await reply.code(401).send({ message: "用户名或密码错误。" });
      return;
    }
    const session = await services.authStore.createSession(user.id);
    setSessionCookie(reply, services, session);
    await services.auditLog.append({ actor: user.username, action: "auth.login", target: "session", ip: request.ip, status: "success" });
    return { user };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const rawSessionId = verifySignedValue(request.cookies[sessionCookieName], services.config.sessionSecret);
    if (rawSessionId) {
      await services.authStore.deleteSession(rawSessionId);
    }
    reply.clearCookie(sessionCookieName, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { user };
  });
}

function setSessionCookie(reply: FastifyReply, services: Services, rawSessionId: string): void {
  reply.setCookie(sessionCookieName, signValue(rawSessionId, services.config.sessionSecret), {
    httpOnly: true,
    sameSite: "strict",
    secure: services.config.cookieSecure,
    path: "/",
    maxAge: 60 * 60 * 12
  });
}
