import { readdir, stat, open } from "node:fs/promises";
import { basename, join } from "node:path";
import type { FileEntry, LogRoot, LogTail } from "@lxpanel/shared";
import { resolveManagedPath } from "../files/pathGuard.js";

const maxReadBytes = 256 * 1024;
const defaultLineLimit = 300;

export function listLogRoots(roots: readonly string[]): LogRoot[] {
  return roots.map((root) => ({ path: root, label: basename(root) || root }));
}

export async function listLogEntries(inputPath: string | undefined, roots: readonly string[]): Promise<{ root: string; path: string; entries: FileEntry[] }> {
  const managedPath = resolveManagedPath(inputPath, roots);
  const entries = await readdir(managedPath.path, { withFileTypes: true });
  const files = await Promise.all(entries.slice(0, 500).map(async (entry): Promise<FileEntry> => {
    const fullPath = join(managedPath.path, entry.name);
    const info = await stat(fullPath);
    return {
      name: entry.name,
      path: fullPath,
      type: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other",
      sizeBytes: info.size,
      modifiedAt: info.mtime.toISOString()
    };
  }));
  files.sort((left, right) => left.type === right.type ? left.name.localeCompare(right.name) : left.type === "directory" ? -1 : 1);
  return { root: managedPath.root, path: managedPath.path, entries: files };
}

export async function tailLogFile(inputPath: string | undefined, roots: readonly string[], lineLimit = defaultLineLimit): Promise<LogTail> {
  const managedPath = resolveManagedPath(inputPath, roots);
  const info = await stat(managedPath.path);
  if (!info.isFile()) {
    throw new Error("日志路径不是文件。");
  }
  const safeLineLimit = Math.min(Math.max(lineLimit, 20), 1_000);
  const readBytes = Math.min(info.size, maxReadBytes);
  const start = Math.max(0, info.size - readBytes);
  const file = await open(managedPath.path, "r");
  try {
    const buffer = Buffer.alloc(readBytes);
    await file.read(buffer, 0, readBytes, start);
    const text = buffer.toString("utf8").replace(/^\uFEFF/u, "");
    const allLines = text.split(/\r?\n/u).filter((line, index, lines) => !(index === lines.length - 1 && line.length === 0));
    const lines = allLines.slice(-safeLineLimit);
    return {
      root: managedPath.root,
      path: managedPath.path,
      sizeBytes: info.size,
      modifiedAt: info.mtime.toISOString(),
      lines,
      truncated: info.size > readBytes || allLines.length > lines.length
    };
  } finally {
    await file.close();
  }
}
