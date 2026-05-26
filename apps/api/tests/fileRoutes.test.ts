import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileContentSchema } from "@lxpanel/shared";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { loadConfig } from "../src/config/env.js";
import { buildApp } from "../src/server.js";

const tempDirs: string[] = [];
const FileContentResponseSchema = z.object({ file: FileContentSchema });

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lxpanel-file-route-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("文件路由", () => {
  it("在受控根目录内写入、读取、建目录和删除", async () => {
    const dataDir = await createTempDir();
    const fileRoot = await createTempDir();
    const app = await buildApp(loadConfig({
      LXPANEL_DATA_DIR: dataDir,
      LXPANEL_FILE_ROOTS: fileRoot,
      LXPANEL_SESSION_SECRET: "test-secret-with-enough-length"
    }));

    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ username: "admin", password: "Admin-Password-2026" })
    });
    const cookie = setup.cookies.map((item) => `${item.name}=${item.value}`).join("; ");
    const filePath = join(fileRoot, "notes", "todo.txt");
    const directoryPath = join(fileRoot, "configs");

    const written = await app.inject({
      method: "PUT",
      url: "/api/files/content",
      headers: { "content-type": "application/json", cookie },
      payload: JSON.stringify({ path: filePath, content: "hello panel" })
    });
    const read = await app.inject({ method: "GET", url: `/api/files/content?path=${encodeURIComponent(filePath)}`, headers: { cookie } });
    const mkdir = await app.inject({
      method: "POST",
      url: "/api/files/directories",
      headers: { "content-type": "application/json", cookie },
      payload: JSON.stringify({ path: directoryPath })
    });
    const deleted = await app.inject({ method: "DELETE", url: `/api/files?path=${encodeURIComponent(filePath)}`, headers: { cookie } });

    expect(written.statusCode).toBe(200);
    expect(FileContentResponseSchema.parse(read.json()).file.content).toBe("hello panel");
    expect(mkdir.statusCode).toBe(200);
    await expect(access(directoryPath)).resolves.toBeUndefined();
    expect(deleted.statusCode).toBe(200);
    await expect(access(filePath)).rejects.toThrow();
    await app.close();
  });
});
