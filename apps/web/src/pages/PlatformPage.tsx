import { useEffect, useState } from "react";
import { Accessibility, Archive, ClipboardList, Code2, Database, Download, GitBranch, Globe2, KeyRound, Play, Plus, Send, ShieldCheck, Terminal } from "lucide-react";
import type { AccessPolicy, AuditRetentionEvaluation, AuditRetentionPolicy, BackupEncryptionPolicy, BackupKeyRotationPlan, CapacityPlan, ComplianceReport, ConnectorReleaseManifest, ConnectorUpgradePlan, ConnectorVersionPolicy, DatabaseBackupCleanupResult, DeliveryChecklist, DiagnosticsBundle, FrontendQualityReport, HighAvailabilityPlan, InstallerGuide, LicenseStatus, OpenApiSummary, PluginManifest, ResourceApprovalPolicy, ResourceApprovalPrecheck, SdkExample, SecurityHardeningPlan, SecurityRemediationRun, SsoReadiness, StateArchivePage, StateArchiveResult, TemplateRepository, TenantReport, TerminalReplay, TerminalSession, UpgradePlan, WorkspaceOverview } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { StatusPill } from "../components/StatusPill.js";
import { platformText, type Locale } from "../i18n/resources.js";
import { formatDate } from "../utils/format.js";
import { readDefaultWorkspacePreference, readLocalePreference, saveDefaultWorkspacePreference, saveLocalePreference } from "../utils/preferences.js";

