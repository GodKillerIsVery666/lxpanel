import type { FastifyInstance } from "fastify";
import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { createHash } from "node:crypto";
import { z } from "zod";
import { AccessEvaluationRequestSchema, AiDiagnosticRequestSchema, AuditRetentionEvaluationRequestSchema, AuditRetentionExecutionRequestSchema, ConnectorUpgradeRequestSchema, CreateAccessPolicySchema, CreateAuditRetentionPolicySchema, CreateFederatedClusterSchema, CreateResourceApprovalPolicySchema, CreateTemplateRepositorySchema, CreateTerminalSessionSchema, CreateWorkspaceSchema, GenerateLicenseSchema, PluginPermissionEvaluationRequestSchema, PluginSandboxRunRequestSchema, RegisterPluginManifestSchema, ResourceApprovalCheckSchema, SecurityRemediationRequestSchema, StateArchiveRequestSchema, TerminalInputSchema, TerminalOutputSchema, UpdateBackupEncryptionPolicySchema, UpdateConnectorReleaseChannelSchema, UpdateIdentityProviderSchema, UpdateLicenseSchema } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { sendApprovalError } from "../approvals/approvalRoutes.js";
import { requireRole, requireUser, sessionCookieName } from "../auth/authMiddleware.js";
import { verifySignedValue } from "../../lib/sessionCookie.js";

