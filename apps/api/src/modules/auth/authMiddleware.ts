import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthUser, Role } from "@lxpanel/shared";
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
