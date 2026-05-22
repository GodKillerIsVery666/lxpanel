import { access } from "node:fs/promises";
import { join } from "node:path";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config/env.js";

export async function registerStaticWeb(app: FastifyInstance, config: AppConfig): Promise<void> {
  const indexPath = join(config.webRoot, "index.html");
  try {
    await access(indexPath);
  } catch {
    app.log.warn({ webRoot: config.webRoot }, "web static root not found, skip frontend hosting");
    return;
  }

  await app.register(fastifyStatic, {
    root: config.webRoot,
    prefix: "/",
    decorateReply: true
  });

  app.setNotFoundHandler((request, reply) => {
    if ((request.method === "GET" || request.method === "HEAD") && !request.url.startsWith("/api/")) {
      return reply.sendFile("index.html");
    }
    return reply.code(404).send({ message: "资源不存在。" });
  });
}
