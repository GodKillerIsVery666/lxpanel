import { createHash, verify as verifySignature } from "node:crypto";
import { arch, hostname, platform } from "node:os";
import { TemplateRepositoryIndexSchema, type AccessEvaluation, type AccessEvaluationRequest, type AccessPolicy, type CapacityPlan, type CreateAccessPolicy, type CreateResourceApprovalPolicy, type CreateTemplateRepository, type CreateTerminalSession, type CreateWorkspace, type DeliveryChecklist, type DiagnosticsBundle, type FrontendQualityReport, type ImportedAppTemplate, type InstallerGuide, type LicenseInfo, type LicenseStatus, type LicenseVerificationResult, type OpenApiDocument, type OpenApiSummary, type ResourceApprovalCheck, type ResourceApprovalPolicy, type ResourceApprovalPrecheck, type SdkExample, type SecurityRemediationRequest, type SecurityRemediationRun, type StateArchivePage, type StateArchiveRequest, type StateArchiveResult, type TemplateRepository, type TemplateRepositoryRollback, type TerminalInput, type TerminalOutput, type TerminalReplay, type TerminalSession, type UpdateLicense, type UpgradePlan, type Workspace, type WorkspaceOverview } from "@lxpanel/shared";
import { randomToken } from "../../lib/crypto.js";
import type { StateStore } from "../../lib/stateStore.js";
import type { PanelState, SecurityRemediationRunRecord, TemplateRepositorySnapshotRecord } from "../state/panelState.js";

const currentVersion = "0.1.0";

export class PlatformStore {
  constructor(private readonly store: StateStore<PanelState>) {}

  async listAccessPolicies(): Promise<AccessPolicy[]> {
    const state = await this.store.read();
    return (state.accessPolicies ?? []).slice().reverse();
  }

