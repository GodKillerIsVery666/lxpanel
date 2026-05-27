import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { AccessEvaluationSchema, CapacityPlanSchema, FrontendQualityReportSchema, InstallerGuideSchema, LicenseStatusSchema, OpenApiSummarySchema, ResourceApprovalPolicySchema, SecurityRemediationRunSchema, StateArchiveResultSchema, TemplateRepositorySchema, TerminalSessionSchema, WorkspaceOverviewSchema } from "@lxpanel/shared";
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
    const terminalSessionId = z.object({ session: TerminalSessionSchema }).parse(JSON.parse(terminalResponse.body) as unknown).session.id;
    const terminalInputResponse = await app.inject({ method: "POST", url: "/api/platform/terminal-sessions/input", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ sessionId: terminalSessionId, input: "uptime" }) });
    const terminalOutputResponse = await app.inject({ method: "POST", url: "/api/platform/terminal-sessions/output", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ sessionId: terminalSessionId, output: "load average: ok" }) });
    const templateIndex = { version: "1", templates: [{ id: "demo", name: "Demo", category: "Web", description: "Demo template", image: "nginx:alpine", verified: true, variables: [], compose: "services:\n  demo:\n    image: nginx:alpine\n" }] };
    const repositoryUrl = `data:application/json,${encodeURIComponent(JSON.stringify(templateIndex))}`;
    const repositoryResponse = await app.inject({ method: "POST", url: "/api/platform/template-repositories", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ name: "private", url: repositoryUrl, trustMode: "internal", enabled: true }) });
    const repositoryId = z.object({ repository: TemplateRepositorySchema }).parse(JSON.parse(repositoryResponse.body) as unknown).repository.id;
    const syncResponse = await app.inject({ method: "POST", url: "/api/platform/template-repositories/sync", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ repositoryId }) });
    const workspaceCreateResponse = await app.inject({ method: "POST", url: "/api/platform/workspaces", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ id: "tenant-a", name: "Tenant A" }) });
    const workspaceResponse = await app.inject({ method: "GET", url: "/api/platform/workspaces", headers: { cookie } });
    const licenseResponse = await app.inject({ method: "PUT", url: "/api/platform/license", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ plan: "team", licensedTo: "Acme", maxHosts: 20, maxUsers: 10, maxApps: 30, features: ["terminal"] }) });
    const licenseVerifyResponse = await app.inject({ method: "POST", url: "/api/platform/license/verify", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ plan: "team", licensedTo: "Acme", maxHosts: 20, maxUsers: 10, maxApps: 30, features: ["terminal"], offlineToken: "bad.token", publicKey: "bad-key" }) });
    const approvalPolicyResponse = await app.inject({ method: "POST", url: "/api/platform/approval-policies", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ workspace: "default", resourceType: "host", resourceId: hostId, action: "host.batch_command", requiredApprovals: 1, enabled: true }) });
    const deniedBatchResponse = await app.inject({ method: "POST", url: "/api/hosts/batch-command", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ workspace: "default", hostIds: [hostId], command: "uptime", args: [] }) });
    const approvalRequestResponse = await app.inject({ method: "POST", url: "/api/approvals", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ action: "resource.access", target: `default:host:${hostId}:host.batch_command`, reason: "batch command", requiredApprovals: 1 }) });
    const approvalId = z.object({ approval: z.object({ id: z.string() }) }).parse(JSON.parse(approvalRequestResponse.body) as unknown).approval.id;
    await app.inject({ method: "POST", url: "/api/approvals/approve", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ approvalId }) });
    const approvedBatchResponse = await app.inject({ method: "POST", url: "/api/hosts/batch-command", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ workspace: "default", hostIds: [hostId], command: "uptime", args: [], approvalId }) });
    const archiveResponse = await app.inject({ method: "POST", url: "/api/platform/archive-state", headers: { "content-type": "application/json", cookie }, payload: JSON.stringify({ dryRun: true, keepMetricSamples: 100, keepAlertEvents: 50 }) });
    const installerResponse = await app.inject({ method: "GET", url: "/api/platform/installer-guide", headers: { cookie } });
    const sdkResponse = await app.inject({ method: "GET", url: "/api/platform/sdk-examples", headers: { cookie } });
    const qualityResponse = await app.inject({ method: "GET", url: "/api/platform/frontend-quality", headers: { cookie } });
    const capacityResponse = await app.inject({ method: "GET", url: "/api/platform/capacity-plan", headers: { cookie } });
    const openApiResponse = await app.inject({ method: "GET", url: "/api/platform/openapi-summary", headers: { cookie } });
    const openApiJsonResponse = await app.inject({ method: "GET", url: "/api/platform/openapi.json", headers: { cookie } });
    const integrityResponse = await app.inject({ method: "GET", url: "/api/audit/integrity", headers: { cookie } });

    const evaluationBody = z.object({ evaluation: AccessEvaluationSchema }).parse(JSON.parse(evaluationResponse.body) as unknown);
    const remediationBody = z.object({ run: SecurityRemediationRunSchema }).parse(JSON.parse(remediationResponse.body) as unknown);
    const capacityBody = z.object({ plan: CapacityPlanSchema }).parse(JSON.parse(capacityResponse.body) as unknown);
    const openApiBody = z.object({ summary: OpenApiSummarySchema }).parse(JSON.parse(openApiResponse.body) as unknown);
    const terminalBody = z.object({ session: TerminalSessionSchema }).parse(JSON.parse(terminalInputResponse.body) as unknown);
    const terminalOutputBody = z.object({ session: TerminalSessionSchema }).parse(JSON.parse(terminalOutputResponse.body) as unknown);
    const syncBody = z.object({ repository: TemplateRepositorySchema }).parse(JSON.parse(syncResponse.body) as unknown);
    const licenseBody = z.object({ status: LicenseStatusSchema }).parse(JSON.parse(licenseResponse.body) as unknown);
    const workspaceBody = z.object({ overview: WorkspaceOverviewSchema }).parse(JSON.parse(workspaceResponse.body) as unknown);
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
    expect(openApiJsonResponse.statusCode).toBe(200);
    expect(terminalBody.session.transcriptTail.some((line) => line.line === "uptime")).toBe(true);
    expect(terminalOutputBody.session.transcriptTail.some((line) => line.line.includes("load average"))).toBe(true);
    expect(syncBody.repository.lastStatus).toBe("success");
    expect(syncBody.repository.templateCount).toBe(1);
    expect(workspaceCreateResponse.statusCode).toBe(200);
    expect(workspaceBody.overview.workspaces.some((workspace) => workspace.id === "tenant-a")).toBe(true);
    expect(licenseBody.status.license.licensedTo).toBe("Acme");
    expect(licenseVerifyResponse.statusCode).toBe(200);
    expect(approvalPolicyBody.policy.requiredApprovals).toBe(1);
    expect(deniedBatchResponse.statusCode).toBe(400);
    expect(approvedBatchResponse.statusCode).toBe(200);
    expect(archiveBody.result.dryRun).toBe(true);
    expect(installerBody.guide.steps.length).toBeGreaterThan(0);
    expect(sdkBody.examples.length).toBeGreaterThan(0);
    expect(qualityBody.report.locale).toBe("zh-CN");
    expect(integrityResponse.statusCode).toBe(200);
    await app.close();
  });
});
