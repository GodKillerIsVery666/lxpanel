import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppConfig } from "../config/env.js";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function registerSecurityHeaders(app: FastifyInstance, config: AppConfig): void {
  app.addHook("onRequest", async (request, reply) => {
    if (!unsafeMethods.has(request.method)) {
      return;
    }
    if (!isAllowedBrowserWrite(request, config)) {
      await reply.code(403).send({ message: "跨站请求已被拒绝。" });
    }
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "same-origin");
    reply.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
    reply.header("content-security-policy", buildCsp(config));
    return payload;
  });
}

function isAllowedBrowserWrite(request: FastifyRequest, config: AppConfig): boolean {
  const origin = firstHeader(request.headers.origin);
  if (origin) {
    return isAllowedOrigin(origin, request, config);
  }
  const fetchSite = firstHeader(request.headers["sec-fetch-site"]);
  return fetchSite !== "cross-site";
}

function isAllowedOrigin(origin: string, request: FastifyRequest, config: AppConfig): boolean {
  if (config.allowedOrigins.includes(origin)) {
    return true;
  }
  return origin === requestOrigin(request);
}

function requestOrigin(request: FastifyRequest): string {
  const host = firstHeader(request.headers["x-forwarded-host"]) ?? firstHeader(request.headers.host) ?? "";
  const proto = firstHeader(request.headers["x-forwarded-proto"]) ?? "http";
  return host ? `${proto}://${host}` : "";
}

function buildCsp(config: AppConfig): string {
  const connectSources = ["'self'", ...config.allowedOrigins].join(" ");
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    `connect-src ${connectSources}`
  ].join("; ");
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