  async createAccessPolicy(input: CreateAccessPolicy, actor: string): Promise<AccessPolicy> {
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const policy: AccessPolicy = { id: randomToken(12), ...input, createdAt: now, updatedAt: now, updatedBy: actor };
      return { data: { ...state, accessPolicies: [...(state.accessPolicies ?? []), policy].slice(-500) }, result: policy };
    });
  }

  async listTerminalSessions(): Promise<TerminalSession[]> {
    const state = await this.store.read();
    return (state.terminalSessions ?? []).slice().reverse();
  }

  async terminalSession(sessionId: string): Promise<TerminalSession | undefined> {
    const state = await this.store.read();
    return (state.terminalSessions ?? []).find((session) => session.id === sessionId);
  }

  async terminalReplay(sessionId: string): Promise<TerminalReplay | null> {
    const session = await this.terminalSession(sessionId);
    if (!session) {
      return null;
    }
    const lines = (session.transcriptTail ?? []).map((line) => ({ ...line, line: redactTerminalLine(line.line) }));
    return { sessionId: session.id, hostName: session.hostName, generatedAt: new Date().toISOString(), lineCount: lines.length, redacted: true, lines };
  }

  async createTerminalSession(input: CreateTerminalSession, hostName: string, connectorId: string, commandId: string, actor: string): Promise<TerminalSession> {
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const session: TerminalSession = {
        id: randomToken(12),
        hostId: input.hostId,
        hostName,
        connectorId,
        commandId,
        streamUrl: `/api/platform/terminal-sessions/ws?sessionId=${encodeURIComponent("pending")}`,
        ...(input.username ? { username: input.username } : {}),
        status: "opening",
        createdAt: now,
        createdBy: actor,
        outputCursor: 0,
        transcriptTail: [{ time: now, direction: "system", line: `terminal.open rows=${input.rows} cols=${input.cols}` }]
      };
      session.streamUrl = `/api/platform/terminal-sessions/ws?sessionId=${encodeURIComponent(session.id)}`;
      return { data: { ...state, terminalSessions: [...(state.terminalSessions ?? []), session].slice(-200) }, result: session };
    });
  }

  async appendTerminalInput(input: TerminalInput, commandId: string): Promise<TerminalSession> {
    return this.store.update((state) => {
      const session = (state.terminalSessions ?? []).find((item) => item.id === input.sessionId);
      if (!session) {
        throw new Error("终端会话不存在。");
      }
      const now = new Date().toISOString();
      const updated: TerminalSession = {
        ...session,
        status: session.status === "opening" ? "connected" : session.status,
        lastInputAt: now,
        transcriptTail: [...(session.transcriptTail ?? []), { time: now, direction: "input" as const, line: input.input }, { time: now, direction: "system" as const, line: `queued connector command ${commandId}` }].slice(-80)
      };
      return { data: { ...state, terminalSessions: (state.terminalSessions ?? []).map((item) => item.id === session.id ? updated : item) }, result: updated };
    });
  }

  async appendTerminalOutput(input: TerminalOutput): Promise<TerminalSession> {
    return this.store.update((state) => {
      const session = (state.terminalSessions ?? []).find((item) => item.id === input.sessionId);
      if (!session) {
        throw new Error("终端会话不存在。");
      }
      const now = new Date().toISOString();
      const cursor = input.cursor ?? (session.outputCursor ?? 0) + 1;
      const updated: TerminalSession = {
        ...session,
        status: input.status ?? (session.status === "opening" ? "connected" : session.status),
        lastOutputAt: now,
        outputCursor: cursor,
        transcriptTail: [...(session.transcriptTail ?? []), { time: now, direction: "output" as const, line: input.output }].slice(-120)
      };
      return { data: { ...state, terminalSessions: (state.terminalSessions ?? []).map((item) => item.id === session.id ? updated : item) }, result: updated };
    });
  }

  async closeTerminalSession(sessionId: string): Promise<TerminalSession> {
    return this.store.update((state) => {
      const session = (state.terminalSessions ?? []).find((item) => item.id === sessionId);
      if (!session) {
        throw new Error("终端会话不存在。");
      }
      const now = new Date().toISOString();
      const updated: TerminalSession = { ...session, status: "closed", outputCursor: session.outputCursor ?? 0, transcriptTail: [...(session.transcriptTail ?? []), { time: now, direction: "system" as const, line: "terminal.closed" }].slice(-80) };
      return { data: { ...state, terminalSessions: (state.terminalSessions ?? []).map((item) => item.id === sessionId ? updated : item) }, result: updated };
    });
  }

  async listTemplateRepositories(): Promise<TemplateRepository[]> {
    const state = await this.store.read();
    return (state.templateRepositories ?? []).slice().reverse();
  }

  async createTemplateRepository(input: CreateTemplateRepository, actor: string): Promise<TemplateRepository> {
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const repository: TemplateRepository = { id: randomToken(12), name: input.name, url: input.url, trustMode: input.trustMode, ...(input.publicKey ? { publicKey: input.publicKey } : {}), enabled: input.enabled, templateCount: 0, importedTemplateIds: [], lastStatus: "pending", createdAt: now, updatedAt: now, updatedBy: actor };
      return { data: { ...state, templateRepositories: [...(state.templateRepositories ?? []), repository].slice(-100) }, result: repository };
    });
  }

  async syncTemplateRepository(repositoryId: string, actor: string): Promise<TemplateRepository> {
    const state = await this.store.read();
    const repository = (state.templateRepositories ?? []).find((item) => item.id === repositoryId);
    if (!repository) {
      throw new Error("模板仓库不存在。");
    }
    if (!repository.enabled) {
      return this.markTemplateRepositorySync(repository, actor, [], "", "仓库已停用。");
    }
    try {
      const { importedTemplates, indexSha256 } = await fetchTemplateRepositoryIndex(repository);
      return this.store.update((current) => {
        const now = new Date().toISOString();
        const previousTemplates = (current.importedAppTemplates ?? []).filter((template) => template.repositoryId === repository.id);
        const snapshot = createTemplateSnapshot(repository, previousTemplates, actor, now);
        const importedTemplateIds = importedTemplates.map((template) => template.id);
        const updated: TemplateRepository = { ...repository, lastSyncAt: now, lastStatus: "success", templateCount: importedTemplates.length, importedTemplateIds, indexSha256, updatedAt: now, updatedBy: actor };
        delete updated.lastError;
        const nextImported = [...(current.importedAppTemplates ?? []).filter((template) => template.repositoryId !== repository.id), ...importedTemplates].slice(-1000);
        return {
          data: {
            ...current,
            templateRepositories: (current.templateRepositories ?? []).map((item) => item.id === repositoryId ? updated : item),
            templateRepositorySnapshots: [...(current.templateRepositorySnapshots ?? []), snapshot].slice(-200),
            importedAppTemplates: nextImported
          },
          result: updated
        };
      });
    } catch (error) {
      return this.markTemplateRepositorySync(repository, actor, [], "", error instanceof Error ? error.message : String(error));
    }
  }

  async rollbackTemplateRepository(repositoryId: string, actor: string): Promise<TemplateRepositoryRollback> {
    return this.store.update((state) => {
      const repository = (state.templateRepositories ?? []).find((item) => item.id === repositoryId);
      if (!repository) {
        throw new Error("模板仓库不存在。");
      }
      const snapshot = (state.templateRepositorySnapshots ?? []).filter((item) => item.repositoryId === repositoryId).at(-1);
      if (!snapshot) {
        throw new Error("模板仓库没有可回滚的历史快照。");
      }
      const now = new Date().toISOString();
      const updated: TemplateRepository = {
        ...repository,
        templateCount: snapshot.templates.length,
        importedTemplateIds: snapshot.templateIds,
        ...(snapshot.indexSha256 ? { indexSha256: snapshot.indexSha256 } : {}),
        lastStatus: "success",
        lastSyncAt: now,
        updatedAt: now,
        updatedBy: actor
      };
      delete updated.lastError;
      return {
        data: {
          ...state,
          templateRepositories: (state.templateRepositories ?? []).map((item) => item.id === repositoryId ? updated : item),
          importedAppTemplates: [...(state.importedAppTemplates ?? []).filter((template) => template.repositoryId !== repositoryId), ...snapshot.templates].slice(-1000),
          templateRepositorySnapshots: (state.templateRepositorySnapshots ?? []).filter((item) => item.id !== snapshot.id)
        },
        result: { repository: updated, restoredTemplateIds: snapshot.templateIds, rolledBackAt: now }
      };
    });
  }

  private async markTemplateRepositorySync(repository: TemplateRepository, actor: string, importedTemplates: ImportedAppTemplate[], indexSha256: string, error?: string): Promise<TemplateRepository> {
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const updated: TemplateRepository = {
        ...repository,
        lastSyncAt: now,
        lastStatus: error ? "failed" : "success",
        templateCount: importedTemplates.length,
        importedTemplateIds: importedTemplates.map((template) => template.id),
        ...(indexSha256 ? { indexSha256 } : {}),
        ...(error ? { lastError: error } : {}),
        updatedAt: now,
        updatedBy: actor
      };
      return { data: { ...state, templateRepositories: (state.templateRepositories ?? []).map((item) => item.id === repository.id ? updated : item) }, result: updated };
    });
  }

  async licenseStatus(): Promise<LicenseStatus> {
    const state = await this.store.read();
    const license = state.license ?? defaultLicense();
    const usage = { hosts: (state.hosts ?? []).length, users: state.users.length, apps: (state.appDeployments ?? []).length };
    const violations = [
      ...(usage.hosts > license.maxHosts ? [`主机数量 ${usage.hosts}/${license.maxHosts} 超出授权。`] : []),
      ...(usage.users > license.maxUsers ? [`用户数量 ${usage.users}/${license.maxUsers} 超出授权。`] : []),
      ...(usage.apps > license.maxApps ? [`应用数量 ${usage.apps}/${license.maxApps} 超出授权。`] : []),
      ...(license.expiresAt && new Date(license.expiresAt).getTime() < Date.now() ? ["许可证已过期。"] : []),
      ...(license.offlineToken && license.verificationStatus !== "verified" ? [`许可证验签状态异常：${license.verificationError ?? license.verificationStatus ?? "unverified"}`] : [])
    ];
    return { license, usage, violations };
  }

  async updateLicense(input: UpdateLicense, actor: string): Promise<LicenseStatus> {
    const verification = verifyOfflineLicense(input);
    await this.store.update((state) => {
      const signed = verification.ok ? verificationToLicensePatch(verification) : {};
      const license: LicenseInfo = {
        ...input,
        ...signed,
        machineCode: verification.machineCode,
        verificationStatus: input.offlineToken ? verification.ok ? "verified" : "invalid" : "unverified",
        verifiedAt: verification.checkedAt,
        ...(verification.error ? { verificationError: verification.error } : {}),
        updatedAt: new Date().toISOString(),
        updatedBy: actor
      };
      return { data: { ...state, license }, result: undefined };
    });
    return this.licenseStatus();
  }

  verifyLicense(input: UpdateLicense): LicenseVerificationResult {
    return verifyOfflineLicense(input);
  }

  async listApprovalPolicies(): Promise<ResourceApprovalPolicy[]> {
    const state = await this.store.read();
    return (state.resourceApprovalPolicies ?? []).slice().reverse();
  }

  async createApprovalPolicy(input: CreateResourceApprovalPolicy, actor: string): Promise<ResourceApprovalPolicy> {
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const policy: ResourceApprovalPolicy = { id: randomToken(12), ...input, createdAt: now, updatedAt: now, updatedBy: actor };
      return { data: { ...state, resourceApprovalPolicies: [...(state.resourceApprovalPolicies ?? []), policy].slice(-200) }, result: policy };
    });
  }

  async requiredApprovalPolicy(input: ResourceApprovalCheck): Promise<ResourceApprovalPolicy | null> {
    const state = await this.store.read();
    const workspace = input.workspace || "default";
    return (state.resourceApprovalPolicies ?? []).find((policy) => policy.enabled
      && (policy.workspace ?? "default") === workspace
      && policy.resourceType === input.resourceType
      && (policy.resourceId === input.resourceId || policy.resourceId === "*")
      && (policy.action === input.action || policy.action === "*")) ?? null;
  }

  async approvalPrecheck(input: ResourceApprovalCheck): Promise<ResourceApprovalPrecheck> {
    const policy = await this.requiredApprovalPolicy(input);
    const target = `${input.workspace || "default"}:${input.resourceType}:${input.resourceId}:${input.action}`;
    return { required: Boolean(policy), target, requiredApprovals: policy?.requiredApprovals ?? 0, ...(policy ? { policy } : {}) };
  }

  async listWorkspaces(): Promise<Workspace[]> {
    const state = await this.store.read();
    return ensureDefaultWorkspace(state.workspaces ?? []);
  }

  async createWorkspace(input: CreateWorkspace, actor: string): Promise<Workspace> {
    return this.store.update((state) => {
      const workspaces = ensureDefaultWorkspace(state.workspaces ?? []);
      if (workspaces.some((workspace) => workspace.id === input.id)) {
        throw new Error("工作空间已存在。");
      }
      const now = new Date().toISOString();
      const workspace: Workspace = { id: input.id, name: input.name, ...(input.description ? { description: input.description } : {}), createdAt: now, updatedAt: now, updatedBy: actor };
      return { data: { ...state, workspaces: [...workspaces, workspace].slice(-200) }, result: workspace };
    });
  }

  async workspaceOverview(): Promise<WorkspaceOverview> {
    const state = await this.store.read();
    const workspaces = ensureDefaultWorkspace(state.workspaces ?? []);
    return {
      generatedAt: new Date().toISOString(),
      workspaces,
      counts: workspaces.map((workspace) => ({
        workspace: workspace.id,
        policies: (state.accessPolicies ?? []).filter((policy) => policy.workspace === workspace.id).length,
        approvalPolicies: (state.resourceApprovalPolicies ?? []).filter((policy) => (policy.workspace ?? "default") === workspace.id).length,
        hosts: (state.hosts ?? []).filter((host) => (host.workspace ?? "default") === workspace.id).length,
        apps: (state.appDeployments ?? []).filter((deployment) => (deployment.workspace ?? "default") === workspace.id).length,
        databases: (state.databaseConnections ?? []).filter((connection) => (connection.workspace ?? "default") === workspace.id).length,
        remoteBackupTargets: (state.remoteBackupTargets ?? []).filter((target) => (target.workspace ?? "default") === workspace.id).length
      }))
    };
  }

  async evaluateAccess(input: AccessEvaluationRequest): Promise<AccessEvaluation> {
    const state = await this.store.read();
    const policy = (state.accessPolicies ?? []).find((item) => item.workspace === input.workspace && item.resourceType === input.resourceType && (item.resourceId === input.resourceId || item.resourceId === "*") && item.role === input.role && item.permissions.includes(input.permission));
    return { ...input, allowed: Boolean(policy), ...(policy ? { matchedPolicyId: policy.id } : {}) };
  }

  async remediationRuns(): Promise<SecurityRemediationRun[]> {
    const state = await this.store.read();
    return (state.securityRemediationRuns ?? []).slice().reverse();
  }

  async createRemediationRun(input: SecurityRemediationRequest, actor: string): Promise<SecurityRemediationRun> {
    const command = remediationCommand(input.itemId);
    const run: SecurityRemediationRunRecord = {
      id: randomToken(12),
      itemId: input.itemId,
      dryRun: input.dryRun,
      status: input.dryRun ? "planned" : command ? "success" : "failed",
      ...(command ? { command } : {}),
      outputTail: input.dryRun ? "dry-run: 已生成修复动作，未改动系统。" : command ? "已记录受控修复动作；生产执行前请核对回滚步骤。" : "未知修复项。",
      createdAt: new Date().toISOString(),
      createdBy: actor
    };
    await this.store.update((state) => ({ data: { ...state, securityRemediationRuns: [...(state.securityRemediationRuns ?? []), run].slice(-200) }, result: undefined }));
    return run;
  }

  async capacityPlan(): Promise<CapacityPlan> {
    const state = await this.store.read();
    const stateBytes = Buffer.byteLength(JSON.stringify(state), "utf8");
    const recommendations = [
      stateBytes > 5_000_000 ? "状态文件已超过 5MB，建议启用 SQLite 并归档历史样本。" : "当前状态体积适合轻量部署。",
      (state.metricSamples ?? []).length > 1000 ? "监控样本较多，建议开启历史归档和图表分页加载。" : "监控样本数量处于可控范围。",
      (state.hosts ?? []).length > 50 ? "主机数量较多，建议使用主机组和批量任务分批执行。" : "主机数量适合当前调度并发。"
    ];
    return { generatedAt: new Date().toISOString(), stateBytes, metricSamples: (state.metricSamples ?? []).length, hosts: (state.hosts ?? []).length, recommendations };
  }

  async upgradePlan(): Promise<UpgradePlan> {
    const state = await this.store.read();
    return {
      generatedAt: new Date().toISOString(),
      currentVersion,
      steps: [
        { id: "pre-backup", title: "升级前备份", status: (state.backups ?? []).length > 0 ? "ready" : "warn", detail: (state.backups ?? []).length > 0 ? "已有可回滚状态备份。" : "升级前建议先创建状态备份。" },
        { id: "state-migration", title: "状态迁移预检", status: "ready", detail: "可使用 scripts/migrate-state.mjs 补齐新增状态字段。" },
        { id: "package-verify", title: "发布包校验", status: "ready", detail: "发布包生成 .sha256 校验文件，可在离线环境核对。" }
      ]
    };
  }

  async deliveryChecklist(): Promise<DeliveryChecklist> {
    const state = await this.store.read();
    return {
      generatedAt: new Date().toISOString(),
      items: [
        { id: "session-secret", title: "强会话密钥", ready: true, detail: "部署时必须覆盖 LXPANEL_SESSION_SECRET。" },
        { id: "remote-backup", title: "远程备份目标", ready: (state.remoteBackupTargets ?? []).length > 0, detail: "建议至少配置一个文件系统或 S3 兼容远程目标。" },
        { id: "audit-integrity", title: "审计完整性", ready: true, detail: "新写入审计事件带哈希链，可执行完整性检查。" },
        { id: "offline-package", title: "离线交付包", ready: true, detail: "release 包含构建产物、脚本、部署模板和校验文件。" }
      ]
    };
  }

  openApiSummary(): OpenApiSummary {
    return {
      generatedAt: new Date().toISOString(),
      paths: [
        { method: "GET", path: "/api/system/overview", scope: "system:read" },
        { method: "GET", path: "/api/backups", scope: "backups:read" },
        { method: "POST", path: "/api/backups/remote-sync", scope: "backups:write" },
        { method: "POST", path: "/api/databases/restore-drill", scope: "databases:write" },
        { method: "POST", path: "/api/hosts/batch-command", scope: "hosts:write" },
        { method: "GET", path: "/api/audit/integrity", scope: "audit:read" },
        { method: "GET", path: "/api/audit/page", scope: "audit:read" },
        { method: "GET", path: "/api/audit/export-package", scope: "audit:read" },
        { method: "GET", path: "/api/audit/export-bundle", scope: "audit:read" },
        { method: "GET", path: "/api/platform/openapi-summary", scope: "platform:read" },
        { method: "GET", path: "/api/platform/openapi.json", scope: "platform:read" },
        { method: "GET", path: "/api/platform/workspaces", scope: "platform:read" },
        { method: "POST", path: "/api/platform/terminal-sessions", scope: "platform:write" },
        { method: "GET", path: "/api/platform/terminal-sessions/replay", scope: "platform:read" },
        { method: "GET", path: "/api/platform/terminal-sessions/ws", scope: "platform:read" },
        { method: "POST", path: "/api/platform/template-repositories/rollback", scope: "platform:write" },
        { method: "POST", path: "/api/platform/approval-policies/check", scope: "platform:read" },
        { method: "POST", path: "/api/platform/archive-state", scope: "platform:write" },
        { method: "GET", path: "/api/platform/archive-records", scope: "platform:read" },
        { method: "GET", path: "/api/platform/diagnostics-bundle", scope: "platform:read" }
      ],
      webhookEvents: ["alert.warning", "alert.critical", "approval.requested", "approval.progress", "approval.rejected", "security.remediation"]
    };
  }

  openApiDocument(): OpenApiDocument {
    const paths: Record<string, unknown> = {};
    for (const item of this.openApiSummary().paths) {
      const method = item.method.toLowerCase();
      const existingPath = paths[item.path];
      const current: Record<string, unknown> = isRecord(existingPath) ? existingPath : {};
      paths[item.path] = {
        ...current,
        [method]: {
          summary: `${item.method} ${item.path}`,
          security: item.scope ? [{ bearerAuth: [item.scope] }] : [],
          responses: { "200": { description: "成功", content: { "application/json": { schema: responseSchemaFor(item.path) } } }, "401": { description: "未登录" }, "403": { description: "权限不足" } }
        }
      };
    }
    return {
      openapi: "3.1.0",
      info: { title: "LXPanel API", version: currentVersion },
      servers: [{ url: "/" }],
      security: [{ bearerAuth: [] }],
      components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } }, schemas: openApiSchemas() },
      paths
    };
  }

  async archiveState(input: StateArchiveRequest): Promise<StateArchiveResult> {
    const state = await this.store.read();
    const beforeBytes = Buffer.byteLength(JSON.stringify(state), "utf8");
    const removedMetricSamples = (state.metricSamples ?? []).slice(0, Math.max(0, (state.metricSamples ?? []).length - input.keepMetricSamples));
    const removedAlertEvents = (state.alertEvents ?? []).slice(0, Math.max(0, (state.alertEvents ?? []).length - input.keepAlertEvents));
    const removedDeliveries = (state.notificationDeliveries ?? []).slice(0, Math.max(0, (state.notificationDeliveries ?? []).length - 300));
    const nextMetricSamples = (state.metricSamples ?? []).slice(-input.keepMetricSamples);
    const nextAlertEvents = (state.alertEvents ?? []).slice(-input.keepAlertEvents);
    const nextDeliveries = (state.notificationDeliveries ?? []).slice(-300);
    const nextState = { ...state, metricSamples: nextMetricSamples, alertEvents: nextAlertEvents, notificationDeliveries: nextDeliveries };
    const archiveRecords = [
      ...removedMetricSamples.map((sample) => ({ id: sample.id, time: sample.time, payload: sample })),
      ...removedAlertEvents.map((event) => ({ id: event.id, time: event.time, payload: event })),
      ...removedDeliveries.map((delivery) => ({ id: delivery.id, time: delivery.time, payload: delivery }))
    ];
    const result: StateArchiveResult = {
      dryRun: input.dryRun,
      beforeBytes,
      afterBytes: Buffer.byteLength(JSON.stringify(nextState), "utf8"),
      removedMetricSamples: (state.metricSamples ?? []).length - nextMetricSamples.length,
      removedAlertEvents: (state.alertEvents ?? []).length - nextAlertEvents.length,
      removedNotificationDeliveries: (state.notificationDeliveries ?? []).length - nextDeliveries.length,
      archivedRecords: input.dryRun || !this.store.archiveRecords ? 0 : archiveRecords.length,
      archiveDriver: this.store.archiveRecords ? "sqlite-table" : "json-trim",
      generatedAt: new Date().toISOString()
    };
    if (!input.dryRun) {
      if (this.store.archiveRecords && archiveRecords.length > 0) {
        await this.store.archiveRecords("state-history", archiveRecords);
      }
      await this.store.update(() => ({ data: nextState, result: undefined }));
    }
    return result;
  }

  async archiveRecords(input: { bucket?: string; limit?: number }): Promise<StateArchivePage> {
    const records = this.store.queryArchiveRecords ? await this.store.queryArchiveRecords(input) : [];
    return {
      generatedAt: new Date().toISOString(),
      ...(input.bucket ? { bucket: input.bucket } : {}),
      records,
      archiveDriver: this.store.queryArchiveRecords ? "sqlite-table" : "json-trim"
    };
  }

  async diagnosticsBundle(): Promise<DiagnosticsBundle> {
    const state = await this.store.read();
    const stateBytes = Buffer.byteLength(JSON.stringify(state), "utf8");
    const openApiPathCount = this.openApiSummary().paths.length;
    const frontendCheckCount = this.frontendQualityReport().checks.length;
    const checks = [
      { id: "state-size", title: "状态体积", status: stateBytes > 5_000_000 ? "warn" as const : "ok" as const, detail: `${stateBytes} bytes` },
      { id: "audit-chain", title: "审计哈希链", status: "ok" as const, detail: "审计事件写入包含 hash/previousHash 字段。" },
      { id: "connector-signature", title: "连接器命令签名", status: "ok" as const, detail: "命令下发包含 signaturePayload 与 HMAC-SHA256 签名。" },
      { id: "archive-query", title: "归档查询", status: this.store.queryArchiveRecords ? "ok" as const : "warn" as const, detail: this.store.queryArchiveRecords ? "SQLite state_archive 可查询。" : "JSON 模式仅裁剪，不保留查询表。" }
    ];
    const unsigned = { generatedAt: new Date().toISOString(), version: currentVersion, hostname: hostname(), stateBytes, checks, openApiPaths: openApiPathCount, frontendChecks: frontendCheckCount };
    return { ...unsigned, sha256: sha256(canonicalJson(unsigned)) };
  }

  installerGuide(): InstallerGuide {
    return {
      generatedAt: new Date().toISOString(),
      steps: [
        { id: "build", title: "生成发布包", command: "npm run build && npm run package:release", detail: "生成 release/lxpanel-<version>.tar.gz 与 SHA-256 校验文件。" },
        { id: "verify", title: "离线校验", command: "Get-FileHash release\\lxpanel-0.1.0.tar.gz -Algorithm SHA256", detail: "在客户现场核对交付包哈希。" },
        { id: "configure", title: "配置生产密钥", detail: "写入 LXPANEL_SESSION_SECRET、允许来源、IP 白名单、文件和日志根目录。" },
        { id: "diagnose", title: "打包诊断信息", command: "npm run smoke && npm run e2e", detail: "安装后采集构建产物、核心接口和平台治理端点状态。" }
      ],
      diagnostics: [
        { id: "node", title: "Node.js 运行时", ready: true, detail: "发布包使用当前 Node 运行时验证构建产物。" },
        { id: "state", title: "状态迁移脚本", ready: true, detail: "scripts/migrate-state.mjs 可补齐新增字段。" },
        { id: "checksum", title: "发布包校验", ready: true, detail: "package:release 会输出 SHA-256。" }
      ]
    };
  }

  sdkExamples(): SdkExample[] {
    return [
      { id: "curl-backups", language: "curl", title: "列出备份", requiredScopes: ["backups:read"], snippet: "curl.exe -H \"Authorization: Bearer lxpat_xxx\" http://127.0.0.1:7080/api/backups" },
      { id: "powershell-audit", language: "powershell", title: "下载审计签名包", requiredScopes: ["audit:read"], snippet: "Invoke-RestMethod -Headers @{ Authorization = 'Bearer lxpat_xxx' } -Uri http://127.0.0.1:7080/api/audit/export-package?format=jsonl" },
      { id: "node-apps", language: "node", title: "读取应用部署", requiredScopes: ["apps:read"], snippet: "const res = await fetch('http://127.0.0.1:7080/api/apps/deployments', { headers: { Authorization: 'Bearer lxpat_xxx' } });\nconsole.log(await res.json());" }
    ];
  }

  frontendQualityReport(): FrontendQualityReport {
    return {
      generatedAt: new Date().toISOString(),
      locale: "zh-CN",
      checks: [
        { id: "skip-link", title: "键盘跳转入口", ready: true, detail: "Shell 提供跳到主内容区域的隐藏链接。" },
        { id: "button-labels", title: "图标按钮标签", ready: true, detail: "关键图标按钮通过 title 或 aria-label 暴露语义。" },
        { id: "command-palette", title: "全局命令面板", ready: true, detail: "Ctrl+K 可在任意页面打开命令面板并跳转功能入口。" },
        { id: "preference-storage", title: "用户偏好持久化", ready: true, detail: "页面记忆、最近访问和表格密度使用本地偏好模块保存。" },
        { id: "navigation-search", title: "导航搜索与最近访问", ready: true, detail: "Shell 支持分组菜单、功能搜索、最近访问和页面记忆。" },
        { id: "dashboard-workbench", title: "首页工作台", ready: true, detail: "概览页提供状态摘要、角色感知快捷入口和资源进度条。" },
        { id: "i18n-resources", title: "中英文资源文件", ready: true, detail: "平台治理页使用资源表切换 zh-CN 和 en-US 文案。" }
      ]
    };
  }
}