export function registerPlatformRoutes(app: FastifyInstance, services: Services): void {
  const terminalSockets = new Map<string, Set<Socket>>();
  attachTerminalWebSocket(app, services, terminalSockets);
  attachAuditStreamWebSocket(app, services);

  app.get("/api/platform/access-policies", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { policies: await services.platformStore.listAccessPolicies() };
  });

  app.post("/api/platform/access-policies", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = CreateAccessPolicySchema.parse(request.body);
    const policy = await services.platformStore.createAccessPolicy(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.access_policy.create", target: `${policy.workspace}:${policy.resourceType}:${policy.resourceId}`, ip: request.ip, status: "success" });
    return { policy };
  });

  app.post("/api/platform/access-evaluate", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const input = AccessEvaluationRequestSchema.parse(request.body);
    return { evaluation: await services.platformStore.evaluateAccess(input) };
  });

  app.get("/api/platform/terminal-sessions", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    return { sessions: await services.platformStore.listTerminalSessions() };
  });

  app.get<{ Querystring: { sessionId?: string } }>("/api/platform/terminal-sessions/replay", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const sessionId = request.query.sessionId ?? "";
    if (!sessionId) {
      await reply.code(400).send({ message: "缺少终端会话 ID。" });
      return;
    }
    const replay = await services.platformStore.terminalReplay(sessionId);
    if (!replay) {
      await reply.code(404).send({ message: "终端会话不存在。" });
      return;
    }
    await services.auditLog.append({ actor: user.username, action: "platform.terminal.replay", target: sessionId, ip: request.ip, status: "success" });
    return { replay };
  });

  app.post("/api/platform/terminal-sessions", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = CreateTerminalSessionSchema.parse(request.body);
    const target = (await services.hostService.resolveCommandTargets([input.hostId]))[0];
    if (!target) {
      await reply.code(404).send({ message: "主机不存在。" });
      return;
    }
    const destination = `${input.username ? `${input.username}@` : ""}${target.host.address ?? target.host.name}`;
    const command = await services.connectorStore.createCommand({ connectorId: target.connectorId, command: "terminal.open", args: [destination, String(input.rows), String(input.cols)] }, user.username);
    const session = await services.platformStore.createTerminalSession(input, target.host.name, target.connectorId, command.id, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.terminal.open", target: target.host.name, ip: request.ip, status: "success" });
    return { session, command };
  });

  app.post("/api/platform/terminal-sessions/input", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = TerminalInputSchema.parse(request.body);
    const session = await services.platformStore.terminalSession(input.sessionId);
    if (!session) {
      await reply.code(404).send({ message: "终端会话不存在。" });
      return;
    }
    const command = await services.connectorStore.createCommand({ connectorId: session.connectorId, command: "terminal.input", args: [session.id, input.input] }, user.username);
    const updated = await services.platformStore.appendTerminalInput(input, command.id);
    await services.auditLog.append({ actor: user.username, action: "platform.terminal.input", target: session.hostName, ip: request.ip, status: "success" });
    return { session: updated, command };
  });

  app.post("/api/platform/terminal-sessions/output", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = TerminalOutputSchema.parse(request.body);
    const session = await services.platformStore.appendTerminalOutput(input);
    broadcastTerminalFrame(terminalSockets, session.id, { type: "output", session });
    await services.auditLog.append({ actor: user.username, action: "platform.terminal.output", target: session.hostName, ip: request.ip, status: "success" });
    return { session };
  });

  app.post("/api/platform/terminal-sessions/close", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = z.object({ sessionId: z.string().min(1) }).parse(request.body);
    const session = await services.platformStore.terminalSession(input.sessionId);
    if (!session) {
      await reply.code(404).send({ message: "终端会话不存在。" });
      return;
    }
    const command = await services.connectorStore.createCommand({ connectorId: session.connectorId, command: "terminal.close", args: [session.id] }, user.username);
    const updated = await services.platformStore.closeTerminalSession(session.id);
    await services.auditLog.append({ actor: user.username, action: "platform.terminal.close", target: session.hostName, ip: request.ip, status: "success" });
    return { session: updated, command };
  });

  app.get("/api/platform/template-repositories", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    return { repositories: await services.platformStore.listTemplateRepositories() };
  });

  app.post("/api/platform/template-repositories", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = CreateTemplateRepositorySchema.parse(request.body);
    const repository = await services.platformStore.createTemplateRepository(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.template_repository.create", target: repository.name, ip: request.ip, status: "success" });
    return { repository };
  });

  app.post("/api/platform/template-repositories/sync", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = z.object({ repositoryId: z.string().min(1) }).parse(request.body);
    const repository = await services.platformStore.syncTemplateRepository(input.repositoryId, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.template_repository.sync", target: repository.name, ip: request.ip, status: repository.lastStatus === "success" ? "success" : "error" });
    return { repository };
  });

  app.post("/api/platform/template-repositories/rollback", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = z.object({ repositoryId: z.string().min(1) }).parse(request.body);
    const rollback = await services.platformStore.rollbackTemplateRepository(input.repositoryId, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.template_repository.rollback", target: rollback.repository.name, ip: request.ip, status: "success", detail: `templates=${rollback.restoredTemplateIds.length}` });
    return { rollback };
  });

  app.get("/api/platform/workspaces", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { overview: await services.platformStore.workspaceOverview() };
  });

  app.post("/api/platform/workspaces", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = CreateWorkspaceSchema.parse(request.body);
    const workspace = await services.platformStore.createWorkspace(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.workspace.create", target: workspace.id, ip: request.ip, status: "success" });
    return { workspace };
  });

  app.get<{ Querystring: { workspace?: string; from?: string; to?: string } }>("/api/platform/tenant-report", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const workspace = request.query.workspace || "default";
    const auditEvents = await services.auditLog.list({ limit: 5000 });
    const report = await services.platformStore.tenantReport({ workspace, ...(request.query.from ? { from: request.query.from } : {}), ...(request.query.to ? { to: request.query.to } : {}) }, auditEvents);
    await services.auditLog.append({ actor: user.username, action: "platform.tenant_report.export", target: workspace, ip: request.ip, status: "success", detail: `events=${report.counts.auditEvents}` });
    return { report };
  });

  app.get("/api/platform/connectors/version-policy", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    return { policy: await services.connectorStore.versionPolicy() };
  });

  app.post("/api/platform/connectors/upgrade", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = ConnectorUpgradeRequestSchema.parse(request.body);
    const plan = await services.connectorStore.scheduleUpgrade(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.connector.upgrade", target: input.connectorId ?? input.channel, ip: request.ip, status: "success", detail: `selected=${plan.selected.length};target=${plan.targetVersion}` });
    return { plan };
  });

  app.get("/api/platform/identity-provider", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { provider: await services.platformStore.identityProvider() };
  });

  app.put("/api/platform/identity-provider", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = UpdateIdentityProviderSchema.parse(request.body);
    const provider = await services.platformStore.updateIdentityProvider(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.identity_provider.update", target: provider.name, ip: request.ip, status: "success", detail: `enabled=${provider.enabled};mfa=${provider.requireMfa}` });
    return { provider };
  });

  app.get("/api/platform/sso-readiness", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { readiness: await services.platformStore.ssoReadiness() };
  });

  app.get("/api/platform/connectors/release-channels", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    return { channels: await services.platformStore.connectorReleaseChannels() };
  });

  app.put("/api/platform/connectors/release-channels", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = UpdateConnectorReleaseChannelSchema.parse(request.body);
    const channel = await services.platformStore.updateConnectorReleaseChannel(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.connector_release.update", target: channel.name, ip: request.ip, status: "success", detail: `version=${channel.version};artifacts=${channel.artifacts.length}` });
    return { channel };
  });

  app.get("/api/platform/connectors/release-manifest", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    return { manifest: await services.platformStore.connectorReleaseManifest() };
  });

  app.get("/api/platform/backup-encryption", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { policy: await services.platformStore.backupEncryptionPolicy() };
  });

  app.put("/api/platform/backup-encryption", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = UpdateBackupEncryptionPolicySchema.parse(request.body);
    const policy = await services.platformStore.updateBackupEncryptionPolicy(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.backup_encryption.update", target: policy.keyRef, ip: request.ip, status: "success", detail: `enabled=${policy.enabled};rotate=${policy.rotateEveryDays}` });
    return { policy };
  });

  app.get("/api/platform/backup-encryption/rotation-plan", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { plan: await services.platformStore.backupKeyRotationPlan() };
  });

  app.post("/api/platform/backup-encryption/rotate", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const policy = await services.platformStore.rotateBackupEncryptionKey(user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.backup_encryption.rotate", target: policy.keyRef, ip: request.ip, status: "success", detail: `keyVersion=${policy.keyVersion}` });
    return { policy };
  });

  app.get("/api/platform/audit-retention-policies", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { policies: await services.platformStore.auditRetentionPolicies() };
  });

  app.post("/api/platform/audit-retention-policies", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = CreateAuditRetentionPolicySchema.parse(request.body);
    const policy = await services.platformStore.createAuditRetentionPolicy(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.audit_retention.create", target: `${policy.workspace}:${policy.eventType}`, ip: request.ip, status: "success", detail: `retainDays=${policy.retainDays}` });
    return { policy };
  });

  app.post("/api/platform/audit-retention-policies/evaluate", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = AuditRetentionEvaluationRequestSchema.parse(request.body ?? {});
    const evaluation = await services.platformStore.evaluateAuditRetention(input);
    return { evaluation };
  });

  app.post("/api/platform/audit-retention-policies/execute", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = AuditRetentionExecutionRequestSchema.parse(request.body ?? {});
    const events = await services.auditLog.list({ limit: 5000, ...(input.eventType !== "*" ? { action: input.eventType } : {}) });
    const eventCount = events.filter((event) => input.workspace === "default" || event.target.startsWith(`${input.workspace}:`) || event.detail?.includes(`workspace=${input.workspace}`) === true).length;
    const evaluation = await services.platformStore.evaluateAuditRetention({ workspace: input.workspace, eventType: input.eventType, eventCount });
    const archivePackage = evaluation.archiveBeforeDelete && !evaluation.legalHold ? await services.auditLog.exportSignedPackage({ format: "jsonl", ...(input.eventType !== "*" ? { action: input.eventType } : {}) }) : undefined;
    let approval: Awaited<ReturnType<typeof services.approvalStore.request>> | undefined;
    let pruneResult: Awaited<ReturnType<typeof services.auditLog.prune>> | undefined;
    if (!input.dryRun && !evaluation.legalHold) {
      if (input.approvalId) {
        try {
          await services.approvalStore.consume({ approvalId: input.approvalId, action: "audit.prune", target: `${evaluation.retainDays}d`, actor: user.username });
        } catch (error) {
          if (await sendApprovalError(reply, error)) {
            return;
          }
          throw error;
        }
        pruneResult = await services.auditLog.prune(evaluation.retainDays);
      } else {
        approval = await services.approvalStore.request({ action: "audit.prune", target: `${evaluation.retainDays}d`, reason: `audit retention ${input.workspace}/${input.eventType}`, requiredApprovals: 1, expiresInMinutes: 120 }, user.username);
      }
    }
    const execution = await services.platformStore.auditRetentionExecution(input, eventCount, archivePackage, approval, pruneResult);
    await services.auditLog.append({ actor: user.username, action: "platform.audit_retention.execute", target: `${input.workspace}:${input.eventType}`, ip: request.ip, status: execution.status === "executed" || execution.status === "planned" ? "success" : "denied", detail: `status=${execution.status};events=${eventCount}` });
    return { execution };
  });

  app.post("/api/platform/audit-archive-remote", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const body = (request.body ?? {}) as Record<string, unknown>;
    const format = body.format === "jsonl" ? "jsonl" as const : "jsonl" as const;
    const auditPackage = await services.auditLog.exportSignedPackage({ format });
    if (!auditPackage) {
      await reply.code(404).send({ message: "无审计数据可归档。" });
      return;
    }
    const fileName = `audit-${auditPackage.manifest.generatedAt.replace(/[:.]/gu, "-")}.jsonl`;
    const content = JSON.stringify(auditPackage);
    const results = await services.platformStore.archiveAuditToRemote({ fileName, content });
    await services.auditLog.append({ actor: user.username, action: "platform.audit_archive_remote", target: "remote-backup", ip: request.ip, status: results.some((r) => r.status === "success") ? "success" : "error", detail: `targets=${results.length};ok=${results.filter((r) => r.status === "success").length}` });
    return { results };
  });

  app.get("/api/platform/plugins", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    return { plugins: await services.platformStore.pluginManifests() };
  });

  app.post("/api/platform/plugins", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = RegisterPluginManifestSchema.parse(request.body);
    const plugin = await services.platformStore.registerPluginManifest(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.plugin.register", target: plugin.id, ip: request.ip, status: "success", detail: `scopes=${plugin.permissions.join(",")}` });
    return { plugin };
  });

  app.post("/api/platform/plugins/sync-remote", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const body = (request.body ?? {}) as Record<string, unknown>;
    const url = typeof body.url === "string" ? body.url : "";
    const trustMode = body.trustMode === "signed" ? "signed" as const : "internal" as const;
    const publicKey = typeof body.publicKey === "string" ? body.publicKey : undefined;
    if (!url) {
      await reply.code(400).send({ message: "缺少远程插件 URL。" });
      return;
    }
    const plugin = await services.platformStore.syncPluginManifest(url, trustMode, user.username, publicKey);
    await services.auditLog.append({ actor: user.username, action: "platform.plugin.sync_remote", target: plugin.id, ip: request.ip, status: "success", detail: `url=${url};trustMode=${trustMode}` });
    return { plugin };
  });

  app.post("/api/platform/plugins/evaluate", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = PluginPermissionEvaluationRequestSchema.parse(request.body);
    const evaluation = await services.platformStore.evaluatePluginPermissions(input);
    await services.auditLog.append({ actor: user.username, action: "platform.plugin.evaluate", target: input.pluginId, ip: request.ip, status: evaluation.allowed ? "success" : "denied", detail: evaluation.detail });
    return { evaluation };
  });

  app.post("/api/platform/plugins/sandbox-run", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = PluginSandboxRunRequestSchema.parse(request.body ?? {});
    const run = await services.platformStore.runPluginSandbox(input);
    await services.auditLog.append({ actor: user.username, action: "platform.plugin.sandbox_run", target: input.pluginId, ip: request.ip, status: run.status === "success" ? "success" : "denied", detail: `operation=${run.operation};scopes=${run.grantedScopes.join(",")}` });
    return { run };
  });

  app.get("/api/platform/high-availability-plan", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { plan: await services.platformStore.highAvailabilityPlan() };
  });

  app.get("/api/platform/client-application-plan", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { plan: services.platformStore.clientApplicationPlan() };
  });

  app.get("/api/platform/federated-clusters", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) return;
    return { clusters: await services.platformStore.listFederatedClusters() };
  });

  app.post("/api/platform/federated-clusters", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) return;
    const input = CreateFederatedClusterSchema.parse(request.body);
    const cluster = await services.platformStore.createFederatedCluster(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.federated_cluster.create", target: cluster.name, ip: request.ip, status: "success" });
    return { cluster };
  });

  app.post("/api/platform/federated-clusters/sync", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) return;
    const body = (request.body ?? {}) as Record<string, unknown>;
    const clusterId = typeof body.clusterId === "string" ? body.clusterId : "";
    if (!clusterId) { await reply.code(400).send({ message: "缺少 clusterId。" }); return; }
    const cluster = await services.platformStore.syncFederatedCluster(clusterId);
    await services.auditLog.append({ actor: user.username, action: "platform.federated_cluster.sync", target: clusterId, ip: request.ip, status: cluster.status === "online" ? "success" : "error" });
    return { cluster };
  });

  app.post("/api/platform/ai-diagnostic", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) return;
    const input = AiDiagnosticRequestSchema.parse(request.body);
    const result = await services.platformStore.aiDiagnostic(input);
    await services.auditLog.append({ actor: user.username, action: "platform.ai_diagnostic", target: input.context, ip: request.ip, status: "success" });
    return { result };
  });

  app.get("/api/platform/license", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { status: await services.platformStore.licenseStatus() };
  });

  app.put("/api/platform/license", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = UpdateLicenseSchema.parse(request.body);
    const status = await services.platformStore.updateLicense(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.license.update", target: status.license.plan, ip: request.ip, status: "success" });
    return { status };
  });

  app.post("/api/platform/license/verify", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = UpdateLicenseSchema.parse(request.body);
    const result = services.platformStore.verifyLicense(input);
    await services.auditLog.append({ actor: user.username, action: "platform.license.verify", target: input.licensedTo, ip: request.ip, status: result.ok ? "success" : "error", detail: result.error ?? result.machineCode });
    return { result };
  });

  app.post("/api/platform/license/generate", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = GenerateLicenseSchema.parse(request.body);
    const result = services.platformStore.generateLicense(input);
    await services.auditLog.append({ actor: user.username, action: "platform.license.generate", target: input.licensedTo, ip: request.ip, status: "success", detail: `plan=${input.plan}` });
    return { result };
  });

  app.get("/api/platform/approval-policies", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { policies: await services.platformStore.listApprovalPolicies() };
  });

  app.post("/api/platform/approval-policies", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = CreateResourceApprovalPolicySchema.parse(request.body);
    const policy = await services.platformStore.createApprovalPolicy(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.approval_policy.create", target: `${policy.resourceType}:${policy.resourceId}`, ip: request.ip, status: "success" });
    return { policy };
  });

  app.post("/api/platform/approval-policies/check", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = ResourceApprovalCheckSchema.parse(request.body);
    const precheck = await services.platformStore.approvalPrecheck(input);
    await services.auditLog.append({ actor: user.username, action: "platform.approval_policy.check", target: precheck.target, ip: request.ip, status: "success", detail: precheck.required ? `required=${precheck.requiredApprovals}` : "not-required" });
    return { precheck };
  });

  app.get("/api/platform/remediations", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    return { runs: await services.platformStore.remediationRuns() };
  });

  app.post("/api/platform/remediations", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = SecurityRemediationRequestSchema.parse(request.body);
    if (!input.dryRun) {
      try {
        await services.approvalStore.consume({ approvalId: input.approvalId ?? "", action: "security.remediate", target: input.itemId, actor: user.username });
      } catch (error) {
        if (await sendApprovalError(reply, error)) {
          return;
        }
        throw error;
      }
    }
    const run = await services.platformStore.createRemediationRun(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "security.remediation", target: input.itemId, ip: request.ip, status: run.status === "failed" ? "error" : "success", detail: run.outputTail });
    return { run };
  });

  app.get("/api/platform/capacity-plan", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { plan: await services.platformStore.capacityPlan() };
  });

  app.get("/api/platform/upgrade-plan", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { plan: await services.platformStore.upgradePlan() };
  });

  app.get("/api/platform/delivery-checklist", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { checklist: await services.platformStore.deliveryChecklist() };
  });

  app.get("/api/platform/openapi-summary", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { summary: services.platformStore.openApiSummary() };
  });

  app.get("/api/platform/openapi.json", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return services.platformStore.openApiDocument();
  });

  app.post("/api/platform/archive-state", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = StateArchiveRequestSchema.parse(request.body ?? {});
    const result = await services.platformStore.archiveState(input);
    await services.auditLog.append({ actor: user.username, action: "platform.archive_state", target: input.dryRun ? "dry-run" : "apply", ip: request.ip, status: "success", detail: `before=${result.beforeBytes};after=${result.afterBytes}` });
    return { result };
  });

  app.get<{ Querystring: { bucket?: string; limit?: string } }>("/api/platform/archive-records", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const limit = request.query.limit ? Number.parseInt(request.query.limit, 10) : undefined;
    const query: { bucket?: string; limit?: number } = {};
    if (request.query.bucket) {
      query.bucket = request.query.bucket;
    }
    if (typeof limit === "number" && Number.isFinite(limit)) {
      query.limit = limit;
    }
    const page = await services.platformStore.archiveRecords(query);
    return { page };
  });

  app.get("/api/platform/installer-guide", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { guide: services.platformStore.installerGuide() };
  });

  app.get("/api/platform/sdk-examples", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { examples: services.platformStore.sdkExamples() };
  });

  app.get("/api/platform/frontend-quality", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { report: services.platformStore.frontendQualityReport() };
  });

  app.get("/api/platform/diagnostics-bundle", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const bundle = await services.platformStore.diagnosticsBundle();
    await services.auditLog.append({ actor: user.username, action: "platform.diagnostics_bundle", target: bundle.sha256, ip: request.ip, status: "success" });
    return { bundle };
  });
}

