import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { CreateApiTokenSchema, OidcCallbackSchema, RevokeApiTokenSchema, SetupRequestSchema, TotpConfirmSchema, LoginRequestSchema, type IdentityProvider, type OidcCallback } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { randomToken } from "../../lib/crypto.js";
import { signValue, verifySignedValue } from "../../lib/sessionCookie.js";
import { readAuthenticatedUser, requireRole, requireUser, sessionCookieName } from "./authMiddleware.js";

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
    const result = await services.authStore.verifyLogin(body.username, body.password, body.totpCode);
    if (!result) {
      await services.auditLog.append({ actor: body.username, action: "auth.login", target: "session", ip: request.ip, status: "denied" });
      await reply.code(401).send({ message: "用户名或密码错误。" });
      return;
    }
    if (result.status === "totp_required") {
      await services.auditLog.append({ actor: body.username, action: "auth.login.totp", target: "session", ip: request.ip, status: "denied" });
      return { totpRequired: true };
    }
    const user = result.user;
    const session = await services.authStore.createSession(user.id);
    setSessionCookie(reply, services, session);
    await services.auditLog.append({ actor: user.username, action: "auth.login", target: "session", ip: request.ip, status: "success" });
    return { user };
  });

  app.get("/api/auth/oidc/start", async (_request, reply) => {
    const provider = await services.platformStore.identityProvider();
    if (!provider?.enabled) {
      await reply.code(404).send({ message: "OIDC 身份源未启用。" });
      return;
    }
    const state = signValue(`oidc:${Date.now()}:${randomToken(16)}`, services.config.sessionSecret);
    const callbackPath = "/api/auth/oidc/callback";
    return { authorizationUrl: oidcAuthorizationUrl(provider, callbackPath, state), state, callbackPath };
  });

  app.post("/api/auth/oidc/callback", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } }
  }, async (request, reply) => completeOidcCallback(OidcCallbackSchema.parse(request.body), request, reply, services));

  app.get<{ Querystring: Record<string, string | undefined> }>("/api/auth/oidc/callback", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } }
  }, async (request, reply) => completeOidcCallback(OidcCallbackSchema.parse(request.query), request, reply, services));

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

  app.get("/api/auth/sessions", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const rawSessionId = verifySignedValue(request.cookies[sessionCookieName], services.config.sessionSecret) ?? undefined;
    return { sessions: await services.authStore.listSessions(rawSessionId) };
  });

  app.delete<{ Querystring: { sessionId?: string } }>("/api/auth/sessions", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    if (!request.query.sessionId) {
      await reply.code(400).send({ message: "缺少 sessionId。" });
      return;
    }
    await services.authStore.deleteSessionByPublicId(request.query.sessionId);
    await services.auditLog.append({ actor: user.username, action: "auth.session.revoke", target: request.query.sessionId, ip: request.ip, status: "success" });
    return { ok: true };
  });

  app.get("/api/auth/tokens", async (request, reply) => {
    const user = await requireCookieUser(request, reply, services);
    if (!user) {
      return;
    }
    return { tokens: await services.authStore.listApiTokens(user.id) };
  });

  app.post("/api/auth/tokens", async (request, reply) => {
    const user = await requireCookieUser(request, reply, services);
    if (!user) {
      return;
    }
    const input = CreateApiTokenSchema.parse(request.body);
    const token = await services.authStore.createApiToken(user, input);
    await services.auditLog.append({ actor: user.username, action: "auth.token.create", target: token.token.name, ip: request.ip, status: "success" });
    return token;
  });

  app.delete<{ Querystring: { tokenId?: string } }>("/api/auth/tokens", async (request, reply) => {
    const user = await requireCookieUser(request, reply, services);
    if (!user) {
      return;
    }
    const input = RevokeApiTokenSchema.parse({ tokenId: request.query.tokenId ?? "" });
    const revoked = await services.authStore.revokeApiToken(user.id, input.tokenId);
    if (!revoked) {
      await reply.code(404).send({ message: "API Token 不存在。" });
      return;
    }
    await services.auditLog.append({ actor: user.username, action: "auth.token.revoke", target: input.tokenId, ip: request.ip, status: "success" });
    return { ok: true };
  });

  app.post("/api/auth/totp/setup", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const setup = await services.authStore.beginTotpSetup(user.id);
    await services.auditLog.append({ actor: user.username, action: "auth.totp.setup", target: user.username, ip: request.ip, status: "success" });
    return setup;
  });

  app.post("/api/auth/totp/confirm", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const body = TotpConfirmSchema.parse(request.body);
    const updated = await services.authStore.confirmTotp(user.id, body.code);
    await services.auditLog.append({ actor: user.username, action: "auth.totp.confirm", target: user.username, ip: request.ip, status: "success" });
    return { user: updated };
  });

  app.post("/api/auth/totp/disable", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const body = TotpConfirmSchema.parse(request.body);
    const updated = await services.authStore.disableTotp(user.id, body.code);
    await services.auditLog.append({ actor: user.username, action: "auth.totp.disable", target: user.username, ip: request.ip, status: "success" });
    return { user: updated };
  });
}

async function requireCookieUser(request: FastifyRequest, reply: FastifyReply, services: Services) {
  const rawSessionId = verifySignedValue(request.cookies[sessionCookieName], services.config.sessionSecret);
  const user = rawSessionId ? await services.authStore.getUserBySession(rawSessionId) : null;
  if (!user) {
    await reply.code(401).send({ message: "请先登录。" });
    return null;
  }
  return user;
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

async function completeOidcCallback(input: OidcCallback, request: FastifyRequest, reply: FastifyReply, services: Services): Promise<{ user: unknown } | undefined> {
  const state = verifySignedValue(input.state, services.config.sessionSecret);
  if (!state?.startsWith("oidc:")) {
    await services.auditLog.append({ actor: "oidc", action: "auth.oidc.callback", target: "state", ip: request.ip, status: "denied" });
    await reply.code(400).send({ message: "OIDC state 无效或已损坏。" });
    return;
  }
  const result = await services.authStore.completeOidcLogin(input);
  const session = await services.authStore.createSession(result.user.id);
  setSessionCookie(reply, services, session);
  await services.auditLog.append({ actor: result.user.username, action: result.created ? "auth.oidc.auto_create" : "auth.oidc.login", target: result.provider.name, ip: request.ip, status: "success", detail: `subject=${result.subject}` });
  return { user: result.user };
}

function oidcAuthorizationUrl(provider: IdentityProvider, callbackPath: string, state: string): string {
  const url = new URL(provider.authorizationEndpoint);
  url.searchParams.set("client_id", provider.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", provider.scopes.join(" "));
  url.searchParams.set("redirect_uri", callbackPath);
  url.searchParams.set("state", state);
  return url.toString();
}
