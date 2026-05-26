import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { AccessEvaluationSchema, CapacityPlanSchema, OpenApiSummarySchema, SecurityRemediationRunSchema } from "@lxpanel/shared";
import { loadConfig } from "../src/config/env.js";
import { buildApp } from "../src/server.js";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lxpanel-platform-route-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("平台治理路由", () => {
  it("提供访问策略、安全修复、容量和开放 API 摘要", async () => {
    const dataDir = await createTempDir();
    const app = await buildApp(loadConfig({ LXPANEL_DATA_DIR: dataDir, LXPANEL_SESSION_SECRET: "platform-session-secret-32-bytes" }));
    const setup = await app.inject({ method: "POST", url: "/api/auth/setup", headers: { "content-type": "application/json" }, payload: JSON.stringify({ username: "admin", password: "Admin-Password-2026" }) });
    const cookie = setup.cookies.map((item) => `${item.name}=${item.value}`).join("; ");

    const policyResponse = await app.inject({ method: "POST", url: "/api/platform/access-policies", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ workspace: "default", resourceType: "host", resourceId: "*", role: "operator", permissions: ["read", "write"] }) });
    const evaluationResponse = await app.inject({ method: "POST", url: "/api/platform/access-evaluate", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ workspace: "default", resourceType: "host", resourceId: "node-1", role: "operator", permission: "write" }) });
    const remediationResponse = await app.inject({ method: "POST", url: "/api/platform/remediations", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ itemId: "ssh-disable-password", dryRun: true }) });
    const capacityResponse = await app.inject({ method: "GET", url: "/api/platform/capacity-plan", headers: { cookie } });
    const openApiResponse = await app.inject({ method: "GET", url: "/api/platform/openapi-summary", headers: { cookie } });
    const integrityResponse = await app.inject({ method: "GET", url: "/api/audit/integrity", headers: { cookie } });

    const evaluationBody = z.object({ evaluation: AccessEvaluationSchema }).parse(JSON.parse(evaluationResponse.body) as unknown);
    const remediationBody = z.object({ run: SecurityRemediationRunSchema }).parse(JSON.parse(remediationResponse.body) as unknown);
    const capacityBody = z.object({ plan: CapacityPlanSchema }).parse(JSON.parse(capacityResponse.body) as unknown);
    const openApiBody = z.object({ summary: OpenApiSummarySchema }).parse(JSON.parse(openApiResponse.body) as unknown);

    expect(policyResponse.statusCode).toBe(200);
    expect(evaluationBody.evaluation.allowed).toBe(true);
    expect(remediationBody.run.status).toBe("planned");
    expect(capacityBody.plan.recommendations.length).toBeGreaterThan(0);
    expect(openApiBody.summary.webhookEvents).toContain("approval.requested");
    expect(integrityResponse.statusCode).toBe(200);
    await app.close();
  });
});
