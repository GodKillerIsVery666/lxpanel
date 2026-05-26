import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SecurityHardeningPlanSchema, SecurityPostureSchema } from "@lxpanel/shared";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { loadConfig } from "../src/config/env.js";
import { buildApp } from "../src/server.js";

const tempDirs: string[] = [];
const SecurityResponseSchema = z.object({ posture: SecurityPostureSchema });
const HardeningResponseSchema = z.object({ plan: SecurityHardeningPlanSchema });

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lxpanel-security-route-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("安全态势路由", () => {
  it("返回结构化安全巡检项和建议", async () => {
    const dataDir = await createTempDir();
    const app = await buildApp(loadConfig({ LXPANEL_DATA_DIR: dataDir, LXPANEL_SESSION_SECRET: "dev-change-me-lxpanel-session-secret-32-bytes" }));

    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ username: "admin", password: "Admin-Password-2026" })
    });
    const cookie = setup.cookies.map((item) => `${item.name}=${item.value}`).join("; ");
    await app.inject({
      method: "POST",
      url: "/api/auth/tokens",
      headers: { "content-type": "application/json", cookie },
      payload: JSON.stringify({ name: "soon-expiring", expiresInDays: 1, scopes: ["system:read"] })
    });
    const response = await app.inject({ method: "GET", url: "/api/security/posture", headers: { cookie } });
    const posture = SecurityResponseSchema.parse(response.json()).posture;

    expect(response.statusCode).toBe(200);
    expect(posture.checks.some((check) => check.id === "session-secret" && check.status === "critical")).toBe(true);
    expect(posture.checks.some((check) => check.id === "api-token-expiry" && check.status === "warn")).toBe(true);
    expect(posture.recommendations.length).toBeGreaterThan(0);
    await app.close();
  });

  it("返回防火墙、SSH 和 Docker 加固计划", async () => {
    const dataDir = await createTempDir();
    const app = await buildApp(loadConfig({ LXPANEL_DATA_DIR: dataDir, LXPANEL_SESSION_SECRET: "production-grade-session-secret-32-bytes", LXPANEL_IP_ALLOWLIST: "127.0.0.1" }));

    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ username: "admin", password: "Admin-Password-2026" })
    });
    const cookie = setup.cookies.map((item) => `${item.name}=${item.value}`).join("; ");
    const response = await app.inject({ method: "GET", url: "/api/security/hardening-plan", headers: { cookie } });
    const plan = HardeningResponseSchema.parse(response.json()).plan;

    expect(response.statusCode).toBe(200);
    expect(plan.items.map((item) => item.id)).toEqual(expect.arrayContaining(["firewall-management-network", "ssh-disable-password", "docker-socket-boundary"]));
    expect(plan.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
    await app.close();
  });
});
