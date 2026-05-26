import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BackupSnapshotSchema } from "@lxpanel/shared";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { loadConfig } from "../src/config/env.js";
import { buildApp } from "../src/server.js";

const tempDirs: string[] = [];
const BackupResponseSchema = z.object({ backup: BackupSnapshotSchema });

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lxpanel-backup-route-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("备份路由", () => {
  it("恢复备份必须携带服务端确认短语", async () => {
    const dataDir = await createTempDir();
    const app = await buildApp(loadConfig({ LXPANEL_DATA_DIR: dataDir, LXPANEL_SESSION_SECRET: "test-secret-with-enough-length" }));

    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ username: "admin", password: "Admin-Password-2026" })
    });
    const cookie = setup.cookies.map((item) => `${item.name}=${item.value}`).join("; ");

    const createdResponse = await app.inject({ method: "POST", url: "/api/backups", headers: { cookie } });
    const backup = BackupResponseSchema.parse(createdResponse.json()).backup;

    const missingConfirmation = await app.inject({
      method: "POST",
      url: "/api/backups/restore",
      headers: { "content-type": "application/json", cookie },
      payload: JSON.stringify({ backupId: backup.id })
    });
    const restored = await app.inject({
      method: "POST",
      url: "/api/backups/restore",
      headers: { "content-type": "application/json", cookie },
      payload: JSON.stringify({ backupId: backup.id, confirmation: "RESTORE" })
    });

    expect(createdResponse.statusCode).toBe(200);
    expect(missingConfirmation.statusCode).toBe(400);
    expect(restored.statusCode).toBe(200);
    await app.close();
  });
});
