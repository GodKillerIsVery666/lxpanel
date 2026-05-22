import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import type { FileEntry } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { requireUser } from "../auth/authMiddleware.js";
import { resolveManagedPath } from "./pathGuard.js";

interface FilesQuery {
  path?: string;
}

export function registerFileRoutes(app: FastifyInstance, services: Services): void {
  app.get<{ Querystring: FilesQuery }>("/api/files", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const managedPath = resolveManagedPath(request.query.path, services.config.fileRoots);
    try {
      const entries = await readdir(managedPath.path, { withFileTypes: true });
      const files = await Promise.all(entries.slice(0, 500).map(async (entry): Promise<FileEntry> => {
        const fullPath = join(managedPath.path, entry.name);
        const info = await stat(fullPath);
        const type = entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other";
        return {
          name: entry.name,
          path: fullPath,
          type,
          sizeBytes: info.size,
          modifiedAt: info.mtime.toISOString()
        };
      }));
      files.sort((left, right) => left.type === right.type ? left.name.localeCompare(right.name) : left.type === "directory" ? -1 : 1);
      return { root: managedPath.root, path: managedPath.path, entries: files };
    } catch (error) {
      console.error("[files] 读取目录失败", error);
      await reply.code(500).send({ message: "读取目录失败。" });
    }
  });
}
