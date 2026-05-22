import type { FastifyInstance } from "fastify";
import type { Services } from "../../server.js";
import { requireUser } from "../auth/authMiddleware.js";
import { listLogEntries, listLogRoots, tailLogFile } from "./logService.js";

interface LogsQuery {
  path?: string;
  lines?: string;
}

export function registerLogRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/logs/roots", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { roots: listLogRoots(services.config.logRoots) };
  });

  app.get<{ Querystring: LogsQuery }>("/api/logs/files", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    try {
      return await listLogEntries(request.query.path, services.config.logRoots);
    } catch (error) {
      console.error("[logs] 读取日志目录失败", error);
      await reply.code(500).send({ message: error instanceof Error ? error.message : "读取日志目录失败。" });
    }
  });

  app.get<{ Querystring: LogsQuery }>("/api/logs/tail", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const lineLimit = request.query.lines ? Number.parseInt(request.query.lines, 10) : undefined;
    try {
      return { tail: await tailLogFile(request.query.path, services.config.logRoots, Number.isInteger(lineLimit) ? lineLimit : undefined) };
    } catch (error) {
      console.error("[logs] 读取日志文件失败", error);
      await reply.code(500).send({ message: error instanceof Error ? error.message : "读取日志文件失败。" });
    }
  });
}
