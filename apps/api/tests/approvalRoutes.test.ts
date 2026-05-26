import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { loadConfig } from "../src/config/env.js";
import { buildApp } from "../src/server.js";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lxpanel-approval-route-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("审批路由", () => {
  it("审计清理必须消费已批准审批单", async () => {
    const dataDir = await createTempDir();
    const app = await buildApp(loadConfig({ LXPANEL_DATA_DIR: dataDir, LXPANEL_SESSION_SECRET: "test-secret-with-enough-length" }));
    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ username: "admin", password: "Admin-Password-2026" })
    });
    const cookie = setup.cookies.map((item) => `${item.name}=${item.value}`).join("; ");

    const blocked = await app.inject({ method: "DELETE", url: "/api/audit?retainDays=30", headers: { cookie } });
    const created = await app.inject({
      method: "POST",
      url: "/api/approvals",
      headers: { "content-type": "application/json", cookie },
      payload: JSON.stringify({ action: "audit.prune", target: "30d", reason: "retention cleanup", expiresInMinutes: 30 })
    });
    const approvalId = z.object({ approval: z.object({ id: z.string() }) }).parse(created.json()).approval.id;
    await app.inject({
      method: "POST",
      url: "/api/approvals/approve",
      headers: { "content-type": "application/json", cookie },
      payload: JSON.stringify({ approvalId })
    });
    const pruned = await app.inject({ method: "DELETE", url: `/api/audit?retainDays=30&approvalId=${approvalId}`, headers: { cookie } });
    const reused = await app.inject({ method: "DELETE", url: `/api/audit?retainDays=30&approvalId=${approvalId}`, headers: { cookie } });

    expect(blocked.statusCode).toBe(400);
    expect(created.statusCode).toBe(200);
    expect(pruned.statusCode).toBe(200);
    expect(reused.statusCode).toBe(400);
    await app.close();
  });
});
