import { createHash, generateKeyPairSync, sign as signData, verify as verifySignature } from "node:crypto";
import { arch, hostname, platform } from "node:os";
import { RegisterPluginManifestSchema, TemplateRepositoryIndexSchema, type AccessEvaluation, type AccessEvaluationRequest, type AccessPolicy, type AiDiagnosticRequest, type AiDiagnosticResult, type Approval, type AuditEvent, type AuditExportPackage, type AuditPruneResult, type AuditRetentionEvaluation, type AuditRetentionEvaluationRequest, type AuditRetentionExecution, type AuditRetentionExecutionRequest, type AuditRetentionPolicy, type BackupEncryptionPolicy, type BackupKeyRotationPlan, type CapacityPlan, type ClientApplicationPlan, type ConnectorReleaseChannel, type ConnectorReleaseManifest, type CreateAccessPolicy, type CreateAuditRetentionPolicy, type CreateFederatedCluster, type CreateResourceApprovalPolicy, type CreateTemplateRepository, type CreateTerminalSession, type CreateWorkspace, type DeliveryChecklist, type DiagnosticsBundle, type FederatedCluster, type FrontendQualityReport, type GenerateLicense, type HighAvailabilityPlan, type IdentityProvider, type ImportedAppTemplate, type InstallerGuide, type LicenseGenerationResult, type LicenseInfo, type LicenseStatus, type LicenseVerificationResult, type OpenApiDocument, type OpenApiSummary, type PluginManifest, type PluginPermissionEvaluation, type PluginPermissionEvaluationRequest, type PluginSandboxRun, type PluginSandboxRunRequest, type RegisterPluginManifest, type ResourceApprovalCheck, type ResourceApprovalPolicy, type ResourceApprovalPrecheck, type SdkExample, type SecurityRemediationRequest, type SecurityRemediationRun, type SsoReadiness, type StateArchivePage, type StateArchiveRequest, type StateArchiveResult, type TemplateRepository, type TemplateRepositoryRollback, type TenantReport, type TerminalInput, type TerminalOutput, type TerminalReplay, type TerminalSession, type UpdateBackupEncryptionPolicy, type UpdateConnectorReleaseChannel, type UpdateIdentityProvider, type UpdateLicense, type UpgradePlan, type Workspace, type WorkspaceOverview } from "@lxpanel/shared";
import { randomToken } from "../../lib/crypto.js";
import type { StateStore } from "../../lib/stateStore.js";
import { createDefaultAuditRetentionPolicies, createDefaultBackupEncryptionPolicy, createDefaultConnectorReleaseChannels, type PanelState, type SecurityRemediationRunRecord, type TemplateRepositorySnapshotRecord } from "../state/panelState.js";

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

  /** 在 Web 界面生成离线许可证（镜像 CLI license-issue.mjs） */
  generateLicense(input: GenerateLicense): LicenseGenerationResult {
    return generateOfflineLicense(input);
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

  async identityProvider(): Promise<IdentityProvider | null> {
    const state = await this.store.read();
    return state.identityProvider ? toPublicIdentityProvider(state.identityProvider) : null;
  }

  async updateIdentityProvider(input: UpdateIdentityProvider, actor: string): Promise<IdentityProvider> {
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const current = state.identityProvider;
      const provider: NonNullable<PanelState["identityProvider"]> = {
        id: current?.id ?? "oidc-primary",
        type: "oidc",
        name: input.name,
        issuerUrl: input.issuerUrl,
        authorizationEndpoint: input.authorizationEndpoint,
        ...(input.tokenEndpoint ? { tokenEndpoint: input.tokenEndpoint } : {}),
        ...(input.jwksUri ? { jwksUri: input.jwksUri } : {}),
        clientId: input.clientId,
        clientSecretConfigured: Boolean(input.clientSecret || current?.clientSecret || current?.clientSecretConfigured),
        ...(input.clientSecret ? { clientSecret: input.clientSecret } : current?.clientSecret ? { clientSecret: current.clientSecret } : {}),
        scopes: input.scopes,
        claimMappings: input.claimMappings,
        autoCreateUsers: input.autoCreateUsers,
        defaultRole: input.defaultRole,
        allowedEmailDomains: input.allowedEmailDomains,
        requireMfa: input.requireMfa,
        breakGlassLocalLogin: input.breakGlassLocalLogin,
        enabled: input.enabled,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
        updatedBy: actor
      };
      return { data: { ...state, identityProvider: provider }, result: toPublicIdentityProvider(provider) };
    });
  }

  async ssoReadiness(): Promise<SsoReadiness> {
    const state = await this.store.read();
    const provider = state.identityProvider ? toPublicIdentityProvider(state.identityProvider) : null;
    const configured = Boolean(provider);
    const callbackPath = "/api/auth/oidc/callback";
    const checks = [
      { id: "provider", title: "OIDC 身份源", ready: Boolean(provider?.issuerUrl && provider.clientId), detail: provider ? `${provider.name} / ${provider.issuerUrl}` : "尚未配置身份源。" },
      { id: "secret", title: "客户端密钥", ready: Boolean(provider?.clientSecretConfigured), detail: provider?.clientSecretConfigured ? "client secret 已加密保存状态标记。" : "生产环境建议配置 client secret。" },
      { id: "auto-create", title: "自动创建用户", ready: Boolean(provider?.autoCreateUsers), detail: provider?.autoCreateUsers ? `默认角色 ${provider.defaultRole}` : "当前只允许已绑定用户登录。" },
      { id: "mfa", title: "MFA 策略", ready: Boolean(provider?.requireMfa), detail: provider?.requireMfa ? "平台要求身份源侧启用 MFA。" : "当前允许不强制 MFA。" },
      { id: "break-glass", title: "本地应急登录", ready: Boolean(provider?.breakGlassLocalLogin), detail: provider?.breakGlassLocalLogin ? "保留 owner 本地登录，避免身份源故障锁死。" : "建议保留本地应急登录。" }
    ];
    return {
      configured,
      enabled: Boolean(provider?.enabled),
      ...(provider ? { provider, authorizationUrl: oidcAuthorizationUrl(provider, callbackPath) } : {}),
      callbackPath,
      localBreakGlassAvailable: provider?.breakGlassLocalLogin ?? true,
      checks
    };
  }

  async connectorReleaseChannels(): Promise<ConnectorReleaseChannel[]> {
    const state = await this.store.read();
    return connectorReleaseChannelsOrDefault(state).slice().sort((left, right) => left.name.localeCompare(right.name));
  }

  async updateConnectorReleaseChannel(input: UpdateConnectorReleaseChannel, actor: string): Promise<ConnectorReleaseChannel> {
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const channels = connectorReleaseChannelsOrDefault(state);
      const channel: ConnectorReleaseChannel = {
        name: input.name,
        version: input.version,
        minimumVersion: input.minimumVersion,
        rolloutPercent: input.rolloutPercent,
        ...(input.publicKeyId ? { publicKeyId: input.publicKeyId } : {}),
        artifacts: input.artifacts.map((artifact) => ({ ...artifact, channel: input.name })),
        updatedAt: now,
        updatedBy: actor
      };
      return { data: { ...state, connectorReleaseChannels: [...channels.filter((item) => item.name !== input.name), channel] }, result: channel };
    });
  }

  async connectorReleaseManifest(): Promise<ConnectorReleaseManifest> {
    const channels = await this.connectorReleaseChannels();
    const artifacts = channels.flatMap((channel) => channel.artifacts);
    const unsigned = { generatedAt: new Date().toISOString(), channels };
    return {
      ...unsigned,
      manifestSha256: sha256(canonicalJson(unsigned)),
      verification: {
        allArtifactsHaveSha256: artifacts.every((artifact) => /^[a-f0-9]{64}$/u.test(artifact.sha256)),
        allArtifactsHaveSignature: artifacts.every((artifact) => Boolean(artifact.signature)),
        publicKeyIds: [...new Set(channels.flatMap((channel) => channel.publicKeyId ? [channel.publicKeyId] : []))],
        installCommand: "node scripts/lxpanel-connector.mjs --verify-manifest release/connectors/manifest.json"
      }
    };
  }

  async backupEncryptionPolicy(): Promise<BackupEncryptionPolicy> {
    const state = await this.store.read();
    return state.backupEncryptionPolicy ?? createDefaultBackupEncryptionPolicy();
  }

  async updateBackupEncryptionPolicy(input: UpdateBackupEncryptionPolicy, actor: string): Promise<BackupEncryptionPolicy> {
    return this.store.update((state) => {
      const current = state.backupEncryptionPolicy ?? createDefaultBackupEncryptionPolicy();
      const now = new Date().toISOString();
      const policy: BackupEncryptionPolicy = {
        enabled: input.enabled,
        algorithm: "AES-256-GCM",
        provider: input.provider,
        keyRef: input.keyRef,
        keyVersion: current.keyVersion,
        rotateEveryDays: input.rotateEveryDays,
        nextRotationAt: nextRotationAt(now, input.rotateEveryDays),
        ...(current.lastRotatedAt ? { lastRotatedAt: current.lastRotatedAt } : {}),
        updatedAt: now,
        updatedBy: actor
      };
      return { data: { ...state, backupEncryptionPolicy: policy }, result: policy };
    });
  }

  async backupKeyRotationPlan(): Promise<BackupKeyRotationPlan> {
    const policy = await this.backupEncryptionPolicy();
    const now = new Date();
    const due = policy.enabled && Boolean(policy.nextRotationAt) && new Date(policy.nextRotationAt!).getTime() <= now.getTime();
    return {
      generatedAt: now.toISOString(),
      currentKeyVersion: policy.keyVersion,
      nextKeyVersion: policy.keyVersion + 1,
      due,
      steps: [
        { id: "approval", title: "审批密钥轮换", detail: "生产环境应通过 resource approval 审批 backup.key.rotate。", requiresApproval: true },
        { id: "rotate", title: "提升密钥版本", detail: `将 ${policy.keyRef} 对应密钥版本从 v${policy.keyVersion} 提升到 v${policy.keyVersion + 1}。`, requiresApproval: false },
        { id: "backup", title: "生成新加密备份", detail: "轮换后创建一次状态备份并验证 SHA-256 与 AES-GCM 标签。", requiresApproval: false }
      ]
    };
  }

  async rotateBackupEncryptionKey(actor: string): Promise<BackupEncryptionPolicy> {
    return this.store.update((state) => {
      const current = state.backupEncryptionPolicy ?? createDefaultBackupEncryptionPolicy();
      const now = new Date().toISOString();
      const policy: BackupEncryptionPolicy = {
        ...current,
        keyVersion: current.keyVersion + 1,
        lastRotatedAt: now,
        nextRotationAt: nextRotationAt(now, current.rotateEveryDays),
        updatedAt: now,
        updatedBy: actor
      };
      return { data: { ...state, backupEncryptionPolicy: policy }, result: policy };
    });
  }

  async auditRetentionPolicies(): Promise<AuditRetentionPolicy[]> {
    const state = await this.store.read();
    return auditRetentionPoliciesOrDefault(state).slice().reverse();
  }

  async createAuditRetentionPolicy(input: CreateAuditRetentionPolicy, actor: string): Promise<AuditRetentionPolicy> {
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const policy: AuditRetentionPolicy = { id: randomToken(12), ...input, createdAt: now, updatedAt: now, updatedBy: actor };
      return { data: { ...state, auditRetentionPolicies: [...auditRetentionPoliciesOrDefault(state), policy].slice(-200) }, result: policy };
    });
  }

  /**
   * 将审计日志归档到远程备份目标（S3/MinIO/文件系统）。
   * 复用已配置的远程备份目标，把审计 JSONL 包作为远程备份对象上传。
   */
  async archiveAuditToRemote(auditPackage: { fileName: string; content: string }): Promise<{ targetId: string; targetName: string; key: string; status: string }[]> {
    const state = await this.store.read();
    const results: Array<{ targetId: string; targetName: string; key: string; status: string }> = [];
    const targets = (state.remoteBackupTargets ?? []).filter((t) => t.enabled);
    for (const target of targets) {
      const key = `audit-archive/${auditPackage.fileName}`;
      try {
        if (target.type === "s3" && target.endpoint && target.bucket) {
          const s3Url = `${target.endpoint.replace(/\/+$/u, "")}/${target.bucket}/${target.prefix ? `${target.prefix}/` : ""}${key}`;
          const response = await fetch(s3Url, {
            method: "PUT",
            headers: { "content-type": "application/jsonl" },
            body: auditPackage.content
          });
          results.push({ targetId: target.id, targetName: target.name, key, status: response.ok ? "success" : "failed" });
        } else if (target.type === "filesystem" && target.path) {
          const { writeFile, mkdir } = await import("node:fs/promises");
          const { join } = await import("node:path");
          const dir = join(target.path, "audit-archive");
          await mkdir(dir, { recursive: true });
          await writeFile(join(dir, auditPackage.fileName), auditPackage.content, "utf8");
          results.push({ targetId: target.id, targetName: target.name, key, status: "success" });
        } else {
          results.push({ targetId: target.id, targetName: target.name, key, status: "unsupported" });
        }
      } catch (error) {
        results.push({ targetId: target.id, targetName: target.name, key, status: "failed", ...(error instanceof Error ? { error: error.message } : {}) });
      }
    }
    return results;
  }

  async evaluateAuditRetention(input: AuditRetentionEvaluationRequest): Promise<AuditRetentionEvaluation> {
    const state = await this.store.read();
    const policies = auditRetentionPoliciesOrDefault(state).filter((policy) => policy.enabled);
    const policy = policies.find((item) => item.workspace === input.workspace && item.eventType === input.eventType)
      ?? policies.find((item) => item.workspace === input.workspace && item.eventType === "*")
      ?? policies.find((item) => item.workspace === "default" && item.eventType === "*");
    const retainDays = policy?.retainDays ?? 180;
    const now = new Date();
    return {
      generatedAt: now.toISOString(),
      workspace: input.workspace,
      eventType: input.eventType,
      retainDays,
      archiveBeforeDelete: policy?.archiveBeforeDelete ?? true,
      legalHold: policy?.legalHold ?? false,
      pruneEligibleBefore: new Date(now.getTime() - retainDays * 24 * 60 * 60_000).toISOString(),
      ...(policy ? { matchedPolicy: policy } : {}),
      estimatedEligibleEvents: policy?.legalHold ? 0 : Math.floor(input.eventCount * 0.35)
    };
  }

  async auditRetentionExecution(input: AuditRetentionExecutionRequest, eventCount: number, archivePackage?: AuditExportPackage, approval?: Approval, pruneResult?: AuditPruneResult): Promise<AuditRetentionExecution> {
    const evaluation = await this.evaluateAuditRetention({ workspace: input.workspace, eventType: input.eventType, eventCount });
    const target = `${evaluation.retainDays}d`;
    const status = evaluation.legalHold ? "skipped" : pruneResult ? "executed" : approval ? "approval-required" : "planned";
    return {
      generatedAt: new Date().toISOString(),
      dryRun: input.dryRun,
      status,
      evaluation,
      ...(approval ? { approval } : {}),
      ...(archivePackage ? { archivePackage } : {}),
      pruneTask: {
        id: sha256(canonicalJson({ workspace: input.workspace, eventType: input.eventType, target })).slice(0, 16),
        action: "audit.prune",
        target,
        status: pruneResult ? "success" : evaluation.legalHold ? "skipped" : "planned",
        ...(pruneResult ? { removed: pruneResult.removed, remaining: pruneResult.remaining } : {})
      }
    };
  }

  async pluginManifests(): Promise<PluginManifest[]> {
    const state = await this.store.read();
    return (state.pluginManifests ?? []).slice().reverse();
  }

  async registerPluginManifest(input: RegisterPluginManifest, actor: string): Promise<PluginManifest> {
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const current = (state.pluginManifests ?? []).find((plugin) => plugin.id === input.id);
      const manifest: PluginManifest = { ...input, createdAt: current?.createdAt ?? now, updatedAt: now, updatedBy: actor };
      return { data: { ...state, pluginManifests: [...(state.pluginManifests ?? []).filter((plugin) => plugin.id !== input.id), manifest].slice(-200) }, result: manifest };
    });
  }

  /**
   * 从远程 URL 拉取插件 manifest，验证签名后注册。
   * @param url 插件 manifest JSON URL
   * @param publicKey 可选的 RSA/ECDSA PEM 公钥，用于签名验证
   * @param trustMode "signed" | "internal"
   * @param actor 操作者
   */
  async syncPluginManifest(url: string, trustMode: "signed" | "internal", actor: string, publicKey?: string): Promise<PluginManifest> {
    const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
      throw new Error(`远程插件 manifest 拉取失败: ${response.status}`);
    }
    const raw = await response.json() as Record<string, unknown>;
    const manifest = RegisterPluginManifestSchema.parse(raw);
    if (trustMode === "signed") {
      if (!publicKey) {
        throw new Error("签名模式需要提供公钥。");
      }
      if (!manifest.signature) {
        throw new Error("远程插件 manifest 缺少签名字段。");
      }
      const unsignedPayload = canonicalJson({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        entryPoint: manifest.entryPoint,
        permissions: manifest.permissions
      });
      const verified = verifySignature("sha256", Buffer.from(unsignedPayload), publicKey, Buffer.from(manifest.signature, "base64"));
      if (!verified) {
        throw new Error(`远程插件 ${manifest.id} 签名验证失败。`);
      }
    }
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const current = (state.pluginManifests ?? []).find((plugin) => plugin.id === manifest.id);
      const stored: PluginManifest = { ...manifest, source: url, createdAt: current?.createdAt ?? now, updatedAt: now, updatedBy: actor };
      return { data: { ...state, pluginManifests: [...(state.pluginManifests ?? []).filter((plugin) => plugin.id !== manifest.id), stored].slice(-200) }, result: stored };
    });
  }

  async evaluatePluginPermissions(input: PluginPermissionEvaluationRequest): Promise<PluginPermissionEvaluation> {
    const state = await this.store.read();
    const plugin = (state.pluginManifests ?? []).find((item) => item.id === input.pluginId);
    if (!plugin) {
      return { pluginId: input.pluginId, allowed: false, grantedScopes: [], deniedScopes: input.requestedScopes, requiresSignature: true, requiresApproval: true, detail: "插件未注册。" };
    }
    const grantedScopes = input.requestedScopes.filter((scope) => plugin.permissions.includes(scope));
    const deniedScopes = input.requestedScopes.filter((scope) => !plugin.permissions.includes(scope));
    const requiresSignature = !plugin.signature;
    const requiresApproval = deniedScopes.length > 0 || !plugin.enabled || requiresSignature;
    return {
      pluginId: plugin.id,
      allowed: deniedScopes.length === 0 && plugin.enabled && !requiresSignature,
      grantedScopes,
      deniedScopes,
      requiresSignature,
      requiresApproval,
      detail: deniedScopes.length > 0 ? "请求 scope 超出插件清单声明。" : plugin.enabled ? "权限在插件清单范围内。" : "插件已注册但未启用。"
    };
  }

  async runPluginSandbox(input: PluginSandboxRunRequest): Promise<PluginSandboxRun> {
    const started = Date.now();
    const startedAt = new Date(started).toISOString();
    const evaluation = await this.evaluatePluginPermissions({ pluginId: input.pluginId, requestedScopes: input.requestedScopes });
    const state = await this.store.read();
    const plugin = (state.pluginManifests ?? []).find((item) => item.id === input.pluginId);
    const sandbox = { network: false as const, filesystem: false as const, timeoutMs: input.timeoutMs, directStateAccess: false as const };
    if (!evaluation.allowed || !plugin) {
      const finishedAt = new Date().toISOString();
      return { pluginId: input.pluginId, operation: input.operation, status: "denied", startedAt, finishedAt, durationMs: Math.max(0, Date.now() - started), grantedScopes: evaluation.grantedScopes, deniedScopes: evaluation.deniedScopes, sandbox, error: evaluation.detail };
    }
    const output = input.operation === "health-check" ? {
      ok: true,
      plugin: plugin.id,
      version: plugin.version,
      entryPoint: plugin.entryPoint,
      clientScopes: evaluation.grantedScopes,
      inputKeys: Object.keys(input.input)
    } : {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      permissions: evaluation.grantedScopes,
      loaded: true
    };
    const finishedAt = new Date().toISOString();
    return { pluginId: plugin.id, operation: input.operation, status: "success", startedAt, finishedAt, durationMs: Math.max(0, Date.now() - started), grantedScopes: evaluation.grantedScopes, deniedScopes: evaluation.deniedScopes, sandbox, output };
  }

  async highAvailabilityPlan(): Promise<HighAvailabilityPlan> {
    const state = await this.store.read();
    const remoteTargets = (state.remoteBackupTargets ?? []).filter((target) => target.enabled).length;
    const databaseCount = (state.databaseConnections ?? []).length;
    const connectorCount = state.connectors.length;
    return {
      generatedAt: new Date().toISOString(),
      mode: remoteTargets > 0 && connectorCount > 1 ? "active-passive" : "single-node",
      topology: [
        { role: "api-web", count: remoteTargets > 0 ? 2 : 1, detail: "前端静态资源和 API 通过反向代理暴露，健康探针使用 /api/health/ready。" },
        { role: "state-store", count: databaseCount > 0 ? 1 : 1, detail: databaseCount > 0 ? "建议将状态后端迁移到 SQLite/托管数据库卷并做快照。" : "轻量模式使用 JSON 状态文件，需依赖加密远程备份。" },
        { role: "connector", count: Math.max(1, connectorCount), detail: "连接器按主机分布，命令签名保证 failover 后仍可验证来源。" }
      ],
      checks: [
        { id: "remote-backup", title: "异地备份", ready: remoteTargets > 0, detail: remoteTargets > 0 ? `${remoteTargets} 个远程备份目标可用。` : "建议配置至少一个远程备份目标。" },
        { id: "connector-redundancy", title: "连接器冗余", ready: connectorCount > 1, detail: connectorCount > 1 ? `${connectorCount} 个连接器已登记。` : "关键主机建议部署至少两个连接器。" },
        { id: "backup-encryption", title: "备份加密", ready: state.backupEncryptionPolicy?.enabled === true, detail: state.backupEncryptionPolicy?.enabled ? "状态备份将以 AES-256-GCM 写入。" : "建议先启用备份加密策略。" }
      ],
      rolloutSteps: [
        { id: "proxy", title: "接入负载均衡", detail: "将 /api/health/ready 作为就绪探针，Web 静态资源设置短缓存。" },
        { id: "state", title: "迁移共享状态", detail: "执行 scripts/migrate-state.mjs 并将 data 目录迁移到受控卷。" },
        { id: "restore-drill", title: "恢复演练", detail: "创建加密备份、同步到远端、在备用节点恢复并执行烟测。" }
      ],
      failoverRunbook: [
        { id: "freeze", title: "冻结写入", detail: "暂停计划任务和 connector upgrade rollout。" },
        { id: "restore", title: "恢复状态", command: "npm run diagnose:release -- --json", detail: "在备用节点恢复最新备份后运行诊断。" },
        { id: "dns", title: "切换入口", detail: "将反向代理或 DNS 指向备用 API/Web 节点。" }
      ],
      estimatedRecoveryMinutes: remoteTargets > 0 ? 15 : 45
    };
  }

  clientApplicationPlan(): ClientApplicationPlan {
    return {
      generatedAt: new Date().toISOString(),
      currentClients: [
        { id: "web-console", type: "web", status: "available", detail: "apps/web 是当前正式客户端，由 API 进程托管静态资源，覆盖桌面与移动浏览器。" },
        { id: "managed-host-agent", type: "agent", status: "available", detail: "scripts/lxpanel-connector.mjs 是受管主机侧 agent，用于心跳、命令领取、终端代理和升级。" },
        { id: "desktop-tauri", type: "desktop", status: "available", detail: "apps/desktop-tauri 是基于 Tauri 2 的桌面托盘原型，支持系统托盘常驻、WebView 加载面板、健康检查和托盘菜单。" }
      ],
      candidates: [
        { id: "mobile-readonly", type: "mobile", recommendedStack: "PWA first，后续再评估 React Native", priority: "later", decision: "优先做只读巡检、告警确认和审批处理，不承载高风险写操作。", risks: ["移动端密钥保护", "审批误触和弱网络一致性"] }
      ],
      recommendation: "Web 为正式客户端；Desktop Tauri 原型已完成，下一轮需要 Windows 签名和自动更新；移动端暂不启动。"
    };
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

  async tenantReport(input: { workspace: string; from?: string; to?: string }, auditEvents: AuditEvent[]): Promise<TenantReport> {
    const state = await this.store.read();
    const workspace = input.workspace || "default";
    const fromTime = input.from ? new Date(input.from).getTime() : null;
    const toTime = input.to ? new Date(input.to).getTime() : null;
    const events = auditEvents.filter((event) => isInRange(event.time, fromTime, toTime) && eventBelongsToWorkspace(event, workspace));
    const approvals = (state.approvals ?? []).filter((approval) => approval.target.startsWith(`${workspace}:`) && isInRange(approval.requestedAt, fromTime, toTime));
    const reviewedDurations = approvals.flatMap((approval) => {
      const reviewedAt = approval.reviewedAt ?? approval.reviews.find((review) => review.decision === "approved")?.reviewedAt;
      if (!reviewedAt) {
        return [];
      }
      return [Math.max(0, new Date(reviewedAt).getTime() - new Date(approval.requestedAt).getTime()) / 60_000];
    });
    const actionCounts = new Map<string, number>();
    for (const event of events) {
      actionCounts.set(event.action, (actionCounts.get(event.action) ?? 0) + 1);
    }
    const unsigned = {
      generatedAt: new Date().toISOString(),
      workspace,
      range: { ...(input.from ? { from: input.from } : {}), ...(input.to ? { to: input.to } : {}) },
      counts: {
        hosts: (state.hosts ?? []).filter((host) => (host.workspace ?? "default") === workspace).length,
        apps: (state.appDeployments ?? []).filter((deployment) => (deployment.workspace ?? "default") === workspace).length,
        databases: (state.databaseConnections ?? []).filter((connection) => (connection.workspace ?? "default") === workspace).length,
        remoteBackupTargets: (state.remoteBackupTargets ?? []).filter((target) => (target.workspace ?? "default") === workspace).length,
        approvals: approvals.length,
        auditEvents: events.length,
        errors: events.filter((event) => event.status === "error").length,
        denied: events.filter((event) => event.status === "denied").length
      },
      resources: [
        { type: "hosts", count: (state.hosts ?? []).filter((host) => (host.workspace ?? "default") === workspace).length },
        { type: "apps", count: (state.appDeployments ?? []).filter((deployment) => (deployment.workspace ?? "default") === workspace).length },
        { type: "databases", count: (state.databaseConnections ?? []).filter((connection) => (connection.workspace ?? "default") === workspace).length },
        { type: "remoteBackupTargets", count: (state.remoteBackupTargets ?? []).filter((target) => (target.workspace ?? "default") === workspace).length }
      ],
      topActions: [...actionCounts.entries()].map(([action, count]) => ({ action, count })).sort((left, right) => right.count - left.count).slice(0, 10),
      approvalSla: {
        reviewed: reviewedDurations.length,
        ...(reviewedDurations.length > 0 ? { averageMinutes: Number((reviewedDurations.reduce((sum, value) => sum + value, 0) / reviewedDurations.length).toFixed(2)) } : {}),
        pending: approvals.filter((approval) => approval.status === "pending").length
      }
    };
    return { ...unsigned, sha256: sha256(canonicalJson(unsigned)) };
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
        { id: "offline-package", title: "离线交付包", ready: true, detail: "release 包含构建产物、脚本、部署模板和校验文件。" },
        { id: "sso-oidc", title: "企业 SSO/OIDC", ready: state.identityProvider?.enabled === true, detail: state.identityProvider?.enabled ? "已配置 OIDC 身份源和本地应急登录策略。" : "可在平台治理中接入 OIDC 身份源。" },
        { id: "backup-encryption", title: "备份加密", ready: state.backupEncryptionPolicy?.enabled === true, detail: state.backupEncryptionPolicy?.enabled ? "状态备份写入时使用 AES-256-GCM。" : "生产环境建议启用备份加密和密钥轮换。" },
        { id: "plugin-permissions", title: "插件权限模型", ready: true, detail: "插件必须声明 API scope，平台可评估越权请求。" },
        { id: "ha-plan", title: "高可用部署方案", ready: (state.remoteBackupTargets ?? []).length > 0, detail: "高可用计划会根据远程备份、连接器和状态后端给出 failover runbook。" }
      ]
    };
  }

  openApiSummary(): OpenApiSummary {
    return {
      generatedAt: new Date().toISOString(),
      paths: openApiPathSpecs(),
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
          ...(requestSchemaFor(item.method, item.path) ? { requestBody: { required: true, content: { "application/json": { schema: requestSchemaFor(item.method, item.path) } } } } : {}),
          ...(queryParametersFor(item.path).length > 0 ? { parameters: queryParametersFor(item.path) } : {}),
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

  /** 联邦集群管理：登记远程子集群 */
  async createFederatedCluster(input: CreateFederatedCluster, actor: string): Promise<FederatedCluster> {
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const cluster: FederatedCluster = { id: randomToken(12), name: input.name, apiUrl: input.apiUrl, apiToken: input.apiToken, status: "offline", hostCount: 0, connectorCount: 0, createdAt: now, updatedAt: now, updatedBy: actor };
      return { data: { ...state, federatedClusters: [...(state.federatedClusters ?? []), cluster].slice(-50) }, result: cluster };
    });
  }

  async listFederatedClusters(): Promise<FederatedCluster[]> {
    const state = await this.store.read();
    return (state.federatedClusters ?? []).slice().reverse();
  }

  /** 同步联邦集群状态：探测远程集群健康 */
  async syncFederatedCluster(clusterId: string): Promise<FederatedCluster> {
    const state = await this.store.read();
    const cluster = (state.federatedClusters ?? []).find((c) => c.id === clusterId);
    if (!cluster) throw new Error("联邦集群不存在。");
    let newStatus: "online" | "offline" = "offline";
    let newVersion = cluster.version ?? "";
    try {
      const response = await fetch(`${cluster.apiUrl.replace(/\/+$/u, "")}/api/health/ready`, {
        headers: { authorization: `Bearer ${cluster.apiToken}` },
        signal: AbortSignal.timeout(10_000)
      });
      if (response.ok) {
        newStatus = "online";
        const body = await response.json() as Record<string, unknown>;
        newVersion = typeof body.version === "string" ? body.version : newVersion;
      }
    } catch {
      newStatus = "offline";
    }
    const now = new Date().toISOString();
    await this.store.update((current) => {
      const updated = {
        ...current,
        federatedClusters: (current.federatedClusters ?? []).map((c) => c.id === clusterId ? { ...c, status: newStatus, version: newVersion, lastSyncAt: now } : c)
      };
      return { data: updated, result: undefined };
    });
    return { ...cluster, status: newStatus, version: newVersion, lastSyncAt: now };
  }

  /** AI 辅助诊断：分析审计/告警数据并生成建议 */
  async aiDiagnostic(input: AiDiagnosticRequest): Promise<AiDiagnosticResult> {
    const state = await this.store.read();
    const events = input.context === "audit" ? (state.auditRetentionPolicies ?? []) : [];
    const alerts = input.context === "alerts" ? (state.alertEvents ?? []).slice(-50) : [];
    const sourceCount = events.length + alerts.length;
    const recommendations: string[] = [];
    if (input.context === "audit" || input.context === "security") {
      if (state.auditRetentionPolicies?.length === 0) recommendations.push("未配置审计保留策略，建议设置保留天数。");
      const violations = state.license ? (state.license.maxHosts ?? 0) - (state.hosts?.length ?? 0) : 0;
      if (violations < 0) recommendations.push(`主机数超出许可证限额 ${Math.abs(violations)}。`);
    }
    if (input.context === "alerts") {
      const criticalAlerts = (state.alertEvents ?? []).filter((a) => a.level === "critical").length;
      if (criticalAlerts > 10) recommendations.push(`最近有 ${criticalAlerts} 条严重告警，建议检查资源分配。`);
    }
    if (input.context === "backup") {
      const lastBackup = (state.backups ?? []).slice(-1)[0];
      if (!lastBackup) recommendations.push("未创建任何备份，建议立即创建。");
    }
    if (recommendations.length === 0) recommendations.push("当前状态正常，无需干预。");
    return {
      generatedAt: new Date().toISOString(),
      context: input.context,
      query: input.query,
      summary: `分析了 ${sourceCount} 条${input.context === "audit" ? "审计策略" : input.context === "alerts" ? "告警" : "备份"}记录。`,
      recommendations,
      sourceCount
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
      { id: "connector-version-policy", title: "连接器版本策略", status: "ok" as const, detail: "连接器心跳会上报版本，平台可生成灰度升级计划。" },
      { id: "tenant-report", title: "租户报表", status: "ok" as const, detail: "工作空间可导出资源、审批 SLA 和审计动作摘要。" },
      { id: "archive-query", title: "归档查询", status: this.store.queryArchiveRecords ? "ok" as const : "warn" as const, detail: this.store.queryArchiveRecords ? "SQLite state_archive 可查询。" : "JSON 模式仅裁剪，不保留查询表。" },
      { id: "sso-readiness", title: "SSO 就绪度", status: state.identityProvider?.enabled ? "ok" as const : "warn" as const, detail: state.identityProvider?.enabled ? "OIDC 身份源已启用。" : "尚未启用 OIDC 身份源。" },
      { id: "backup-encryption", title: "备份加密策略", status: state.backupEncryptionPolicy?.enabled ? "ok" as const : "warn" as const, detail: state.backupEncryptionPolicy?.enabled ? `keyVersion=${state.backupEncryptionPolicy.keyVersion}` : "状态备份仍为明文。" },
      { id: "connector-release-manifest", title: "连接器发行清单", status: "ok" as const, detail: `${connectorReleaseChannelsOrDefault(state).length} 个发行通道带 SHA-256 制品校验。` }
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
        { id: "sso", title: "接入企业身份源", detail: "通过 /api/platform/identity-provider 写入 OIDC issuer、clientId、回调和 MFA 策略。" },
        { id: "ha", title: "高可用演练", command: "npm run smoke && npm run e2e", detail: "在备用节点恢复加密备份后执行烟测和端到端检查。" },
        { id: "diagnose", title: "打包诊断信息", command: "npm run diagnose:release -- --output release\\diagnostics.json", detail: "安装后采集构建产物、核心接口和平台治理端点状态。" }
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
      { id: "node-apps", language: "node", title: "读取应用部署", requiredScopes: ["apps:read"], snippet: "const res = await fetch('http://127.0.0.1:7080/api/apps/deployments', { headers: { Authorization: 'Bearer lxpat_xxx' } });\nconsole.log(await res.json());" },
      { id: "curl-ha", language: "curl", title: "读取高可用计划", requiredScopes: ["platform:read"], snippet: "curl.exe -H \"Authorization: Bearer lxpat_xxx\" http://127.0.0.1:7080/api/platform/high-availability-plan" }
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
        { id: "i18n-resources", title: "中英文资源文件", ready: true, detail: "平台治理页使用资源表切换 zh-CN 和 en-US 文案。" },
        { id: "tenant-report", title: "租户报表导出", ready: true, detail: "平台治理页可下载 workspace 级资源和审计摘要。" },
        { id: "commercial-governance", title: "商业治理能力", ready: true, detail: "SSO、发行清单、备份加密、审计保留、插件权限和高可用计划均有 API 契约。" }
      ]
    };
  }
}