function attachTerminalWebSocket(app: FastifyInstance, services: Services, sockets: Map<string, Set<Socket>>): void {
  app.server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/api/platform/terminal-sessions/ws") {
      return;
    }
    const tcpSocket = socket as Socket;
    void handleTerminalUpgrade(services, sockets, request, tcpSocket, head, url).catch((error: unknown) => {
      closeUpgrade(tcpSocket, 500, error instanceof Error ? error.message : String(error));
    });
  });
}

/** 每会话最大 WebSocket 连接数 */
const maxWsConnectionsPerSession = 10;
/** 全局最大 WebSocket 连接数 */
const maxWsTotalConnections = 500;

async function handleTerminalUpgrade(services: Services, sockets: Map<string, Set<Socket>>, request: IncomingMessage, socket: Socket, _head: Buffer, url: URL): Promise<void> {
  const user = await readUpgradeUser(request, services);
  if (!user || roleRank(user.role) < roleRank("operator") || !hasPlatformReadScope(user)) {
    closeUpgrade(socket, 401, "unauthorized");
    return;
  }
  // 全局连接数限制
  let totalConnections = 0;
  for (const bucket of sockets.values()) {
    totalConnections += bucket.size;
  }
  if (totalConnections >= maxWsTotalConnections) {
    closeUpgrade(socket, 503, "too many websocket connections");
    return;
  }
  const sessionId = url.searchParams.get("sessionId") ?? "";
  const session = await services.platformStore.terminalSession(sessionId);
  if (!session) {
    closeUpgrade(socket, 404, "terminal session not found");
    return;
  }
  // 每会话连接数限制
  const existingBucket = sockets.get(session.id);
  if (existingBucket && existingBucket.size >= maxWsConnectionsPerSession) {
    closeUpgrade(socket, 429, "too many connections for this session");
    return;
  }
  const key = request.headers["sec-websocket-key"];
  if (typeof key !== "string") {
    closeUpgrade(socket, 400, "missing websocket key");
    return;
  }
  const accept = createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "",
    ""
  ].join("\r\n"));
  const bucket = sockets.get(session.id) ?? new Set<Socket>();
  bucket.add(socket);
  sockets.set(session.id, bucket);
  sendWebSocketJson(socket, { type: "snapshot", session });
  socket.on("data", (chunk) => {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    void handleTerminalSocketInput(services, user.username, session.id, buffer).catch((error: unknown) => {
      sendWebSocketJson(socket, { type: "error", message: error instanceof Error ? error.message : String(error) });
    });
  });
  socket.on("close", () => bucket.delete(socket));
  socket.on("error", () => bucket.delete(socket));
}