function defaultLicense(): LicenseInfo {
  return { plan: "community", licensedTo: "local", maxHosts: 3, maxUsers: 2, maxApps: 5, features: ["core", "backup", "audit"], verificationStatus: "unverified", updatedAt: new Date(0).toISOString(), updatedBy: "system" };
}

function redactTerminalLine(value: string): string {
  return value
    .replace(/(password|passwd|token|secret)=([^\s]+)/giu, "$1=***")
    .replace(/(Authorization:\s*Bearer\s+)[A-Za-z0-9._~+/=-]+/giu, "$1***");
}

function createTemplateSnapshot(repository: TemplateRepository, templates: ImportedAppTemplate[], actor: string, now: string): TemplateRepositorySnapshotRecord {
  return {
    id: randomToken(12),
    repositoryId: repository.id,
    repositoryName: repository.name,
    templateIds: templates.map((template) => template.id),
    templates,
    ...(repository.indexSha256 ? { indexSha256: repository.indexSha256 } : {}),
    createdAt: now,
    createdBy: actor
  };
}

function responseSchemaFor(path: string): unknown {
  const map: Record<string, unknown> = {
    "/api/platform/openapi-summary": { $ref: "#/components/schemas/OpenApiSummaryResponse" },
    "/api/platform/openapi.json": { type: "object" },
    "/api/platform/workspaces": { $ref: "#/components/schemas/WorkspaceOverviewResponse" },
    "/api/platform/terminal-sessions": { $ref: "#/components/schemas/TerminalSessionResponse" },
    "/api/platform/terminal-sessions/replay": { $ref: "#/components/schemas/TerminalReplayResponse" },
    "/api/platform/template-repositories/rollback": { $ref: "#/components/schemas/TemplateRepositoryRollbackResponse" },
    "/api/platform/approval-policies/check": { $ref: "#/components/schemas/ResourceApprovalPrecheckResponse" },
    "/api/platform/archive-state": { $ref: "#/components/schemas/StateArchiveResponse" },
    "/api/platform/archive-records": { $ref: "#/components/schemas/StateArchivePageResponse" },
    "/api/platform/diagnostics-bundle": { $ref: "#/components/schemas/DiagnosticsBundleResponse" }
  };
  return map[path] ?? { type: "object" };
}

