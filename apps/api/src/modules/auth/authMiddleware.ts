import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiTokenScope, AuthUser, Role } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { verifySignedValue } from "../../lib/sessionCookie.js";

export const sessionCookieName = "lx_session";

export async function readAuthenticatedUser(request: FastifyRequest, services: Services): Promise<AuthUser | null> {
  const signed = request.cookies[sessionCookieName];
  const rawSessionId = verifySignedValue(signed, services.config.sessionSecret);
  if (rawSessionId) {
    const user = await services.authStore.getUserBySession(rawSessionId);
    if (user) {
      return user;
    }
  }
  const bearerToken = readBearerToken(request.headers.authorization);
  return bearerToken ? services.authStore.getUserByApiToken(bearerToken) : null;
}

export async function requireUser(request: FastifyRequest, reply: FastifyReply, services: Services): Promise<AuthUser | null> {
  const user = await readAuthenticatedUser(request, services);
  if (!user) {
    await reply.code(401).send({ message: "未登录或会话已过期。" });
    return null;
  }
  if (!hasRequiredTokenScope(user, request)) {
    await reply.code(403).send({ message: "API Token 缺少当前接口所需作用域。" });
    return null;
  }
  return user;
}

export async function requireRole(request: FastifyRequest, reply: FastifyReply, services: Services, role: Role): Promise<AuthUser | null> {
  const user = await requireUser(request, reply, services);
  if (!user) {
    return null;
  }
  if (roleRank(user.role) < roleRank(role)) {
    await reply.code(403).send({ message: "当前账号权限不足。" });
    return null;
  }
  return user;
}

function roleRank(role: Role): number {
  return role === "owner" ? 3 : role === "operator" ? 2 : 1;
}

function readBearerToken(authorization: string | undefined): string {
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
}

function hasRequiredTokenScope(user: AuthUser, request: FastifyRequest): boolean {
  if (!user.tokenScopes) {
    return true;
  }
  const requiredScope = requiredScopeForRequest(request);
  return requiredScope ? user.tokenScopes.includes(requiredScope) : false;
}

function requiredScopeForRequest(request: FastifyRequest): ApiTokenScope | null {
  const path = request.url.split("?")[0] ?? "";
  const write = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (path === "/api/auth/me") {
    return "system:read";
  }
  if (path.startsWith("/api/auth/")) {
    return null;
  }
  if (path === "/api/system/services/action") {
    return "system:write";
  }
  if (path.startsWith("/api/system")) {
    return "system:read";
  }
  if (path.startsWith("/api/files")) {
    return write ? "files:write" : "files:read";
  }
  if (path.startsWith("/api/logs")) {
    return "files:read";
  }
  if (path === "/api/docker/containers/action") {
    return "docker:write";
  }
  if (path.startsWith("/api/docker")) {
    return "docker:read";
  }
  if (path.startsWith("/api/tasks")) {
    return write ? "tasks:write" : "tasks:read";
  }
  if (path.startsWith("/api/backups")) {
    return write ? "backups:write" : "backups:read";
  }
  if (path.startsWith("/api/audit")) {
    return write ? "audit:write" : "audit:read";
  }
  if (path.startsWith("/api/security")) {
    return "security:read";
  }
  if (path.startsWith("/api/alerts")) {
    return write ? "alerts:write" : "alerts:read";
  }
  if (path.startsWith("/api/hosts")) {
    return write ? "hosts:write" : "hosts:read";
  }
  if (path.startsWith("/api/monitoring")) {
    return "alerts:read";
  }
  if (path.startsWith("/api/notifications")) {
    return write ? "notifications:write" : "notifications:read";
  }
  if (path.startsWith("/api/apps")) {
    return write ? "apps:write" : "apps:read";
  }
  if (path.startsWith("/api/connectors")) {
    return write ? "connectors:write" : "connectors:read";
  }
  if (path === "/api/users/me/password") {
    return null;
  }
  if (path.startsWith("/api/users")) {
    return "users:write";
  }
  return null;
}
