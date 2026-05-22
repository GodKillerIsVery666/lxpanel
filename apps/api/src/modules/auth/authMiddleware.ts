import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthUser } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { verifySignedValue } from "../../lib/sessionCookie.js";

export const sessionCookieName = "lx_session";

export async function readAuthenticatedUser(request: FastifyRequest, services: Services): Promise<AuthUser | null> {
  const signed = request.cookies[sessionCookieName];
  const rawSessionId = verifySignedValue(signed, services.config.sessionSecret);
  if (!rawSessionId) {
    return null;
  }
  return services.authStore.getUserBySession(rawSessionId);
}

export async function requireUser(request: FastifyRequest, reply: FastifyReply, services: Services): Promise<AuthUser | null> {
  const user = await readAuthenticatedUser(request, services);
  if (!user) {
    await reply.code(401).send({ message: "未登录或会话已过期。" });
    return null;
  }
  return user;
}
