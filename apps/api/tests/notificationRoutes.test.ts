import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NotificationSecretRotationResultSchema } from "@lxpanel/shared";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { loadConfig } from "../src/config/env.js";
import { buildApp } from "../src/server.js";

const tempDirs: string[] = [];
const RotationResponseSchema = z.object({ result: NotificationSecretRotationResultSchema });

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lxpanel-notification-route-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("通知路由", () => {
  it("owner 可以触发通知密钥迁移并获得结构化结果", async () => {
    const dataDir = await createTempDir();
    const app = await buildApp(loadConfig({ LXPANEL_DATA_DIR: dataDir, LXPANEL_SESSION_SECRET: "test-secret-with-enough-length" }));

    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ username: "admin", password: "Admin-Password-2026" })
    });
    const cookie = setup.cookies.map((item) => `${item.name}=${item.value}`).join("; ");

    await app.inject({
      method: "POST",
      url: "/api/notifications",
      headers: { "content-type": "application/json", cookie },
      payload: JSON.stringify({ name: "ops", type: "webhook", url: "https://hooks.example.com/token/secret", enabled: true, minLevel: "warning" })
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/notifications/rotate-secret",
      headers: { "content-type": "application/json", cookie },
      payload: JSON.stringify({})
    });
    const result = RotationResponseSchema.parse(response.json()).result;

    expect(response.statusCode).toBe(200);
    expect(result).toMatchObject({ total: 1, alreadyCurrent: 1, failed: 0 });
    await app.close();
  });
});