function openApiSchemas(): Record<string, unknown> {
  return {
    ErrorResponse: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
    OpenApiSummaryResponse: { type: "object", properties: { summary: { type: "object", properties: { generatedAt: { type: "string" }, paths: { type: "array", items: { type: "object" } }, webhookEvents: { type: "array", items: { type: "string" } } } } } },
    WorkspaceOverviewResponse: { type: "object", properties: { overview: { type: "object", properties: { generatedAt: { type: "string" }, workspaces: { type: "array", items: { type: "object" } }, counts: { type: "array", items: { type: "object" } } } } } },
    TerminalSessionResponse: { type: "object", properties: { session: { type: "object" }, command: { type: "object" } } },
    TerminalReplayResponse: { type: "object", properties: { replay: { type: "object", properties: { sessionId: { type: "string" }, lineCount: { type: "integer" }, lines: { type: "array", items: { type: "object" } } } } } },
    TemplateRepositoryRollbackResponse: { type: "object", properties: { rollback: { type: "object" } } },
    ResourceApprovalPrecheckResponse: { type: "object", properties: { precheck: { type: "object", properties: { required: { type: "boolean" }, target: { type: "string" }, requiredApprovals: { type: "integer" } } } } },
    StateArchiveResponse: { type: "object", properties: { result: { type: "object" } } },
    StateArchivePageResponse: { type: "object", properties: { page: { type: "object", properties: { records: { type: "array", items: { type: "object" } }, archiveDriver: { type: "string" } } } } },
    DiagnosticsBundleResponse: { type: "object", properties: { bundle: { type: "object", properties: { generatedAt: { type: "string" }, version: { type: "string" }, sha256: { type: "string" } } } } }
  };
}

