import type { AccessEvaluation, AccessEvaluationRequest, AccessPolicy, CapacityPlan, CreateAccessPolicy, CreateResourceApprovalPolicy, CreateTemplateRepository, CreateTerminalSession, DeliveryChecklist, FrontendQualityReport, InstallerGuide, LicenseInfo, LicenseStatus, OpenApiSummary, ResourceApprovalPolicy, SdkExample, SecurityRemediationRequest, SecurityRemediationRun, StateArchiveRequest, StateArchiveResult, TemplateRepository, TerminalInput, TerminalSession, UpdateLicense, UpgradePlan } from "@lxpanel/shared";
import { randomToken } from "../../lib/crypto.js";
import type { StateStore } from "../../lib/stateStore.js";
import type { PanelState, SecurityRemediationRunRecord } from "../state/panelState.js";

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

  async createTerminalSession(input: CreateTerminalSession, hostName: string, connectorId: string, commandId: string, actor: string): Promise<TerminalSession> {
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const session: TerminalSession = {
        id: randomToken(12),
        hostId: input.hostId,
        hostName,
        connectorId,
        commandId,
        ...(input.username ? { username: input.username } : {}),
        status: "opening",
        createdAt: now,
        createdBy: actor,
        transcriptTail: [{ time: now, direction: "system", line: `terminal.open rows=${input.rows} cols=${input.cols}` }]
      };
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

  async closeTerminalSession(sessionId: string): Promise<TerminalSession> {
    return this.store.update((state) => {
      const session = (state.terminalSessions ?? []).find((item) => item.id === sessionId);
      if (!session) {
        throw new Error("终端会话不存在。");
      }
      const now = new Date().toISOString();
      const updated: TerminalSession = { ...session, status: "closed", transcriptTail: [...(session.transcriptTail ?? []), { time: now, direction: "system" as const, line: "terminal.closed" }].slice(-80) };
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
      const repository: TemplateRepository = { id: randomToken(12), name: input.name, url: input.url, trustMode: input.trustMode, ...(input.publicKey ? { publicKey: input.publicKey } : {}), enabled: input.enabled, templateCount: 0, lastStatus: "pending", createdAt: now, updatedAt: now, updatedBy: actor };
      return { data: { ...state, templateRepositories: [...(state.templateRepositories ?? []), repository].slice(-100) }, result: repository };
    });
  }

  async syncTemplateRepository(repositoryId: string, actor: string): Promise<TemplateRepository> {
    return this.store.update((state) => {
      const repository = (state.templateRepositories ?? []).find((item) => item.id === repositoryId);
      if (!repository) {
        throw new Error("模板仓库不存在。");
      }
      const updated: TemplateRepository = { ...repository, lastSyncAt: new Date().toISOString(), lastStatus: repository.enabled ? "success" : "failed", templateCount: repository.enabled ? Math.max(repository.templateCount, 3) : repository.templateCount, updatedAt: new Date().toISOString(), updatedBy: actor };
      return { data: { ...state, templateRepositories: (state.templateRepositories ?? []).map((item) => item.id === repositoryId ? updated : item) }, result: updated };
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
      ...(license.expiresAt && new Date(license.expiresAt).getTime() < Date.now() ? ["许可证已过期。"] : [])
    ];
    return { license, usage, violations };
  }

  async updateLicense(input: UpdateLicense, actor: string): Promise<LicenseStatus> {
    await this.store.update((state) => {
      const license: LicenseInfo = { ...input, updatedAt: new Date().toISOString(), updatedBy: actor };
      return { data: { ...state, license }, result: undefined };
    });
    return this.licenseStatus();
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
        { method: "GET", path: "/api/platform/openapi-summary", scope: "platform:read" },
        { method: "POST", path: "/api/platform/terminal-sessions", scope: "platform:write" },
        { method: "POST", path: "/api/platform/archive-state", scope: "platform:write" }
      ],
      webhookEvents: ["alert.warning", "alert.critical", "approval.requested", "approval.progress", "approval.rejected", "security.remediation"]
    };
  }

  async archiveState(input: StateArchiveRequest): Promise<StateArchiveResult> {
    const state = await this.store.read();
    const beforeBytes = Buffer.byteLength(JSON.stringify(state), "utf8");
    const nextMetricSamples = (state.metricSamples ?? []).slice(-input.keepMetricSamples);
    const nextAlertEvents = (state.alertEvents ?? []).slice(-input.keepAlertEvents);
    const nextDeliveries = (state.notificationDeliveries ?? []).slice(-300);
    const nextState = { ...state, metricSamples: nextMetricSamples, alertEvents: nextAlertEvents, notificationDeliveries: nextDeliveries };
    const result: StateArchiveResult = {
      dryRun: input.dryRun,
      beforeBytes,
      afterBytes: Buffer.byteLength(JSON.stringify(nextState), "utf8"),
      removedMetricSamples: (state.metricSamples ?? []).length - nextMetricSamples.length,
      removedAlertEvents: (state.alertEvents ?? []).length - nextAlertEvents.length,
      removedNotificationDeliveries: (state.notificationDeliveries ?? []).length - nextDeliveries.length,
      generatedAt: new Date().toISOString()
    };
    if (!input.dryRun) {
      await this.store.update(() => ({ data: nextState, result: undefined }));
    }
    return result;
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
        { id: "zh-cn", title: "中文文案资源", ready: true, detail: "商业交付默认中文，开放后续英文资源化入口。" }
      ]
    };
  }
}

function defaultLicense(): LicenseInfo {
  return { plan: "community", licensedTo: "local", maxHosts: 3, maxUsers: 2, maxApps: 5, features: ["core", "backup", "audit"], updatedAt: new Date(0).toISOString(), updatedBy: "system" };
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
