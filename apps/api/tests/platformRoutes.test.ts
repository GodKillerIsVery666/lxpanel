import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { AccessEvaluationSchema, CapacityPlanSchema, FrontendQualityReportSchema, InstallerGuideSchema, LicenseStatusSchema, OpenApiSummarySchema, ResourceApprovalPolicySchema, SecurityRemediationRunSchema, StateArchiveResultSchema, TemplateRepositorySchema, TerminalSessionSchema } from "@lxpanel/shared";
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
    const connectorResponse = await app.inject({ method: "POST", url: "/api/connectors", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ name: "edge-a", capabilities: ["terminal"] }) });
    const connectorId = z.object({ connector: z.object({ id: z.string() }) }).parse(JSON.parse(connectorResponse.body) as unknown).connector.id;
    const hostResponse = await app.inject({ method: "POST", url: "/api/hosts", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ name: "node-a", address: "10.0.0.2", tags: ["prod"], connectorId }) });
    const hostId = z.object({ host: z.object({ id: z.string() }) }).parse(JSON.parse(hostResponse.body) as unknown).host.id;
    const terminalResponse = await app.inject({ method: "POST", url: "/api/platform/terminal-sessions", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ hostId, username: "root" }) });
    const terminalInputResponse = await app.inject({ method: "POST", url: "/api/platform/terminal-sessions/input", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ sessionId: z.object({ session: TerminalSessionSchema }).parse(JSON.parse(terminalResponse.body) as unknown).session.id, input: "uptime" }) });
    const repositoryResponse = await app.inject({ method: "POST", url: "/api/platform/template-repositories", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ name: "private", url: "https://templates.example.com/index.json", trustMode: "signed", enabled: true }) });
    const repositoryId = z.object({ repository: TemplateRepositorySchema }).parse(JSON.parse(repositoryResponse.body) as unknown).repository.id;
    const syncResponse = await app.inject({ method: "POST", url: "/api/platform/template-repositories/sync", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ repositoryId }) });
    const licenseResponse = await app.inject({ method: "PUT", url: "/api/platform/license", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ plan: "team", licensedTo: "Acme", maxHosts: 20, maxUsers: 10, maxApps: 30, features: ["terminal"] }) });
    const approvalPolicyResponse = await app.inject({ method: "POST", url: "/api/platform/approval-policies", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ resourceType: "host", resourceId: hostId, action: "host.batch_command", requiredApprovals: 2, enabled: true }) });
    const archiveResponse = await app.inject({ method: "POST", url: "/api/platform/archive-state", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ dryRun: true, keepMetricSamples: 100, keepAlertEvents: 50 }) });
    const installerResponse = await app.inject({ method: "GET", url: "/api/platform/installer-guide", headers: { cookie } });
    const sdkResponse = await app.inject({ method: "GET", url: "/api/platform/sdk-examples", headers: { cookie } });
    const qualityResponse = await app.inject({ method: "GET", url: "/api/platform/frontend-quality", headers: { cookie } });
    const capacityResponse = await app.inject({ method: "GET", url: "/api/platform/capacity-plan", headers: { cookie } });
    const openApiResponse = await app.inject({ method: "GET", url: "/api/platform/openapi-summary", headers: { cookie } });
    const integrityResponse = await app.inject({ method: "GET", url: "/api/audit/integrity", headers: { cookie } });

    const evaluationBody = z.object({ evaluation: AccessEvaluationSchema }).parse(JSON.parse(evaluationResponse.body) as unknown);
    const remediationBody = z.object({ run: SecurityRemediationRunSchema }).parse(JSON.parse(remediationResponse.body) as unknown);
    const capacityBody = z.object({ plan: CapacityPlanSchema }).parse(JSON.parse(capacityResponse.body) as unknown);
    const openApiBody = z.object({ summary: OpenApiSummarySchema }).parse(JSON.parse(openApiResponse.body) as unknown);
    const terminalBody = z.object({ session: TerminalSessionSchema }).parse(JSON.parse(terminalInputResponse.body) as unknown);
    const syncBody = z.object({ repository: TemplateRepositorySchema }).parse(JSON.parse(syncResponse.body) as unknown);
    const licenseBody = z.object({ status: LicenseStatusSchema }).parse(JSON.parse(licenseResponse.body) as unknown);
    const approvalPolicyBody = z.object({ policy: ResourceApprovalPolicySchema }).parse(JSON.parse(approvalPolicyResponse.body) as unknown);
    const archiveBody = z.object({ result: StateArchiveResultSchema }).parse(JSON.parse(archiveResponse.body) as unknown);
    const installerBody = z.object({ guide: InstallerGuideSchema }).parse(JSON.parse(installerResponse.body) as unknown);
    const sdkBody = z.object({ examples: z.array(z.object({ id: z.string() })) }).parse(JSON.parse(sdkResponse.body) as unknown);
    const qualityBody = z.object({ report: FrontendQualityReportSchema }).parse(JSON.parse(qualityResponse.body) as unknown);

    expect(policyResponse.statusCode).toBe(200);
    expect(evaluationBody.evaluation.allowed).toBe(true);
    expect(remediationBody.run.status).toBe("planned");
    expect(capacityBody.plan.recommendations.length).toBeGreaterThan(0);
    expect(openApiBody.summary.webhookEvents).toContain("approval.requested");
    expect(terminalBody.session.transcriptTail.some((line) => line.line === "uptime")).toBe(true);
    expect(syncBody.repository.lastStatus).toBe("success");
    expect(licenseBody.status.license.licensedTo).toBe("Acme");
    expect(approvalPolicyBody.policy.requiredApprovals).toBe(2);
    expect(archiveBody.result.dryRun).toBe(true);
    expect(installerBody.guide.steps.length).toBeGreaterThan(0);
    expect(sdkBody.examples.length).toBeGreaterThan(0);
    expect(qualityBody.report.locale).toBe("zh-CN");
    expect(integrityResponse.statusCode).toBe(200);
    await app.close();
  });
});