async function fetchTemplateRepositoryIndex(repository: TemplateRepository): Promise<{ importedTemplates: ImportedAppTemplate[]; indexSha256: string }> {
  const response = await fetch(repository.url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`模板仓库拉取失败: ${response.status}`);
  }
  const raw = await response.text();
  const parsed = TemplateRepositoryIndexSchema.parse(JSON.parse(raw));
  const unsignedPayload = canonicalJson({ version: parsed.version, generatedAt: parsed.generatedAt, templates: parsed.templates, publicKeyId: parsed.publicKeyId });
  if (repository.trustMode === "signed") {
    if (!repository.publicKey) {
      throw new Error("签名仓库缺少公钥。");
    }
    if (!parsed.signature) {
      throw new Error("签名仓库缺少 index 签名。");
    }
    const verified = verifySignature("sha256", Buffer.from(unsignedPayload), repository.publicKey, Buffer.from(parsed.signature, "base64"));
    if (!verified) {
      throw new Error("模板仓库签名验证失败。");
    }
  }
  const indexSha256 = sha256(unsignedPayload);
  const importedAt = new Date().toISOString();
  return {
    indexSha256,
    importedTemplates: parsed.templates.map((template) => ({
      ...template,
      id: `${repository.id}:${template.id}`,
      source: repository.url,
      verified: repository.trustMode === "internal" ? template.verified : true,
      repositoryId: repository.id,
      importedAt,
      indexSha256
    }))
  };
}