async function handleTerminalSocketInput(services: Services, actor: string, sessionId: string, chunk: Buffer): Promise<void> {
  for (const input of parseClientTextFrames(chunk)) {
    if (!input) {
      continue;
    }
    const session = await services.platformStore.terminalSession(sessionId);
    if (!session || session.status === "closed") {
      return;
    }
    const command = await services.connectorStore.createCommand({ connectorId: session.connectorId, command: "terminal.input", args: [session.id, input] }, actor);
    await services.platformStore.appendTerminalInput({ sessionId: session.id, input }, command.id);
  }
}

function broadcastTerminalFrame(sockets: Map<string, Set<Socket>>, sessionId: string, payload: object): void {
  for (const socket of sockets.get(sessionId) ?? []) {
    sendWebSocketJson(socket, payload);
  }
}

function sendWebSocketJson(socket: Socket, payload: object): void {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const header = body.length < 126 ? Buffer.from([0x81, body.length]) : Buffer.from([0x81, 126, body.length >> 8, body.length & 0xff]);
  socket.write(Buffer.concat([header, body]));
}

function parseClientTextFrames(chunk: Buffer): string[] {
  const messages: string[] = [];
  let offset = 0;
  while (offset + 2 <= chunk.length) {
    const first = chunk.readUInt8(offset);
    const second = chunk.readUInt8(offset + 1);
    const opcode = first & 0x0f;
    const masked = (second & 0x80) === 0x80;
    let length = second & 0x7f;
    offset += 2;
    if (length === 126) {
      if (offset + 2 > chunk.length) {
        break;
      }
      length = chunk.readUInt16BE(offset);
      offset += 2;
    }
    if (length === 127 || !masked || offset + 4 + length > chunk.length) {
      break;
    }
    const mask = chunk.subarray(offset, offset + 4);
    offset += 4;
    const payload = Buffer.alloc(length);
    for (let index = 0; index < length; index += 1) {
      payload[index] = chunk.readUInt8(offset + index) ^ (mask[index % 4] ?? 0);
    }
    offset += length;
    if (opcode === 0x1) {
      messages.push(payload.toString("utf8"));
    }
  }
  return messages;
}