export function PlatformPage(): JSX.Element {
  const [policies, setPolicies] = useState<AccessPolicy[]>([]);
  const [approvalPolicies, setApprovalPolicies] = useState<ResourceApprovalPolicy[]>([]);
  const [terminalSessions, setTerminalSessions] = useState<TerminalSession[]>([]);
  const [repositories, setRepositories] = useState<TemplateRepository[]>([]);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [runs, setRuns] = useState<SecurityRemediationRun[]>([]);
  const [hardening, setHardening] = useState<SecurityHardeningPlan | null>(null);
  const [capacity, setCapacity] = useState<CapacityPlan | null>(null);
  const [upgrade, setUpgrade] = useState<UpgradePlan | null>(null);
  const [delivery, setDelivery] = useState<DeliveryChecklist | null>(null);
  const [openApi, setOpenApi] = useState<OpenApiSummary | null>(null);
  const [openApiPaths, setOpenApiPaths] = useState(0);
  const [compliance, setCompliance] = useState<ComplianceReport | null>(null);
  const [archiveResult, setArchiveResult] = useState<StateArchiveResult | null>(null);
  const [cleanupResult, setCleanupResult] = useState<DatabaseBackupCleanupResult | null>(null);
  const [installer, setInstaller] = useState<InstallerGuide | null>(null);
  const [sdkExamples, setSdkExamples] = useState<SdkExample[]>([]);
  const [quality, setQuality] = useState<FrontendQualityReport | null>(null);
  const [workspaceOverview, setWorkspaceOverview] = useState<WorkspaceOverview | null>(null);
  const [connectorPolicy, setConnectorPolicy] = useState<ConnectorVersionPolicy | null>(null);
  const [ssoReadiness, setSsoReadiness] = useState<SsoReadiness | null>(null);
  const [releaseManifest, setReleaseManifest] = useState<ConnectorReleaseManifest | null>(null);
  const [backupEncryption, setBackupEncryption] = useState<BackupEncryptionPolicy | null>(null);
  const [backupRotation, setBackupRotation] = useState<BackupKeyRotationPlan | null>(null);
  const [retentionPolicies, setRetentionPolicies] = useState<AuditRetentionPolicy[]>([]);
  const [retentionEvaluation, setRetentionEvaluation] = useState<AuditRetentionEvaluation | null>(null);
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);
  const [haPlan, setHaPlan] = useState<HighAvailabilityPlan | null>(null);
  const [upgradePlan, setUpgradePlan] = useState<ConnectorUpgradePlan | null>(null);
  const [tenantReport, setTenantReport] = useState<TenantReport | null>(null);
  const [terminalReplay, setTerminalReplay] = useState<TerminalReplay | null>(null);
  const [approvalPrecheck, setApprovalPrecheck] = useState<ResourceApprovalPrecheck | null>(null);
  const [archivePage, setArchivePage] = useState<StateArchivePage | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsBundle | null>(null);
  const [locale, setLocale] = useState<Locale>(() => readLocalePreference());
  const [workspace, setWorkspace] = useState(() => readDefaultWorkspacePreference());
  const [workspaceName, setWorkspaceName] = useState("客户项目");
  const [resourceType, setResourceType] = useState<AccessPolicy["resourceType"]>("host");
  const [resourceId, setResourceId] = useState("*");
  const [role, setRole] = useState<AccessPolicy["role"]>("operator");
  const [permission, setPermission] = useState("read");
  const [terminalHostId, setTerminalHostId] = useState("");
  const [terminalUser, setTerminalUser] = useState("");
  const [terminalInput, setTerminalInput] = useState("");
  const [repositoryName, setRepositoryName] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [licensePlan, setLicensePlan] = useState<"community" | "team" | "enterprise">("team");
  const [licenseTo, setLicenseTo] = useState("customer");
  const [licenseToken, setLicenseToken] = useState("");
  const [licensePublicKey, setLicensePublicKey] = useState("");
  const [approvalAction, setApprovalAction] = useState("backup.restore");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const text = platformText[locale];

  async function load(): Promise<void> {
    try {
      const [policyResponse, approvalPolicyResponse, terminalResponse, repositoryResponse, licenseResponse, workspaceResponse, connectorPolicyResponse, ssoResponse, releaseResponse, backupEncryptionResponse, backupRotationResponse, retentionResponse, retentionEvaluationResponse, pluginsResponse, haResponse, remediationResponse, hardeningResponse, capacityResponse, upgradeResponse, deliveryResponse, openApiResponse, openApiDocumentResponse, complianceResponse, installerResponse, sdkResponse, qualityResponse] = await Promise.all([
        api.accessPolicies(), api.approvalPolicies(), api.terminalSessions(), api.templateRepositories(), api.licenseStatus(), api.workspaces(), api.connectorVersionPolicy(), api.ssoReadiness(), api.connectorReleaseManifest(), api.backupEncryptionPolicy(), api.backupKeyRotationPlan(), api.auditRetentionPolicies(), api.auditRetentionEvaluation(), api.plugins(), api.highAvailabilityPlan(), api.remediationRuns(), api.securityHardeningPlan(), api.capacityPlan(), api.upgradePlan(), api.deliveryChecklist(), api.openApiSummary(), api.openApiDocument(), api.complianceReport(), api.installerGuide(), api.sdkExamples(), api.frontendQuality()
      ]);
      setPolicies(policyResponse.policies);
      setApprovalPolicies(approvalPolicyResponse.policies);
      setTerminalSessions(terminalResponse.sessions);
      setRepositories(repositoryResponse.repositories);
      setLicenseStatus(licenseResponse.status);
      setWorkspaceOverview(workspaceResponse.overview);
      setConnectorPolicy(connectorPolicyResponse.policy);
      setSsoReadiness(ssoResponse.readiness);
      setReleaseManifest(releaseResponse.manifest);
      setBackupEncryption(backupEncryptionResponse.policy);
      setBackupRotation(backupRotationResponse.plan);
      setRetentionPolicies(retentionResponse.policies);
      setRetentionEvaluation(retentionEvaluationResponse.evaluation);
      setPlugins(pluginsResponse.plugins);
      setHaPlan(haResponse.plan);
      setRuns(remediationResponse.runs);
      setHardening(hardeningResponse.plan);
      setCapacity(capacityResponse.plan);
      setUpgrade(upgradeResponse.plan);
      setDelivery(deliveryResponse.checklist);
      setOpenApi(openApiResponse.summary);
      setOpenApiPaths(Object.keys((openApiDocumentResponse.paths as Record<string, unknown> | undefined) ?? {}).length);
      setCompliance(complianceResponse.report);
      setInstaller(installerResponse.guide);
      setSdkExamples(sdkResponse.examples);
      setQuality(qualityResponse.report);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载平台治理数据失败。");
    }
  }

  async function createPolicy(): Promise<void> {
    try {
      await api.createAccessPolicy({ workspace, resourceType, resourceId, role, permissions: [permission as "read" | "write" | "approve" | "admin"] });
      setNotice("访问策略已保存。");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存访问策略失败。");
    }
  }

  async function createApprovalPolicy(): Promise<void> {
    try {
      await api.createApprovalPolicy({ workspace, resourceType, resourceId, action: approvalAction, requiredApprovals: 2, enabled: true });
      setNotice("资源级审批策略已保存。");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存审批策略失败。");
    }
  }

  async function createWorkspace(): Promise<void> {
    try {
      await api.createWorkspace({ id: workspace, name: workspaceName, description: "created from platform governance" });
      setNotice("工作空间已创建。");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建工作空间失败。");
    }
  }

  async function scheduleConnectorUpgrade(): Promise<void> {
    try {
      const response = await api.scheduleConnectorUpgrade({ channel: "stable", rolloutPercent: 25 });
      setUpgradePlan(response.plan);
      setNotice(`已排队 ${response.plan.selected.length} 个连接器升级。`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成连接器升级计划失败。");
    }
  }

  async function downloadTenantReport(): Promise<void> {
    try {
      const response = await api.tenantReport(workspace);
      setTenantReport(response.report);
      downloadJson(`lxpanel-tenant-report-${workspace}.json`, response.report);
      setNotice(`租户报表已生成：${response.report.sha256.slice(0, 12)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成租户报表失败。");
    }
  }

  async function openTerminal(): Promise<void> {
    try {
      const response = await api.createTerminalSession({ hostId: terminalHostId, username: terminalUser || undefined, rows: 24, cols: 100 });
      setNotice(`终端代理已排队：${response.command.id}`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建终端会话失败。");
    }
  }

  async function sendTerminalInput(sessionId: string): Promise<void> {
    try {
      await api.sendTerminalInput({ sessionId, input: terminalInput });
      setTerminalInput("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "发送终端输入失败。");
    }
  }

  async function replayTerminal(sessionId: string): Promise<void> {
    try {
      const response = await api.terminalReplay(sessionId);
      setTerminalReplay(response.replay);
      setNotice(`终端回放 ${response.replay.lineCount} 行。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "读取终端回放失败。");
    }
  }

  async function createRepository(): Promise<void> {
    try {
      await api.createTemplateRepository({ name: repositoryName, url: repositoryUrl, trustMode: "signed", enabled: true });
      setRepositoryName("");
      setRepositoryUrl("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存模板仓库失败。");
    }
  }

  async function syncRepository(repositoryId: string): Promise<void> {
    try {
      await api.syncTemplateRepository(repositoryId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "同步模板仓库失败。");
    }
  }

  async function rollbackRepository(repositoryId: string): Promise<void> {
    try {
      const response = await api.rollbackTemplateRepository(repositoryId);
      setNotice(`模板仓库已回滚，恢复 ${response.rollback.restoredTemplateIds.length} 个模板。`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "回滚模板仓库失败。");
    }
  }

  async function saveLicense(): Promise<void> {
    try {
      const payload = { plan: licensePlan, licensedTo: licenseTo, maxHosts: licensePlan === "enterprise" ? 500 : 50, maxUsers: licensePlan === "enterprise" ? 200 : 20, maxApps: licensePlan === "enterprise" ? 500 : 50, features: ["terminal", "templates", "audit-package", "offline-delivery"], ...(licenseToken ? { offlineToken: licenseToken } : {}), ...(licensePublicKey ? { publicKey: licensePublicKey } : {}) };
      const response = await api.updateLicense(payload);
      setNotice(response.status.license.verificationStatus === "invalid" ? response.status.license.verificationError ?? "许可证验签失败。" : "许可证已保存。");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存许可证失败。");
    }
  }

  async function verifyLicense(): Promise<void> {
    try {
      const response = await api.verifyLicense({ plan: licensePlan, licensedTo: licenseTo, maxHosts: 1, maxUsers: 1, maxApps: 1, features: [], ...(licenseToken ? { offlineToken: licenseToken } : {}), ...(licensePublicKey ? { publicKey: licensePublicKey } : {}) });
      setNotice(response.result.ok ? `许可证有效，机器码 ${response.result.machineCode}` : response.result.error ?? "许可证验签失败。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "许可证验签失败。");
    }
  }

  async function dryRun(itemId: string): Promise<void> {
    try {
      const response = await api.createRemediationRun({ itemId, dryRun: true });
      setNotice(`${response.run.itemId}: ${response.run.outputTail ?? response.run.status}`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成修复计划失败。");
    }
  }

  async function archiveState(dryRun: boolean): Promise<void> {
    try {
      const response = await api.archiveState({ dryRun, keepMetricSamples: 720, keepAlertEvents: 500 });
      setArchiveResult(response.result);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "状态归档失败。");
    }
  }

  async function loadArchiveRecords(): Promise<void> {
    try {
      const response = await api.archiveRecords("state-history", 20);
      setArchivePage(response.page);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "读取归档记录失败。");
    }
  }

  async function checkApprovalPolicy(): Promise<void> {
    try {
      const response = await api.checkApprovalPolicy({ workspace, resourceType, resourceId, action: approvalAction });
      setApprovalPrecheck(response.precheck);
      setNotice(response.precheck.required ? `命中审批策略，需要 ${response.precheck.requiredApprovals} 人批准。` : "未命中审批策略。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "审批策略预检失败。");
    }
  }

  async function downloadDiagnostics(): Promise<void> {
    try {
      const response = await api.diagnosticsBundle();
      setDiagnostics(response.bundle);
      downloadJson("lxpanel-diagnostics.json", response.bundle);
      setNotice(`诊断包摘要已生成：${response.bundle.sha256.slice(0, 12)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成诊断包失败。");
    }
  }

  function changeLocale(nextLocale: Locale): void {
    setLocale(nextLocale);
    saveLocalePreference(nextLocale);
  }

  function changeWorkspace(nextWorkspace: string): void {
    setWorkspace(nextWorkspace);
    saveDefaultWorkspacePreference(nextWorkspace);
  }

  async function cleanupDatabaseBackups(): Promise<void> {
    try {
      const response = await api.cleanupDatabaseBackups();
      setCleanupResult(response.result);
      setNotice(`数据库备份清理完成：删除 ${response.result.removed} 个。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "数据库备份清理失败。");
    }
  }

  async function downloadAuditBundle(): Promise<void> {
    try {
      await api.downloadAuditBundle("jsonl");
      setNotice("审计签名包已生成。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成审计签名包失败。");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading"><div><h1>{text.title}</h1><p>{text.subtitle}</p></div><select value={locale} onChange={(event) => changeLocale(event.target.value as Locale)} aria-label="Language"><option value="zh-CN">中文</option><option value="en-US">English</option></select></div>
      {error ? <div className="form-error">{error}</div> : null}
      {notice ? <p className="notice">{notice}</p> : null}
      <section className="table-panel">
        <div className="panel-title">{text.terminal}</div>
        <div className="inline-form wrap"><input value={terminalHostId} onChange={(event) => setTerminalHostId(event.target.value)} placeholder="主机 ID" aria-label="主机 ID" /><input value={terminalUser} onChange={(event) => setTerminalUser(event.target.value)} placeholder="SSH 用户" aria-label="SSH 用户" /><button type="button" onClick={() => void openTerminal()}><Terminal size={16} /> 打开</button></div>
        <table><thead><tr><th>主机</th><th>状态</th><th>流式通道</th><th>输入</th></tr></thead><tbody>{terminalSessions.map((session) => <tr key={session.id}><td>{session.hostName}</td><td><StatusPill status={session.status === "failed" ? "failed" : session.status === "closed" ? "inactive" : "active"} label={`${session.status} #${session.outputCursor ?? 0}`} /></td><td><code className="inline-code">{session.streamUrl ?? api.terminalWebSocketUrl(session.id)}</code></td><td className="row-actions"><input value={terminalInput} onChange={(event) => setTerminalInput(event.target.value)} placeholder="输入内容" aria-label="终端输入" /><button title="发送终端输入" onClick={() => void sendTerminalInput(session.id)}><Send size={14} /></button><button title="审计回放" onClick={() => void replayTerminal(session.id)}><ClipboardList size={14} /></button></td></tr>)}</tbody></table>
        {terminalReplay ? <pre className="inline-log">{terminalReplay.lines.map((line) => `[${line.direction}] ${line.line}`).join("\n")}</pre> : null}
      </section>
      <section className="table-panel">
        <div className="panel-title">{text.templates}</div>
        <div className="inline-form wrap"><input value={repositoryName} onChange={(event) => setRepositoryName(event.target.value)} placeholder="仓库名称" /><input value={repositoryUrl} onChange={(event) => setRepositoryUrl(event.target.value)} placeholder="https://templates.example.com/index.json" /><button type="button" onClick={() => void createRepository()}><GitBranch size={16} /> 添加仓库</button></div>
        <table><thead><tr><th>仓库</th><th>信任</th><th>状态</th><th>模板</th><th>索引</th><th>操作</th></tr></thead><tbody>{repositories.map((repository) => <tr key={repository.id}><td>{repository.name}</td><td>{repository.trustMode}</td><td>{repository.lastError ?? repository.lastStatus ?? "pending"}</td><td>{repository.templateCount}</td><td><code className="inline-code">{repository.indexSha256?.slice(0, 16) ?? "-"}</code></td><td><button className="mini-button" onClick={() => void syncRepository(repository.id)}>同步</button><button className="mini-button" onClick={() => void rollbackRepository(repository.id)}>回滚</button></td></tr>)}</tbody></table>
        <div className="inline-form wrap"><select value={licensePlan} onChange={(event) => setLicensePlan(event.target.value as "community" | "team" | "enterprise")} aria-label="许可证版本"><option value="community">community</option><option value="team">team</option><option value="enterprise">enterprise</option></select><input value={licenseTo} onChange={(event) => setLicenseTo(event.target.value)} placeholder="授权客户" /><input value={licenseToken} onChange={(event) => setLicenseToken(event.target.value)} placeholder="离线许可证 token" /><input value={licensePublicKey} onChange={(event) => setLicensePublicKey(event.target.value)} placeholder="验签公钥 PEM" /><button type="button" onClick={() => void verifyLicense()}><ShieldCheck size={16} /> 验签</button><button type="button" onClick={() => void saveLicense()}><KeyRound size={16} /> 保存授权</button></div>
        <p className="muted-text">授权：{licenseStatus?.license.plan ?? "-"} / {licenseStatus?.license.verificationStatus ?? "unverified"} / 机器码 {licenseStatus?.license.machineCode ?? "-"} / 主机 {licenseStatus?.usage.hosts ?? 0}/{licenseStatus?.license.maxHosts ?? 0} / 用户 {licenseStatus?.usage.users ?? 0}/{licenseStatus?.license.maxUsers ?? 0} / 应用 {licenseStatus?.usage.apps ?? 0}/{licenseStatus?.license.maxApps ?? 0}</p>
      </section>
      <section className="table-panel">
        <div className="panel-title">{text.workspace}</div>
        <div className="inline-form wrap"><input value={workspace} onChange={(event) => changeWorkspace(event.target.value)} placeholder="工作空间 ID" /><input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="工作空间名称" /><button type="button" onClick={() => void createWorkspace()}><Globe2 size={16} /> 创建</button></div>
        <table><thead><tr><th>工作空间</th><th>策略</th><th>审批</th><th>主机</th><th>应用</th><th>数据库</th><th>备份目标</th></tr></thead><tbody>{workspaceOverview?.counts.map((item) => <tr key={item.workspace}><td>{item.workspace}</td><td>{item.policies}</td><td>{item.approvalPolicies}</td><td>{item.hosts}</td><td>{item.apps}</td><td>{item.databases}</td><td>{item.remoteBackupTargets}</td></tr>)}</tbody></table>
        <div className="inline-form wrap"><button type="button" onClick={() => void downloadTenantReport()}><Download size={16} /> 租户报表</button>{tenantReport ? <span className="muted-text">事件 {tenantReport.counts.auditEvents} / 审批 {tenantReport.counts.approvals} / SHA {tenantReport.sha256.slice(0, 12)}</span> : null}</div>
      </section>
      <section className="table-panel">
        <div className="panel-title">连接器版本策略</div>
        <div className="inline-form wrap"><StatusPill status={(connectorPolicy?.connectors.some((item) => item.compatibility === "unsupported") ?? false) ? "warn" : "secure"} label={`${connectorPolicy?.recommendedVersion ?? "-"} 推荐`} /><button type="button" onClick={() => void scheduleConnectorUpgrade()}><Download size={16} /> 25% 灰度升级</button>{upgradePlan ? <span className="muted-text">已选择 {upgradePlan.selected.length}，跳过 {upgradePlan.skipped.length}，目标 {upgradePlan.targetVersion}</span> : null}</div>
        <table><thead><tr><th>连接器</th><th>状态</th><th>版本</th><th>兼容性</th><th>目标</th></tr></thead><tbody>{connectorPolicy?.connectors.map((connector) => <tr key={connector.connectorId}><td>{connector.name}</td><td><StatusPill status={connector.status === "online" ? "active" : connector.status === "stale" ? "warn" : "inactive"} label={connector.status} /></td><td>{connector.version ?? "unknown"}</td><td>{connector.compatibility}</td><td>{connector.upgradeTargetVersion}</td></tr>)}</tbody></table>
      </section>
      <section className="table-panel">
        <div className="panel-title">商业化治理</div>
        <div className="inline-form wrap"><StatusPill status={ssoReadiness?.enabled ? "secure" : "warn"} label={ssoReadiness?.enabled ? "SSO 已启用" : "SSO 未启用"} /><StatusPill status={backupEncryption?.enabled ? "secure" : "warn"} label={backupEncryption?.enabled ? `备份加密 v${backupEncryption.keyVersion}` : "备份未加密"} /><StatusPill status={releaseManifest?.verification.allArtifactsHaveSha256 ? "secure" : "warn"} label={`发行清单 ${releaseManifest?.manifestSha256.slice(0, 12) ?? "-"}`} /><StatusPill status={(haPlan?.checks.every((check) => check.ready) ?? false) ? "secure" : "warn"} label={haPlan?.mode ?? "single-node"} /></div>
        <table><thead><tr><th>能力</th><th>状态</th><th>关键数据</th></tr></thead><tbody><tr><td>SSO/OIDC</td><td>{ssoReadiness?.checks.filter((check) => check.ready).length ?? 0}/{ssoReadiness?.checks.length ?? 0}</td><td>{ssoReadiness?.provider?.name ?? "未配置"} / {ssoReadiness?.localBreakGlassAvailable ? "保留本地应急" : "未保留本地应急"}</td></tr><tr><td>连接器发行</td><td>{releaseManifest?.verification.allArtifactsHaveSignature ? "签名齐全" : "需补签名"}</td><td>{releaseManifest?.channels.map((channel) => `${channel.name}:${channel.version}`).join(" / ") ?? "-"}</td></tr><tr><td>备份密钥</td><td>{backupRotation ? `v${backupRotation.currentKeyVersion} -> v${backupRotation.nextKeyVersion}` : "-"}</td><td>{backupEncryption?.nextRotationAt ? formatDate(backupEncryption.nextRotationAt) : "未排期"}</td></tr><tr><td>审计保留</td><td>{retentionPolicies.length} 条</td><td>{retentionEvaluation ? `${retentionEvaluation.retainDays} 天 / ${retentionEvaluation.archiveBeforeDelete ? "先归档" : "直接清理"}` : "-"}</td></tr><tr><td>插件权限</td><td>{plugins.length} 个</td><td>{plugins[0] ? `${plugins[0].id} / ${plugins[0].permissions.join(", ")}` : "未注册插件"}</td></tr><tr><td>高可用</td><td>{haPlan?.estimatedRecoveryMinutes ?? 0} 分钟 RTO</td><td>{haPlan?.rolloutSteps.map((step) => step.title).join(" / ") ?? "-"}</td></tr></tbody></table>
      </section>
      <section className="table-panel">
        <div className="panel-title">{text.approval}</div>
        <div className="inline-form wrap"><input value={workspace} onChange={(event) => changeWorkspace(event.target.value)} placeholder="工作空间" /><select value={resourceType} onChange={(event) => setResourceType(event.target.value as AccessPolicy["resourceType"])}><option value="host">主机</option><option value="app">应用</option><option value="fileRoot">文件根</option><option value="database">数据库</option><option value="backupTarget">备份目标</option><option value="workspace">工作空间</option></select><input value={resourceId} onChange={(event) => setResourceId(event.target.value)} placeholder="资源 ID 或 *" /><select value={role} onChange={(event) => setRole(event.target.value as AccessPolicy["role"])}><option value="viewer">viewer</option><option value="operator">operator</option><option value="owner">owner</option></select><select value={permission} onChange={(event) => setPermission(event.target.value)}><option value="read">read</option><option value="write">write</option><option value="approve">approve</option><option value="admin">admin</option></select><button type="button" onClick={() => void createPolicy()}><Plus size={16} /> 访问</button></div>
        <div className="inline-form wrap"><input value={approvalAction} onChange={(event) => setApprovalAction(event.target.value)} placeholder="动作" /><button type="button" onClick={() => void checkApprovalPolicy()}><ClipboardList size={16} /> 预检</button><button type="button" onClick={() => void createApprovalPolicy()}><ShieldCheck size={16} /> 审批策略</button></div>
        <p className="muted-text">访问策略 {policies.length} 条，审批策略 {approvalPolicies.length} 条。{approvalPrecheck ? ` 预检：${approvalPrecheck.target} / ${approvalPrecheck.required ? `需要 ${approvalPrecheck.requiredApprovals} 人` : "不需要审批"}` : ""}</p>
      </section>
      <section className="table-panel"><div className="panel-title">{text.audit}</div><p className="muted-text">事件：{compliance?.totalEvents ?? 0}，拒绝：{compliance?.denied ?? 0}，错误：{compliance?.errors ?? 0}</p><div className="inline-form wrap"><StatusPill status={compliance?.integrity.ok ? "secure" : "warn"} label={compliance?.integrity.ok ? "哈希链正常" : "需要检查"} /><button type="button" onClick={() => void downloadAuditBundle()}><Download size={16} /> 下载签名包</button></div>{compliance?.integrity.latestHash ? <code className="path-code">{compliance.integrity.latestHash}</code> : null}</section>
      <section className="table-panel"><div className="panel-title">自动化安全修复</div><table><thead><tr><th>项目</th><th>风险</th><th>建议</th><th>操作</th></tr></thead><tbody>{hardening?.items.map((item) => <tr key={item.id}><td>{item.title}</td><td>{item.risk}</td><td>{item.recommendation}</td><td><button className="mini-button" onClick={() => void dryRun(item.id)}><Play size={14} /> dry-run</button></td></tr>)}</tbody></table><p className="muted-text">最近运行：{runs[0] ? `${runs[0].itemId} / ${runs[0].status} / ${formatDate(runs[0].createdAt)}` : "无"}</p></section>
      <section className="table-panel"><div className="panel-title">{text.capacity}</div><p>状态体积：{capacity?.stateBytes ?? 0} bytes；主机：{capacity?.hosts ?? 0}；样本：{capacity?.metricSamples ?? 0}</p>{capacity?.recommendations.map((item) => <p className="notice" key={item}>{item}</p>)}<div className="inline-form wrap"><button type="button" onClick={() => void archiveState(true)}><Archive size={16} /> 归档预演</button><button type="button" onClick={() => void archiveState(false)}><Archive size={16} /> 执行归档</button><button type="button" onClick={() => void cleanupDatabaseBackups()}><Database size={16} /> 清理数据库备份</button></div>{archiveResult ? <p className="muted-text">移除样本 {archiveResult.removedMetricSamples}，归档 {archiveResult.archivedRecords}，驱动 {archiveResult.archiveDriver}，状态 {archiveResult.beforeBytes} -&gt; {archiveResult.afterBytes} bytes</p> : null}{cleanupResult ? <p className="muted-text">数据库 dump 删除 {cleanupResult.removed}，保留 {cleanupResult.retained}，问题 {cleanupResult.issues.length}</p> : null}<table><tbody>{upgrade?.steps.map((step) => <tr key={step.id}><td><ClipboardList size={14} /> {step.title}</td><td><StatusPill status={step.status === "ready" ? "secure" : "warn"} /></td><td>{step.detail}</td></tr>)}</tbody></table></section>
      <section className="table-panel"><div className="panel-title">离线安装向导</div><div className="inline-form wrap"><button type="button" onClick={() => void loadArchiveRecords()}><Archive size={16} /> 查询归档</button><button type="button" onClick={() => void downloadDiagnostics()}><Download size={16} /> 诊断包</button></div><table><tbody>{installer?.steps.map((step) => <tr key={step.id}><td>{step.title}</td><td>{step.command ? <code className="inline-code">{step.command}</code> : "-"}</td><td>{step.detail}</td></tr>)}</tbody></table><p className="muted-text">交付清单：{delivery?.items.filter((item) => item.ready).length ?? 0}/{delivery?.items.length ?? 0}；归档记录：{archivePage?.records.length ?? 0}；诊断 SHA-256：{diagnostics?.sha256 ?? "-"}</p></section>
      <section className="table-panel"><div className="panel-title">{text.openApi}</div><p className="muted-text">OpenAPI paths：{openApiPaths}；Webhook 事件：{openApi?.webhookEvents.join(", ")}</p><table><thead><tr><th>语言</th><th>示例</th><th>Scope</th><th>代码</th></tr></thead><tbody>{sdkExamples.map((example) => <tr key={example.id}><td>{example.language}</td><td>{example.title}</td><td>{example.requiredScopes.join(", ")}</td><td><pre className="inline-log"><Code2 size={14} /> {example.snippet}</pre></td></tr>)}</tbody></table></section>
      <section className="table-panel"><div className="panel-title">{text.quality}</div><p className="muted-text"><Accessibility size={14} /> 当前语言：{locale} / 报告：{quality?.locale ?? "zh-CN"}</p><table><tbody>{quality?.checks.map((check) => <tr key={check.id}><td>{check.title}</td><td><StatusPill status={check.ready ? "secure" : "warn"} /></td><td>{check.detail}</td></tr>)}</tbody></table></section>
    </main>
  );
}

function downloadJson(fileName: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}