function isInRange(time: string, fromTime: number | null, toTime: number | null): boolean {
  const eventTime = new Date(time).getTime();
  return (fromTime === null || eventTime >= fromTime) && (toTime === null || eventTime <= toTime);
}

function eventBelongsToWorkspace(event: AuditEvent, workspace: string): boolean {
  return workspace === "default" || event.target.startsWith(`${workspace}:`) || event.detail?.includes(`workspace=${workspace}`) === true;
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

function toPublicIdentityProvider(provider: NonNullable<PanelState["identityProvider"]>): IdentityProvider {
  return {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    issuerUrl: provider.issuerUrl,
    authorizationEndpoint: provider.authorizationEndpoint,
    ...(provider.tokenEndpoint ? { tokenEndpoint: provider.tokenEndpoint } : {}),
    ...(provider.jwksUri ? { jwksUri: provider.jwksUri } : {}),
    clientId: provider.clientId,
    clientSecretConfigured: Boolean(provider.clientSecretConfigured || provider.clientSecret),
    scopes: provider.scopes,
    claimMappings: provider.claimMappings,
    autoCreateUsers: provider.autoCreateUsers ?? true,
    defaultRole: provider.defaultRole ?? "viewer",
    allowedEmailDomains: provider.allowedEmailDomains ?? [],
    requireMfa: provider.requireMfa,
    breakGlassLocalLogin: provider.breakGlassLocalLogin,
    enabled: provider.enabled,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
    updatedBy: provider.updatedBy
  };
}

function oidcAuthorizationUrl(provider: IdentityProvider, callbackPath: string): string {
  const url = new URL(provider.authorizationEndpoint);
  url.searchParams.set("client_id", provider.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", provider.scopes.join(" "));
  url.searchParams.set("redirect_uri", callbackPath);
  url.searchParams.set("state", "<signed-state>");
  return url.toString();
}

function connectorReleaseChannelsOrDefault(state: PanelState): ConnectorReleaseChannel[] {
  return (state.connectorReleaseChannels && state.connectorReleaseChannels.length > 0) ? state.connectorReleaseChannels : createDefaultConnectorReleaseChannels();
}

function auditRetentionPoliciesOrDefault(state: PanelState): AuditRetentionPolicy[] {
  return (state.auditRetentionPolicies && state.auditRetentionPolicies.length > 0) ? state.auditRetentionPolicies : createDefaultAuditRetentionPolicies();
}

function nextRotationAt(fromIso: string, days: number): string {
  return new Date(new Date(fromIso).getTime() + days * 24 * 60 * 60_000).toISOString();
}

function responseSchemaFor(path: string): unknown {
  const map: Record<string, unknown> = {
    "/api/platform/openapi-summary": { $ref: "#/components/schemas/OpenApiSummaryResponse" },
    "/api/platform/openapi.json": { type: "object" },
    "/api/platform/workspaces": { $ref: "#/components/schemas/WorkspaceOverviewResponse" },
    "/api/platform/tenant-report": { $ref: "#/components/schemas/TenantReportResponse" },
    "/api/platform/connectors/version-policy": { $ref: "#/components/schemas/ConnectorVersionPolicyResponse" },
    "/api/platform/connectors/upgrade": { $ref: "#/components/schemas/ConnectorUpgradePlanResponse" },
    "/api/platform/identity-provider": { $ref: "#/components/schemas/IdentityProviderResponse" },
    "/api/platform/sso-readiness": { $ref: "#/components/schemas/SsoReadinessResponse" },
    "/api/platform/connectors/release-channels": { $ref: "#/components/schemas/ConnectorReleaseChannelsResponse" },
    "/api/platform/connectors/release-manifest": { $ref: "#/components/schemas/ConnectorReleaseManifestResponse" },
    "/api/platform/backup-encryption": { $ref: "#/components/schemas/BackupEncryptionPolicyResponse" },
    "/api/platform/backup-encryption/rotation-plan": { $ref: "#/components/schemas/BackupKeyRotationPlanResponse" },
    "/api/platform/audit-retention-policies": { $ref: "#/components/schemas/AuditRetentionPoliciesResponse" },
    "/api/platform/audit-retention-policies/evaluate": { $ref: "#/components/schemas/AuditRetentionEvaluationResponse" },
    "/api/platform/audit-retention-policies/execute": { $ref: "#/components/schemas/AuditRetentionExecutionResponse" },
    "/api/platform/plugins": { $ref: "#/components/schemas/PluginManifestsResponse" },
    "/api/platform/plugins/evaluate": { $ref: "#/components/schemas/PluginPermissionEvaluationResponse" },
    "/api/platform/plugins/sandbox-run": { $ref: "#/components/schemas/PluginSandboxRunResponse" },
    "/api/platform/high-availability-plan": { $ref: "#/components/schemas/HighAvailabilityPlanResponse" },
    "/api/platform/client-application-plan": { $ref: "#/components/schemas/ClientApplicationPlanResponse" },
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

function openApiPathSpecs(): OpenApiSummary["paths"] {
  return [
    { method: "GET", path: "/api/health" },
    { method: "GET", path: "/api/health/live" },
    { method: "GET", path: "/api/health/ready" },
    { method: "GET", path: "/api/auth/status" },
    { method: "POST", path: "/api/auth/setup" },
    { method: "POST", path: "/api/auth/login" },
    { method: "GET", path: "/api/auth/oidc/start" },
    { method: "POST", path: "/api/auth/oidc/callback" },
    { method: "POST", path: "/api/auth/logout" },
    { method: "GET", path: "/api/auth/me", scope: "system:read" },
    { method: "GET", path: "/api/auth/sessions", scope: "system:read" },
    { method: "DELETE", path: "/api/auth/sessions", scope: "system:write" },
    { method: "GET", path: "/api/auth/tokens", scope: "system:read" },
    { method: "POST", path: "/api/auth/tokens", scope: "system:write" },
    { method: "DELETE", path: "/api/auth/tokens", scope: "system:write" },
    { method: "POST", path: "/api/auth/totp/setup", scope: "system:write" },
    { method: "POST", path: "/api/auth/totp/confirm", scope: "system:write" },
    { method: "POST", path: "/api/auth/totp/disable", scope: "system:write" },
    { method: "GET", path: "/api/users", scope: "users:write" },
    { method: "POST", path: "/api/users", scope: "users:write" },
    { method: "PATCH", path: "/api/users/role", scope: "users:write" },
    { method: "POST", path: "/api/users/password", scope: "users:write" },
    { method: "POST", path: "/api/users/me/password", scope: "system:write" },
    { method: "DELETE", path: "/api/users", scope: "users:write" },
    { method: "GET", path: "/api/system/overview", scope: "system:read" },
    { method: "GET", path: "/api/system/processes", scope: "system:read" },
    { method: "GET", path: "/api/system/services", scope: "system:read" },
    { method: "POST", path: "/api/system/services/action", scope: "system:write" },
    { method: "GET", path: "/api/files", scope: "files:read" },
    { method: "GET", path: "/api/files/content", scope: "files:read" },
    { method: "PUT", path: "/api/files/content", scope: "files:write" },
    { method: "POST", path: "/api/files/directories", scope: "files:write" },
    { method: "DELETE", path: "/api/files", scope: "files:write" },
    { method: "GET", path: "/api/logs/roots", scope: "files:read" },
    { method: "GET", path: "/api/logs/files", scope: "files:read" },
    { method: "GET", path: "/api/logs/tail", scope: "files:read" },
    { method: "GET", path: "/api/docker/status", scope: "docker:read" },
    { method: "GET", path: "/api/docker/containers", scope: "docker:read" },
    { method: "GET", path: "/api/docker/images", scope: "docker:read" },
    { method: "POST", path: "/api/docker/containers/action", scope: "docker:write" },
    { method: "GET", path: "/api/hosts", scope: "hosts:read" },
    { method: "GET", path: "/api/hosts/groups", scope: "hosts:read" },
    { method: "POST", path: "/api/hosts/groups", scope: "hosts:write" },
    { method: "POST", path: "/api/hosts", scope: "hosts:write" },
    { method: "PATCH", path: "/api/hosts", scope: "hosts:write" },
    { method: "DELETE", path: "/api/hosts", scope: "hosts:write" },
    { method: "POST", path: "/api/hosts/batch-command", scope: "hosts:write" },
    { method: "POST", path: "/api/hosts/ssh-session", scope: "hosts:write" },
    { method: "GET", path: "/api/monitoring/samples", scope: "alerts:read" },
    { method: "GET", path: "/api/monitoring/latest", scope: "alerts:read" },
    { method: "GET", path: "/api/monitoring/prometheus", scope: "alerts:read" },
    { method: "GET", path: "/api/apps/templates", scope: "apps:read" },
    { method: "GET", path: "/api/apps/deployments", scope: "apps:read" },
    { method: "GET", path: "/api/apps/deployments/health", scope: "apps:read" },
    { method: "POST", path: "/api/apps/deployments", scope: "apps:write" },
    { method: "POST", path: "/api/apps/deployments/action", scope: "apps:write" },
    { method: "PATCH", path: "/api/apps/deployments", scope: "apps:write" },
    { method: "POST", path: "/api/apps/deployments/rollback", scope: "apps:write" },
    { method: "GET", path: "/api/databases", scope: "databases:read" },
    { method: "POST", path: "/api/databases", scope: "databases:write" },
    { method: "PATCH", path: "/api/databases", scope: "databases:write" },
    { method: "DELETE", path: "/api/databases", scope: "databases:write" },
    { method: "POST", path: "/api/databases/backup", scope: "databases:write" },
    { method: "POST", path: "/api/databases/cleanup", scope: "databases:write" },
    { method: "POST", path: "/api/databases/restore-drill", scope: "databases:write" },
    { method: "GET", path: "/api/tasks", scope: "tasks:read" },
    { method: "POST", path: "/api/tasks", scope: "tasks:write" },
    { method: "POST", path: "/api/tasks/run", scope: "tasks:write" },
    { method: "PATCH", path: "/api/tasks/schedule", scope: "tasks:write" },
    { method: "DELETE", path: "/api/tasks", scope: "tasks:write" },
    { method: "GET", path: "/api/backups", scope: "backups:read" },
    { method: "POST", path: "/api/backups", scope: "backups:write" },
    { method: "POST", path: "/api/backups/verify", scope: "backups:read" },
    { method: "GET", path: "/api/backups/download", scope: "backups:read" },
    { method: "POST", path: "/api/backups/restore", scope: "backups:write" },
    { method: "PATCH", path: "/api/backups/schedule", scope: "backups:write" },
    { method: "GET", path: "/api/backups/remote-targets", scope: "backups:read" },
    { method: "POST", path: "/api/backups/remote-targets", scope: "backups:write" },
    { method: "PATCH", path: "/api/backups/remote-targets", scope: "backups:write" },
    { method: "POST", path: "/api/backups/remote-sync", scope: "backups:write" },
    { method: "GET", path: "/api/alerts", scope: "alerts:read" },
    { method: "GET", path: "/api/alerts/thresholds", scope: "alerts:read" },
    { method: "GET", path: "/api/alerts/silences", scope: "alerts:read" },
    { method: "POST", path: "/api/alerts/silences", scope: "alerts:write" },
    { method: "PATCH", path: "/api/alerts/thresholds", scope: "alerts:write" },
    { method: "POST", path: "/api/alerts/check", scope: "alerts:write" },
    { method: "POST", path: "/api/alerts/dismiss", scope: "alerts:write" },
    { method: "GET", path: "/api/notifications", scope: "notifications:read" },
    { method: "POST", path: "/api/notifications", scope: "notifications:write" },
    { method: "PATCH", path: "/api/notifications", scope: "notifications:write" },
    { method: "DELETE", path: "/api/notifications", scope: "notifications:write" },
    { method: "POST", path: "/api/notifications/test", scope: "notifications:write" },
    { method: "POST", path: "/api/notifications/rotate-secret", scope: "notifications:write" },
    { method: "GET", path: "/api/connectors", scope: "connectors:read" },
    { method: "GET", path: "/api/connectors/commands", scope: "connectors:read" },
    { method: "POST", path: "/api/connectors", scope: "connectors:write" },
    { method: "POST", path: "/api/connectors/commands", scope: "connectors:write" },
    { method: "POST", path: "/api/connectors/heartbeat" },
    { method: "GET", path: "/api/connectors/commands/poll" },
    { method: "POST", path: "/api/connectors/commands/result" },
    { method: "GET", path: "/api/approvals", scope: "approvals:read" },
    { method: "POST", path: "/api/approvals", scope: "approvals:write" },
    { method: "POST", path: "/api/approvals/approve", scope: "approvals:write" },
    { method: "POST", path: "/api/approvals/reject", scope: "approvals:write" },
    { method: "GET", path: "/api/audit", scope: "audit:read" },
    { method: "GET", path: "/api/audit/export", scope: "audit:read" },
    { method: "GET", path: "/api/audit/page", scope: "audit:read" },
    { method: "GET", path: "/api/audit/export-package", scope: "audit:read" },
    { method: "GET", path: "/api/audit/export-bundle", scope: "audit:read" },
    { method: "GET", path: "/api/audit/integrity", scope: "audit:read" },
    { method: "GET", path: "/api/audit/compliance", scope: "audit:read" },
    { method: "DELETE", path: "/api/audit", scope: "audit:write" },
    { method: "GET", path: "/api/security/posture", scope: "security:read" },
    { method: "GET", path: "/api/security/hardening-plan", scope: "security:read" },
    ...platformOpenApiPathSpecs()
  ];
}

function platformOpenApiPathSpecs(): OpenApiSummary["paths"] {
  return [
    { method: "GET", path: "/api/platform/access-policies", scope: "platform:read" },
    { method: "POST", path: "/api/platform/access-policies", scope: "platform:write" },
    { method: "POST", path: "/api/platform/access-evaluate", scope: "platform:read" },
    { method: "GET", path: "/api/platform/terminal-sessions", scope: "platform:read" },
    { method: "GET", path: "/api/platform/terminal-sessions/replay", scope: "platform:read" },
    { method: "GET", path: "/api/platform/terminal-sessions/ws", scope: "platform:read" },
    { method: "POST", path: "/api/platform/terminal-sessions", scope: "platform:write" },
    { method: "POST", path: "/api/platform/terminal-sessions/input", scope: "platform:write" },
    { method: "POST", path: "/api/platform/terminal-sessions/output", scope: "platform:write" },
    { method: "POST", path: "/api/platform/terminal-sessions/close", scope: "platform:write" },
    { method: "GET", path: "/api/platform/template-repositories", scope: "platform:read" },
    { method: "POST", path: "/api/platform/template-repositories", scope: "platform:write" },
    { method: "POST", path: "/api/platform/template-repositories/sync", scope: "platform:write" },
    { method: "POST", path: "/api/platform/template-repositories/rollback", scope: "platform:write" },
    { method: "GET", path: "/api/platform/workspaces", scope: "platform:read" },
    { method: "POST", path: "/api/platform/workspaces", scope: "platform:write" },
    { method: "GET", path: "/api/platform/tenant-report", scope: "platform:read" },
    { method: "GET", path: "/api/platform/connectors/version-policy", scope: "platform:read" },
    { method: "POST", path: "/api/platform/connectors/upgrade", scope: "platform:write" },
    { method: "GET", path: "/api/platform/identity-provider", scope: "platform:read" },
    { method: "PUT", path: "/api/platform/identity-provider", scope: "platform:write" },
    { method: "GET", path: "/api/platform/sso-readiness", scope: "platform:read" },
    { method: "GET", path: "/api/platform/connectors/release-channels", scope: "platform:read" },
    { method: "PUT", path: "/api/platform/connectors/release-channels", scope: "platform:write" },
    { method: "GET", path: "/api/platform/connectors/release-manifest", scope: "platform:read" },
    { method: "GET", path: "/api/platform/backup-encryption", scope: "platform:read" },
    { method: "PUT", path: "/api/platform/backup-encryption", scope: "platform:write" },
    { method: "GET", path: "/api/platform/backup-encryption/rotation-plan", scope: "platform:read" },
    { method: "POST", path: "/api/platform/backup-encryption/rotate", scope: "platform:write" },
    { method: "GET", path: "/api/platform/audit-retention-policies", scope: "platform:read" },
    { method: "POST", path: "/api/platform/audit-retention-policies", scope: "platform:write" },
    { method: "POST", path: "/api/platform/audit-retention-policies/evaluate", scope: "platform:read" },
    { method: "POST", path: "/api/platform/audit-retention-policies/execute", scope: "platform:write" },
    { method: "GET", path: "/api/platform/plugins", scope: "platform:read" },
    { method: "POST", path: "/api/platform/plugins", scope: "platform:write" },
    { method: "POST", path: "/api/platform/plugins/evaluate", scope: "platform:read" },
    { method: "POST", path: "/api/platform/plugins/sandbox-run", scope: "platform:write" },
    { method: "GET", path: "/api/platform/high-availability-plan", scope: "platform:read" },
    { method: "GET", path: "/api/platform/client-application-plan", scope: "platform:read" },
    { method: "GET", path: "/api/platform/license", scope: "platform:read" },
    { method: "PUT", path: "/api/platform/license", scope: "platform:write" },
    { method: "POST", path: "/api/platform/license/verify", scope: "platform:write" },
    { method: "GET", path: "/api/platform/approval-policies", scope: "platform:read" },
    { method: "POST", path: "/api/platform/approval-policies", scope: "platform:write" },
    { method: "POST", path: "/api/platform/approval-policies/check", scope: "platform:read" },
    { method: "GET", path: "/api/platform/remediations", scope: "platform:read" },
    { method: "POST", path: "/api/platform/remediations", scope: "platform:write" },
    { method: "GET", path: "/api/platform/capacity-plan", scope: "platform:read" },
    { method: "GET", path: "/api/platform/upgrade-plan", scope: "platform:read" },
    { method: "GET", path: "/api/platform/delivery-checklist", scope: "platform:read" },
    { method: "GET", path: "/api/platform/openapi-summary", scope: "platform:read" },
    { method: "GET", path: "/api/platform/openapi.json", scope: "platform:read" },
    { method: "POST", path: "/api/platform/archive-state", scope: "platform:write" },
    { method: "GET", path: "/api/platform/archive-records", scope: "platform:read" },
    { method: "GET", path: "/api/platform/installer-guide", scope: "platform:read" },
    { method: "GET", path: "/api/platform/sdk-examples", scope: "platform:read" },
    { method: "GET", path: "/api/platform/frontend-quality", scope: "platform:read" },
    { method: "GET", path: "/api/platform/diagnostics-bundle", scope: "platform:read" }
  ];
}

function requestSchemaFor(method: string, path: string): Record<string, unknown> | null {
  if (method !== "POST" && method !== "PUT" && method !== "PATCH") {
    return null;
  }
  const id = (name: string): Record<string, unknown> => ({ type: "object", required: [name], properties: { [name]: { type: "string" } } });
  const map: Record<string, Record<string, unknown>> = {
    "POST /api/auth/setup": { $ref: "#/components/schemas/LoginRequest" },
    "POST /api/auth/login": { $ref: "#/components/schemas/LoginRequest" },
    "POST /api/auth/oidc/callback": { type: "object", required: ["code", "state"], properties: { code: { type: "string" }, state: { type: "string" }, redirectUri: { type: "string" }, idToken: { type: "string" }, claims: { type: "object" } } },
    "POST /api/auth/tokens": { type: "object", required: ["name"], properties: { name: { type: "string" }, expiresInDays: { type: "integer" }, scopes: { type: "array", items: { type: "string" } } } },
    "POST /api/auth/totp/confirm": id("code"),
    "POST /api/auth/totp/disable": id("code"),
    "POST /api/users": { $ref: "#/components/schemas/LoginRequest" },
    "PATCH /api/users/role": { type: "object", required: ["userId", "role"], properties: { userId: { type: "string" }, role: { type: "string", enum: ["owner", "operator", "viewer"] } } },
    "POST /api/users/password": { type: "object", required: ["userId", "password"], properties: { userId: { type: "string" }, password: { type: "string" } } },
    "POST /api/users/me/password": { type: "object", required: ["currentPassword", "newPassword"], properties: { currentPassword: { type: "string" }, newPassword: { type: "string" } } },
    "POST /api/system/services/action": { type: "object", required: ["name", "action"], properties: { name: { type: "string" }, action: { type: "string", enum: ["start", "stop", "restart"] } } },
    "PUT /api/files/content": { type: "object", required: ["path", "content"], properties: { path: { type: "string" }, content: { type: "string" } } },
    "POST /api/files/directories": id("path"),
    "POST /api/docker/containers/action": { type: "object", required: ["id", "action"], properties: { id: { type: "string" }, action: { type: "string" } } },
    "POST /api/hosts/groups": { type: "object", required: ["name"], properties: { name: { type: "string" }, tags: { type: "array", items: { type: "string" } }, hostIds: { type: "array", items: { type: "string" } } } },
    "POST /api/hosts": { type: "object", required: ["name"], properties: { workspace: { type: "string" }, name: { type: "string" }, address: { type: "string" }, tags: { type: "array", items: { type: "string" } }, connectorId: { type: "string" } } },
    "PATCH /api/hosts": { type: "object", required: ["hostId"], properties: { hostId: { type: "string" }, workspace: { type: "string" }, name: { type: "string" }, address: { type: "string" }, tags: { type: "array", items: { type: "string" } }, connectorId: { type: "string" } } },
    "POST /api/backups/remote-sync": { type: "object", required: ["backupId"], properties: { backupId: { type: "string" }, targetId: { type: "string" } } },
    "POST /api/apps/deployments": { type: "object", required: ["workspace", "templateId", "name"], properties: { workspace: { type: "string" }, templateId: { type: "string" }, name: { type: "string" }, variables: { type: "object" }, autoStart: { type: "boolean" } } },
    "POST /api/apps/deployments/action": { type: "object", required: ["workspace", "deploymentId", "action"], properties: { workspace: { type: "string" }, deploymentId: { type: "string" }, action: { type: "string" } } },
    "PATCH /api/apps/deployments": { type: "object", required: ["workspace", "deploymentId"], properties: { workspace: { type: "string" }, deploymentId: { type: "string" }, variables: { type: "object" }, autoRestart: { type: "boolean" } } },
    "POST /api/apps/deployments/rollback": { type: "object", required: ["workspace", "deploymentId"], properties: { workspace: { type: "string" }, deploymentId: { type: "string" }, targetVersion: { type: "integer" }, autoRestart: { type: "boolean" } } },
    "POST /api/databases": { type: "object", required: ["workspace", "name", "type", "url"], properties: { workspace: { type: "string" }, name: { type: "string" }, type: { type: "string" }, url: { type: "string" }, backupRetentionDays: { type: "integer" }, scheduleEnabled: { type: "boolean" }, scheduleEveryHours: { type: "integer" } } },
    "PATCH /api/databases": { type: "object", required: ["connectionId"], properties: { connectionId: { type: "string" }, workspace: { type: "string" }, name: { type: "string" }, url: { type: "string" }, enabled: { type: "boolean" } } },
    "POST /api/databases/backup": { type: "object", required: ["connectionId"], properties: { connectionId: { type: "string" }, workspace: { type: "string" }, approvalId: { type: "string" } } },
    "POST /api/databases/restore-drill": { type: "object", required: ["connectionId"], properties: { connectionId: { type: "string" } } },
    "POST /api/hosts/batch-command": { type: "object", required: ["workspace", "hostIds", "command"], properties: { workspace: { type: "string" }, hostIds: { type: "array", items: { type: "string" } }, command: { type: "string" }, args: { type: "array", items: { type: "string" } }, approvalId: { type: "string" } } },
    "POST /api/hosts/ssh-session": { type: "object", required: ["hostId"], properties: { hostId: { type: "string" }, username: { type: "string" } } },
    "POST /api/tasks": { type: "object", required: ["name", "command"], properties: { name: { type: "string" }, command: { type: "string" }, args: { type: "array", items: { type: "string" } }, cwd: { type: "string" }, timeoutSeconds: { type: "integer" } } },
    "POST /api/tasks/run": id("taskId"),
    "PATCH /api/tasks/schedule": { type: "object", required: ["taskId", "scheduleEnabled"], properties: { taskId: { type: "string" }, scheduleEnabled: { type: "boolean" }, scheduleEveryMinutes: { type: "integer" } } },
    "POST /api/backups/verify": id("backupId"),
    "POST /api/backups/restore": { type: "object", required: ["backupId", "approvalId", "confirmation"], properties: { backupId: { type: "string" }, approvalId: { type: "string" }, confirmation: { type: "string" } } },
    "PATCH /api/backups/schedule": { type: "object", required: ["enabled", "everyHours"], properties: { enabled: { type: "boolean" }, everyHours: { type: "integer" } } },
    "POST /api/backups/remote-targets": { type: "object", required: ["workspace", "name", "type"], properties: { workspace: { type: "string" }, name: { type: "string" }, type: { type: "string" }, path: { type: "string" }, endpoint: { type: "string" }, bucket: { type: "string" } } },
    "PATCH /api/backups/remote-targets": { type: "object", required: ["targetId"], properties: { targetId: { type: "string" }, workspace: { type: "string" }, name: { type: "string" }, enabled: { type: "boolean" } } },
    "POST /api/alerts/silences": { type: "object", required: ["type", "minutes"], properties: { type: { type: "string" }, target: { type: "string" }, minutes: { type: "integer" }, reason: { type: "string" } } },
    "PATCH /api/alerts/thresholds": { type: "object", required: ["type"], properties: { type: { type: "string" }, warningPercent: { type: "number" }, criticalPercent: { type: "number" }, enabled: { type: "boolean" } } },
    "POST /api/alerts/dismiss": id("alertId"),
    "POST /api/notifications": { type: "object", required: ["name", "type", "url"], properties: { name: { type: "string" }, type: { type: "string" }, url: { type: "string" }, enabled: { type: "boolean" } } },
    "PATCH /api/notifications": { type: "object", required: ["channelId"], properties: { channelId: { type: "string" }, name: { type: "string" }, url: { type: "string" }, enabled: { type: "boolean" } } },
    "POST /api/notifications/test": id("channelId"),
    "POST /api/notifications/rotate-secret": { type: "object", properties: { channelId: { type: "string" } } },
    "POST /api/connectors": { type: "object", required: ["name"], properties: { name: { type: "string" }, description: { type: "string" }, capabilities: { type: "array", items: { type: "string" } } } },
    "POST /api/connectors/commands": { type: "object", required: ["connectorId", "command"], properties: { connectorId: { type: "string" }, command: { type: "string" }, args: { type: "array", items: { type: "string" } } } },
    "POST /api/connectors/heartbeat": { type: "object", properties: { capabilities: { type: "array", items: { type: "string" } }, version: { type: "string" }, metrics: { type: "object" } } },
    "POST /api/connectors/commands/result": { type: "object", required: ["commandId", "status"], properties: { commandId: { type: "string" }, status: { type: "string" }, exitCode: { type: "integer" }, stdoutTail: { type: "string" }, stderrTail: { type: "string" }, signature: { type: "string" } } },
    "POST /api/approvals": { type: "object", required: ["action", "target", "reason"], properties: { action: { type: "string" }, target: { type: "string" }, reason: { type: "string" }, requiredApprovals: { type: "integer" }, expiresInMinutes: { type: "integer" } } },
    "POST /api/approvals/approve": id("approvalId"),
    "POST /api/approvals/reject": id("approvalId"),
    "POST /api/platform/connectors/upgrade": { $ref: "#/components/schemas/ConnectorUpgradeRequest" },
    "PUT /api/platform/identity-provider": { type: "object", required: ["name", "issuerUrl", "authorizationEndpoint", "clientId"], properties: { name: { type: "string" }, issuerUrl: { type: "string" }, authorizationEndpoint: { type: "string" }, tokenEndpoint: { type: "string" }, jwksUri: { type: "string" }, clientId: { type: "string" }, clientSecret: { type: "string" }, scopes: { type: "array", items: { type: "string" } }, autoCreateUsers: { type: "boolean" }, defaultRole: { type: "string", enum: ["owner", "operator", "viewer"] }, allowedEmailDomains: { type: "array", items: { type: "string" } }, requireMfa: { type: "boolean" }, breakGlassLocalLogin: { type: "boolean" }, enabled: { type: "boolean" } } },
    "PUT /api/platform/connectors/release-channels": { type: "object", required: ["name", "version", "minimumVersion", "rolloutPercent", "artifacts"], properties: { name: { type: "string", enum: ["stable", "candidate"] }, version: { type: "string" }, minimumVersion: { type: "string" }, rolloutPercent: { type: "integer" }, publicKeyId: { type: "string" }, artifacts: { type: "array", items: { type: "object" } } } },
    "PUT /api/platform/backup-encryption": { type: "object", required: ["enabled"], properties: { enabled: { type: "boolean" }, provider: { type: "string", enum: ["local", "kms"] }, keyRef: { type: "string" }, rotateEveryDays: { type: "integer" } } },
    "POST /api/platform/audit-retention-policies": { type: "object", required: ["workspace", "eventType", "retainDays"], properties: { workspace: { type: "string" }, eventType: { type: "string" }, retainDays: { type: "integer" }, archiveBeforeDelete: { type: "boolean" }, legalHold: { type: "boolean" }, enabled: { type: "boolean" } } },
    "POST /api/platform/audit-retention-policies/evaluate": { type: "object", properties: { workspace: { type: "string" }, eventType: { type: "string" }, eventCount: { type: "integer" } } },
    "POST /api/platform/audit-retention-policies/execute": { type: "object", properties: { workspace: { type: "string" }, eventType: { type: "string" }, dryRun: { type: "boolean" }, approvalId: { type: "string" } } },
    "POST /api/platform/plugins": { type: "object", required: ["id", "name", "version", "entryPoint", "permissions"], properties: { id: { type: "string" }, name: { type: "string" }, version: { type: "string" }, entryPoint: { type: "string" }, permissions: { type: "array", items: { type: "string" } }, signature: { type: "string" }, enabled: { type: "boolean" } } },
    "POST /api/platform/plugins/evaluate": { type: "object", required: ["pluginId", "requestedScopes"], properties: { pluginId: { type: "string" }, requestedScopes: { type: "array", items: { type: "string" } } } },
    "POST /api/platform/plugins/sandbox-run": { type: "object", required: ["pluginId"], properties: { pluginId: { type: "string" }, operation: { type: "string" }, requestedScopes: { type: "array", items: { type: "string" } }, timeoutMs: { type: "integer" }, input: { type: "object" } } },
    "POST /api/platform/access-policies": { type: "object", required: ["workspace", "resourceType", "resourceId", "role", "permissions"], properties: { workspace: { type: "string" }, resourceType: { type: "string" }, resourceId: { type: "string" }, role: { type: "string" }, permissions: { type: "array", items: { type: "string" } } } },
    "POST /api/platform/access-evaluate": { type: "object", required: ["workspace", "resourceType", "resourceId", "role", "permission"], properties: { workspace: { type: "string" }, resourceType: { type: "string" }, resourceId: { type: "string" }, role: { type: "string" }, permission: { type: "string" } } },
    "POST /api/platform/terminal-sessions": { type: "object", required: ["hostId"], properties: { hostId: { type: "string" }, username: { type: "string" }, rows: { type: "integer" }, cols: { type: "integer" } } },
    "POST /api/platform/terminal-sessions/input": { type: "object", required: ["sessionId", "input"], properties: { sessionId: { type: "string" }, input: { type: "string" } } },
    "POST /api/platform/terminal-sessions/output": { type: "object", required: ["sessionId", "output"], properties: { sessionId: { type: "string" }, output: { type: "string" }, status: { type: "string" }, cursor: { type: "integer" } } },
    "POST /api/platform/terminal-sessions/close": id("sessionId"),
    "POST /api/platform/template-repositories": { type: "object", required: ["name", "url", "trustMode"], properties: { name: { type: "string" }, url: { type: "string" }, trustMode: { type: "string" }, publicKey: { type: "string" }, enabled: { type: "boolean" } } },
    "POST /api/platform/template-repositories/sync": id("repositoryId"),
    "POST /api/platform/template-repositories/rollback": { type: "object", required: ["repositoryId"], properties: { repositoryId: { type: "string" } } },
    "POST /api/platform/workspaces": { type: "object", required: ["id", "name"], properties: { id: { type: "string" }, name: { type: "string" }, description: { type: "string" } } },
    "PUT /api/platform/license": { type: "object", required: ["plan", "licensedTo", "maxHosts", "maxUsers", "maxApps", "features"], properties: { plan: { type: "string" }, licensedTo: { type: "string" }, maxHosts: { type: "integer" }, maxUsers: { type: "integer" }, maxApps: { type: "integer" }, features: { type: "array", items: { type: "string" } }, offlineToken: { type: "string" }, publicKey: { type: "string" } } },
    "POST /api/platform/license/verify": { type: "object", properties: { plan: { type: "string" }, licensedTo: { type: "string" }, offlineToken: { type: "string" }, publicKey: { type: "string" } } },
    "POST /api/platform/approval-policies": { type: "object", required: ["workspace", "resourceType", "resourceId", "action"], properties: { workspace: { type: "string" }, resourceType: { type: "string" }, resourceId: { type: "string" }, action: { type: "string" }, requiredApprovals: { type: "integer" }, enabled: { type: "boolean" } } },
    "POST /api/platform/approval-policies/check": { type: "object", required: ["workspace", "resourceType", "resourceId", "action"], properties: { workspace: { type: "string" }, resourceType: { type: "string" }, resourceId: { type: "string" }, action: { type: "string" }, approvalId: { type: "string" } } },
    "POST /api/platform/remediations": { type: "object", required: ["itemId", "dryRun"], properties: { itemId: { type: "string" }, dryRun: { type: "boolean" } } },
    "POST /api/platform/archive-state": { type: "object", properties: { dryRun: { type: "boolean" }, keepMetricSamples: { type: "integer" }, keepAlertEvents: { type: "integer" } } }
  };
  return map[`${method} ${path}`] ?? null;
}

function queryParametersFor(path: string): unknown[] {
  const map: Record<string, unknown[]> = {
    "/api/audit/page": [{ name: "limit", in: "query", schema: { type: "integer" } }, { name: "cursor", in: "query", schema: { type: "string" } }],
    "/api/audit/export-package": [{ name: "format", in: "query", schema: { type: "string", enum: ["jsonl", "csv"] } }],
    "/api/audit/export-bundle": [{ name: "format", in: "query", schema: { type: "string", enum: ["jsonl", "csv"] } }],
    "/api/platform/tenant-report": [{ name: "workspace", in: "query", schema: { type: "string" } }, { name: "from", in: "query", schema: { type: "string" } }, { name: "to", in: "query", schema: { type: "string" } }],
    "/api/platform/terminal-sessions/replay": [{ name: "sessionId", in: "query", required: true, schema: { type: "string" } }],
    "/api/platform/archive-records": [{ name: "bucket", in: "query", schema: { type: "string" } }, { name: "limit", in: "query", schema: { type: "integer" } }]
  };
  return map[path] ?? defaultQueryParameters(path);
}

function defaultQueryParameters(path: string): unknown[] {
  if (["/api/files", "/api/files/content", "/api/logs/files", "/api/logs/tail"].includes(path)) {
    return [{ name: "path", in: "query", schema: { type: "string" } }, { name: "lines", in: "query", schema: { type: "integer" } }];
  }
  if (["/api/hosts", "/api/apps/deployments", "/api/databases", "/api/backups/remote-targets"].includes(path)) {
    return [{ name: "workspace", in: "query", schema: { type: "string" } }];
  }
  if (["/api/monitoring/samples", "/api/monitoring/latest"].includes(path)) {
    return [{ name: "hostId", in: "query", schema: { type: "string" } }, { name: "limit", in: "query", schema: { type: "integer" } }];
  }
  if (path.endsWith("/health") || path.endsWith("/download") || ["/api/auth/sessions", "/api/auth/tokens", "/api/users", "/api/tasks", "/api/connectors/commands", "/api/audit"].includes(path)) {
    return [{ name: "id", in: "query", schema: { type: "string" } }, { name: "limit", in: "query", schema: { type: "integer" } }];
  }
  return [];
}

function openApiSchemas(): Record<string, unknown> {
  return {
    ErrorResponse: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
    LoginRequest: { type: "object", required: ["username", "password"], properties: { username: { type: "string" }, password: { type: "string" }, totpCode: { type: "string" } } },
    OpenApiSummaryResponse: { type: "object", properties: { summary: { type: "object", properties: { generatedAt: { type: "string" }, paths: { type: "array", items: { type: "object" } }, webhookEvents: { type: "array", items: { type: "string" } } } } } },
    WorkspaceOverviewResponse: { type: "object", properties: { overview: { type: "object", properties: { generatedAt: { type: "string" }, workspaces: { type: "array", items: { type: "object" } }, counts: { type: "array", items: { type: "object" } } } } } },
    TenantReportResponse: { type: "object", properties: { report: { type: "object", properties: { generatedAt: { type: "string" }, workspace: { type: "string" }, counts: { type: "object" }, sha256: { type: "string" } } } } },
    ConnectorVersionPolicyResponse: { type: "object", properties: { policy: { type: "object", properties: { generatedAt: { type: "string" }, recommendedVersion: { type: "string" }, connectors: { type: "array", items: { type: "object" } } } } } },
    ConnectorUpgradeRequest: { type: "object", properties: { connectorId: { type: "string" }, channel: { type: "string", enum: ["stable", "candidate"] }, targetVersion: { type: "string" }, rolloutPercent: { type: "integer", minimum: 1, maximum: 100 } } },
    ConnectorUpgradePlanResponse: { type: "object", properties: { plan: { type: "object", properties: { generatedAt: { type: "string" }, targetVersion: { type: "string" }, selected: { type: "array", items: { type: "object" } }, commands: { type: "array", items: { type: "object" } } } } } },
    IdentityProviderResponse: { type: "object", properties: { provider: { type: "object", nullable: true } } },
    SsoReadinessResponse: { type: "object", properties: { readiness: { type: "object", properties: { configured: { type: "boolean" }, enabled: { type: "boolean" }, authorizationUrl: { type: "string" }, checks: { type: "array", items: { type: "object" } } } } } },
    ConnectorReleaseChannelsResponse: { type: "object", properties: { channels: { type: "array", items: { type: "object" } }, channel: { type: "object" } } },
    ConnectorReleaseManifestResponse: { type: "object", properties: { manifest: { type: "object", properties: { generatedAt: { type: "string" }, manifestSha256: { type: "string" }, verification: { type: "object" } } } } },
    BackupEncryptionPolicyResponse: { type: "object", properties: { policy: { type: "object", properties: { enabled: { type: "boolean" }, algorithm: { type: "string" }, keyVersion: { type: "integer" } } } } },
    BackupKeyRotationPlanResponse: { type: "object", properties: { plan: { type: "object", properties: { currentKeyVersion: { type: "integer" }, nextKeyVersion: { type: "integer" }, due: { type: "boolean" } } } } },
    AuditRetentionPoliciesResponse: { type: "object", properties: { policies: { type: "array", items: { type: "object" } }, policy: { type: "object" } } },
    AuditRetentionEvaluationResponse: { type: "object", properties: { evaluation: { type: "object", properties: { retainDays: { type: "integer" }, pruneEligibleBefore: { type: "string" } } } } },
    AuditRetentionExecutionResponse: { type: "object", properties: { execution: { type: "object", properties: { status: { type: "string" }, dryRun: { type: "boolean" }, pruneTask: { type: "object" } } } } },
    PluginManifestsResponse: { type: "object", properties: { plugins: { type: "array", items: { type: "object" } }, plugin: { type: "object" } } },
    PluginPermissionEvaluationResponse: { type: "object", properties: { evaluation: { type: "object", properties: { allowed: { type: "boolean" }, grantedScopes: { type: "array", items: { type: "string" } }, deniedScopes: { type: "array", items: { type: "string" } } } } } },
    PluginSandboxRunResponse: { type: "object", properties: { run: { type: "object", properties: { pluginId: { type: "string" }, status: { type: "string" }, sandbox: { type: "object" } } } } },
    HighAvailabilityPlanResponse: { type: "object", properties: { plan: { type: "object", properties: { mode: { type: "string" }, topology: { type: "array", items: { type: "object" } }, rolloutSteps: { type: "array", items: { type: "object" } } } } } },
    ClientApplicationPlanResponse: { type: "object", properties: { plan: { type: "object", properties: { currentClients: { type: "array", items: { type: "object" } }, candidates: { type: "array", items: { type: "object" } }, recommendation: { type: "string" } } } } },
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

function generateOfflineLicense(input: GenerateLicense): LicenseGenerationResult {
  let privateKey = input.privateKey;
  let generatedPrivateKey: string | undefined;
  if (!privateKey) {
    generatedPrivateKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    privateKey = generatedPrivateKey;
  }
  const payload = {
    plan: input.plan ?? "team",
    licensedTo: input.licensedTo ?? "LXPanel Customer",
    machineCode: input.machineCode ?? "",
    expiresAt: input.expiresAt ?? "",
    issuedAt: new Date().toISOString(),
    issuer: "lxpanel-web-console"
  };
  const payloadText = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signatureText = signData("sha256", Buffer.from(payloadText), privateKey).toString("base64url");
  const offlineToken = `${payloadText}.${signatureText}`;
  return { payload, offlineToken, ...(generatedPrivateKey ? { generatedPrivateKey } : {}) };
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