/** 审计实时流式导出 WebSocket */
function attachAuditStreamWebSocket(app: FastifyInstance, services: Services): void {
  const auditSockets = new Set<Socket>();
  // 注册审计事件回调
  const unsubscribe = services.auditLog.onEvent((event) => {
    const body = Buffer.from(JSON.stringify({ type: "audit", event }), "utf8");
    const header = body.length < 126 ? Buffer.from([0x81, body.length]) : Buffer.from([0x81, 126, body.length >> 8, body.length & 0xff]);
    const frame = Buffer.concat([header, body]);
    for (const socket of auditSockets) {
      try { socket.write(frame); } catch { auditSockets.delete(socket); }
    }
  });

  app.server.on("upgrade", (request, socket, _head) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/api/platform/audit-stream/ws") {
      return;
    }
    const tcpSocket = socket as Socket;
    void (async () => {
      const user = await readUpgradeUser(request, services);
      if (!user || roleRank(user.role) < roleRank("operator")) {
        closeUpgrade(tcpSocket, 401, "unauthorized");
        return;
      }
      const key = request.headers["sec-websocket-key"];
      if (typeof key !== "string") {
        closeUpgrade(tcpSocket, 400, "missing websocket key");
        return;
      }
      const accept = createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
      tcpSocket.write([
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${accept}`,
        "", ""
      ].join("\r\n"));
      auditSockets.add(tcpSocket);
      tcpSocket.on("close", () => auditSockets.delete(tcpSocket));
      tcpSocket.on("error", () => auditSockets.delete(tcpSocket));
    })();
  });

  app.addHook("onClose", () => { unsubscribe(); });
}

async function readUpgradeUser(request: IncomingMessage, services: Services) {
  const sessionId = verifySignedValue(readCookie(request.headers.cookie, sessionCookieName), services.config.sessionSecret);
  if (sessionId) {
    const user = await services.authStore.getUserBySession(sessionId);
    if (user) {
      return user;
    }
  }
  const authorization = request.headers.authorization;
  const token = typeof authorization === "string" && authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  return token ? services.authStore.getUserByApiToken(token) : null;
}

function readCookie(header: string | undefined, name: string): string | undefined {
  return header?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1);
}

function roleRank(role: "owner" | "operator" | "viewer"): number {
  return role === "owner" ? 3 : role === "operator" ? 2 : 1;
}

function hasPlatformReadScope(user: { tokenScopes?: readonly string[] | undefined }): boolean {
  return !user.tokenScopes || user.tokenScopes.includes("platform:read") || user.tokenScopes.includes("platform:write");
}

function closeUpgrade(socket: Socket, status: number, message: string): void {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}
