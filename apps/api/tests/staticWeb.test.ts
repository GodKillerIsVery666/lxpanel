import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { buildApp } from "../src/server.js";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lxpanel-static-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("静态前端托管", () => {
  it("托管首页并为前端路由回退到 index.html", async () => {
    const dataDir = await createTempDir();
    const webRoot = await createTempDir();
    await mkdir(webRoot, { recursive: true });
    await writeFile(join(webRoot, "index.html"), "<html><body>LXPanel</body></html>", "utf8");

    const app = await buildApp(loadConfig({
      LXPANEL_DATA_DIR: dataDir,
      LXPANEL_WEB_ROOT: webRoot,
      LXPANEL_SESSION_SECRET: "test-secret-with-enough-length"
    }));

    const index = await app.inject({ method: "GET", url: "/" });
    const route = await app.inject({ method: "GET", url: "/security" });
    const apiMiss = await app.inject({ method: "GET", url: "/api/not-found" });

    expect(index.body).toContain("LXPanel");
    expect(route.body).toContain("LXPanel");
    expect(apiMiss.statusCode).toBe(404);
    await app.close();
  });
});