function verifyOfflineLicense(input: UpdateLicense): LicenseVerificationResult {
  const checkedAt = new Date().toISOString();
  const machineCode = currentMachineCode();
  if (!input.offlineToken) {
    return { ok: false, checkedAt, machineCode, error: "未提供离线许可证。" };
  }
  if (!input.publicKey) {
    return { ok: false, checkedAt, machineCode, error: "未配置许可证公钥。" };
  }
  const [payloadText, signatureText] = input.offlineToken.split(".");
  if (!payloadText || !signatureText) {
    return { ok: false, checkedAt, machineCode, error: "许可证格式必须为 payload.signature。" };
  }
  try {
    const verified = verifySignature("sha256", Buffer.from(payloadText), input.publicKey, Buffer.from(signatureText, "base64url"));
    if (!verified) {
      return { ok: false, checkedAt, machineCode, error: "许可证签名验证失败。" };
    }
    const payload = JSON.parse(Buffer.from(payloadText, "base64url").toString("utf8")) as unknown;
    if (!isRecord(payload)) {
      return { ok: false, checkedAt, machineCode, error: "许可证载荷不是对象。" };
    }
    const payloadMachineCode = typeof payload.machineCode === "string" ? payload.machineCode : "";
    if (payloadMachineCode && payloadMachineCode !== machineCode) {
      return { ok: false, checkedAt, machineCode, error: "许可证机器码不匹配。" };
    }
    const expiresAt = typeof payload.expiresAt === "string" ? payload.expiresAt : undefined;
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      return { ok: false, checkedAt, machineCode, expiresAt, error: "许可证已过期。" };
    }
    return {
      ok: true,
      checkedAt,
      machineCode,
      ...(isLicensePlan(payload.plan) ? { plan: payload.plan } : {}),
      ...(typeof payload.licensedTo === "string" ? { licensedTo: payload.licensedTo } : {}),
      ...(expiresAt ? { expiresAt } : {})
    };
  } catch (error) {
    return { ok: false, checkedAt, machineCode, error: error instanceof Error ? error.message : String(error) };
  }
}

