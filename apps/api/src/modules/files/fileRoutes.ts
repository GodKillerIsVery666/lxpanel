import { mkdir, open, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FastifyInstance } from "fastify";
import { CreateDirectoryRequestSchema, DeleteFileRequestSchema, FileReadRequestSchema, FileWriteRequestSchema, type FileContent, type FileEntry } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { requireRole, requireUser } from "../auth/authMiddleware.js";
import { resolveManagedPath } from "./pathGuard.js";

interface FilesQuery {
  path?: string;
}

const maxTextFileBytes = 524_288;

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

  app.get<{ Querystring: FilesQuery }>("/api/files/content", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const input = FileReadRequestSchema.parse(request.query);
    const managedPath = resolveManagedPath(input.path, services.config.fileRoots);
    try {
      return { file: await readTextFile(managedPath.path) };
    } catch (error) {
      console.error("[files] 读取文件失败", error);
      await reply.code(400).send({ message: "读取文件失败。" });
    }
  });

  app.put("/api/files/content", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = FileWriteRequestSchema.parse(request.body);
    const managedPath = resolveManagedPath(input.path, services.config.fileRoots);
    await mkdir(dirname(managedPath.path), { recursive: true });
    await writeFile(managedPath.path, input.content, "utf8");
    const file = await readTextFile(managedPath.path);
    await services.auditLog.append({ actor: user.username, action: "file.write", target: managedPath.path, ip: request.ip, status: "success" });
    return { file };
  });

  app.post("/api/files/directories", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = CreateDirectoryRequestSchema.parse(request.body);
    const managedPath = resolveManagedPath(input.path, services.config.fileRoots);
    await mkdir(managedPath.path, { recursive: true });
    await services.auditLog.append({ actor: user.username, action: "file.mkdir", target: managedPath.path, ip: request.ip, status: "success" });
    return { ok: true };
  });

  app.delete<{ Querystring: FilesQuery }>("/api/files", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = DeleteFileRequestSchema.parse(request.query);
    const managedPath = resolveManagedPath(input.path, services.config.fileRoots);
    if (managedPath.path === managedPath.root) {
      await reply.code(400).send({ message: "不能删除管理根目录。" });
      return;
    }
    await rm(managedPath.path, { recursive: true, force: false });
    await services.auditLog.append({ actor: user.username, action: "file.delete", target: managedPath.path, ip: request.ip, status: "success" });
    return { ok: true };
  });
}

async function readTextFile(path: string): Promise<FileContent> {
  const info = await stat(path);
  if (!info.isFile()) {
    throw new Error("目标不是文件。");
  }
  const readBytes = Math.min(info.size, maxTextFileBytes);
  const buffer = Buffer.alloc(readBytes);
  const handle = await open(path, "r");
  try {
    await handle.read(buffer, 0, readBytes, 0);
  } finally {
    await handle.close();
  }
  return {
    path,
    sizeBytes: info.size,
    modifiedAt: info.mtime.toISOString(),
    content: buffer.toString("utf8"),
    truncated: info.size > readBytes
  };
}
