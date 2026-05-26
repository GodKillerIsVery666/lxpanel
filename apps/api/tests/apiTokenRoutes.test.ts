import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CreatedApiTokenSchema } from "@lxpanel/shared";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { buildApp } from "../src/server.js";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lxpanel-api-token-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("API Token 路由", () => {
  it("允许 Bearer Token 调用受保护接口，但不允许用 Token 管理 Token", async () => {
    const dataDir = await createTempDir();
    const app = await buildApp(loadConfig({ LXPANEL_DATA_DIR: dataDir, LXPANEL_SESSION_SECRET: "test-secret-with-enough-length" }));

    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ username: "admin", password: "Admin-Password-2026" })
    });
    const cookie = setup.cookies.map((item) => `${item.name}=${item.value}`).join("; ");

    const createdResponse = await app.inject({
      method: "POST",
      url: "/api/auth/tokens",
      headers: { "content-type": "application/json", cookie },
      payload: JSON.stringify({ name: "ci", expiresInDays: 30 })
    });
    const created = CreatedApiTokenSchema.parse(createdResponse.json());

    const overview = await app.inject({
      method: "GET",
      url: "/api/system/overview",
      headers: { authorization: `Bearer ${created.secret}` }
    });
    const tokenList = await app.inject({
      method: "GET",
      url: "/api/auth/tokens",
      headers: { authorization: `Bearer ${created.secret}` }
    });

    expect(createdResponse.statusCode).toBe(200);
    expect(overview.statusCode).toBe(200);
    expect(tokenList.statusCode).toBe(401);
    await app.close();
  });
});