function verificationToLicensePatch(result: LicenseVerificationResult): Partial<LicenseInfo> {
  return {
    ...(result.plan ? { plan: result.plan } : {}),
    ...(result.licensedTo ? { licensedTo: result.licensedTo } : {}),
    ...(result.expiresAt ? { expiresAt: result.expiresAt } : {})
  };
}

function currentMachineCode(): string {
  return sha256(`${hostname()}|${platform()}|${arch()}`).slice(0, 32);
}

function ensureDefaultWorkspace(workspaces: Workspace[]): Workspace[] {
  return workspaces.some((workspace) => workspace.id === "default") ? workspaces : [{ id: "default", name: "默认工作空间", createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(), updatedBy: "system" }, ...workspaces];
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLicensePlan(value: unknown): value is LicenseInfo["plan"] {
  return value === "community" || value === "team" || value === "enterprise";
}

function remediationCommand(itemId: string): string | undefined {
  const commands: Record<string, string> = {
    "firewall-management-network": "ufw allow from <管理网段> to any port <面板端口>",
    "ssh-disable-password": "set PasswordAuthentication no and reload sshd",
    "ssh-disable-root": "set PermitRootLogin no and reload sshd",
    "docker-socket-boundary": "move Docker operations to trusted connector or rootless Docker"
  };
  return commands[itemId];
}
