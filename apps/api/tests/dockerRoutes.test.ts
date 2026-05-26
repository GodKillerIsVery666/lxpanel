import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { buildApp } from "../src/server.js";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lxpanel-docker-route-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("Docker 路由", () => {
  it("拒绝 viewer 执行容器动作", async () => {
    const dataDir = await createTempDir();
    const app = await buildApp(loadConfig({ LXPANEL_DATA_DIR: dataDir, LXPANEL_SESSION_SECRET: "test-secret-with-enough-length" }));

    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ username: "admin", password: "Admin-Password-2026" })
    });
    const ownerCookie = setup.cookies.map((item) => `${item.name}=${item.value}`).join("; ");

    await app.inject({
      method: "POST",
      url: "/api/users",
      headers: { "content-type": "application/json", cookie: ownerCookie },
      payload: JSON.stringify({ username: "viewer", password: "Viewer-Password-2026", role: "viewer" })
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ username: "viewer", password: "Viewer-Password-2026" })
    });
    const viewerCookie = login.cookies.map((item) => `${item.name}=${item.value}`).join("; ");

    const denied = await app.inject({
      method: "POST",
      url: "/api/docker/containers/action",
      headers: { "content-type": "application/json", cookie: viewerCookie },
      payload: JSON.stringify({ id: "container-1", action: "restart" })
    });

    expect(denied.statusCode).toBe(403);
    await app.close();
  });
});
