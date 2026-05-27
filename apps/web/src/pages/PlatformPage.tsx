import { useEffect, useState } from "react";
import { Accessibility, Archive, ClipboardList, Code2, GitBranch, KeyRound, Play, Plus, Send, ShieldCheck, Terminal } from "lucide-react";
import type { AccessPolicy, CapacityPlan, ComplianceReport, DeliveryChecklist, FrontendQualityReport, InstallerGuide, LicenseStatus, OpenApiSummary, ResourceApprovalPolicy, SdkExample, SecurityHardeningPlan, SecurityRemediationRun, StateArchiveResult, TemplateRepository, TerminalSession, UpgradePlan } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { StatusPill } from "../components/StatusPill.js";
import { formatDate } from "../utils/format.js";

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
  const [compliance, setCompliance] = useState<ComplianceReport | null>(null);
  const [archiveResult, setArchiveResult] = useState<StateArchiveResult | null>(null);
  const [installer, setInstaller] = useState<InstallerGuide | null>(null);
  const [sdkExamples, setSdkExamples] = useState<SdkExample[]>([]);
  const [quality, setQuality] = useState<FrontendQualityReport | null>(null);
  const [workspace, setWorkspace] = useState("default");
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
  const [approvalAction, setApprovalAction] = useState("backup.restore");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    try {
      const [policyResponse, approvalPolicyResponse, terminalResponse, repositoryResponse, licenseResponse, remediationResponse, hardeningResponse, capacityResponse, upgradeResponse, deliveryResponse, openApiResponse, complianceResponse, installerResponse, sdkResponse, qualityResponse] = await Promise.all([
        api.accessPolicies(), api.approvalPolicies(), api.terminalSessions(), api.templateRepositories(), api.licenseStatus(), api.remediationRuns(), api.securityHardeningPlan(), api.capacityPlan(), api.upgradePlan(), api.deliveryChecklist(), api.openApiSummary(), api.complianceReport(), api.installerGuide(), api.sdkExamples(), api.frontendQuality()
      ]);
      setPolicies(policyResponse.policies);
      setApprovalPolicies(approvalPolicyResponse.policies);
      setTerminalSessions(terminalResponse.sessions);
      setRepositories(repositoryResponse.repositories);
      setLicenseStatus(licenseResponse.status);
      setRuns(remediationResponse.runs);
      setHardening(hardeningResponse.plan);
      setCapacity(capacityResponse.plan);
      setUpgrade(upgradeResponse.plan);
      setDelivery(deliveryResponse.checklist);
      setOpenApi(openApiResponse.summary);
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
      await api.createApprovalPolicy({ resourceType, resourceId, action: approvalAction, requiredApprovals: 2, enabled: true });
      setNotice("资源级审批策略已保存。");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存审批策略失败。");
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

  async function saveLicense(): Promise<void> {
    try {
      await api.updateLicense({ plan: licensePlan, licensedTo: licenseTo, maxHosts: licensePlan === "enterprise" ? 500 : 50, maxUsers: licensePlan === "enterprise" ? 200 : 20, maxApps: licensePlan === "enterprise" ? 500 : 50, features: ["terminal", "templates", "audit-package", "offline-delivery"] });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存许可证失败。");
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

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading"><div><h1>平台治理</h1><p>商业交付、安全治理和开放集成</p></div></div>
      {error ? <div className="form-error">{error}</div> : null}
      {notice ? <p className="notice">{notice}</p> : null}
      <section className="table-panel">
        <div className="panel-title">Web 终端代理</div>
        <div className="inline-form wrap"><input value={terminalHostId} onChange={(event) => setTerminalHostId(event.target.value)} placeholder="主机 ID" aria-label="主机 ID" /><input value={terminalUser} onChange={(event) => setTerminalUser(event.target.value)} placeholder="SSH 用户" aria-label="SSH 用户" /><button type="button" onClick={() => void openTerminal()}><Terminal size={16} /> 打开</button></div>
        <table><thead><tr><th>主机</th><th>状态</th><th>命令</th><th>输入</th></tr></thead><tbody>{terminalSessions.map((session) => <tr key={session.id}><td>{session.hostName}</td><td><StatusPill status={session.status === "failed" ? "failed" : session.status === "closed" ? "inactive" : "active"} label={session.status} /></td><td><code className="inline-code">{session.commandId}</code></td><td className="row-actions"><input value={terminalInput} onChange={(event) => setTerminalInput(event.target.value)} placeholder="输入内容" aria-label="终端输入" /><button title="发送终端输入" onClick={() => void sendTerminalInput(session.id)}><Send size={14} /></button></td></tr>)}</tbody></table>
      </section>
      <section className="table-panel">
        <div className="panel-title">模板仓库和许可证</div>
        <div className="inline-form wrap"><input value={repositoryName} onChange={(event) => setRepositoryName(event.target.value)} placeholder="仓库名称" /><input value={repositoryUrl} onChange={(event) => setRepositoryUrl(event.target.value)} placeholder="https://templates.example.com/index.json" /><button type="button" onClick={() => void createRepository()}><GitBranch size={16} /> 添加仓库</button></div>
        <table><thead><tr><th>仓库</th><th>信任</th><th>状态</th><th>模板</th><th>操作</th></tr></thead><tbody>{repositories.map((repository) => <tr key={repository.id}><td>{repository.name}</td><td>{repository.trustMode}</td><td>{repository.lastStatus ?? "pending"}</td><td>{repository.templateCount}</td><td><button className="mini-button" onClick={() => void syncRepository(repository.id)}>同步</button></td></tr>)}</tbody></table>
        <div className="inline-form wrap"><select value={licensePlan} onChange={(event) => setLicensePlan(event.target.value as "community" | "team" | "enterprise")} aria-label="许可证版本"><option value="community">community</option><option value="team">team</option><option value="enterprise">enterprise</option></select><input value={licenseTo} onChange={(event) => setLicenseTo(event.target.value)} placeholder="授权客户" /><button type="button" onClick={() => void saveLicense()}><KeyRound size={16} /> 保存授权</button></div>
        <p className="muted-text">授权：{licenseStatus?.license.plan ?? "-"} / 主机 {licenseStatus?.usage.hosts ?? 0}/{licenseStatus?.license.maxHosts ?? 0} / 用户 {licenseStatus?.usage.users ?? 0}/{licenseStatus?.license.maxUsers ?? 0} / 应用 {licenseStatus?.usage.apps ?? 0}/{licenseStatus?.license.maxApps ?? 0}</p>
      </section>
      <section className="table-panel">
        <div className="panel-title">资源访问和审批策略</div>
        <div className="inline-form wrap"><input value={workspace} onChange={(event) => setWorkspace(event.target.value)} placeholder="工作空间" /><select value={resourceType} onChange={(event) => setResourceType(event.target.value as AccessPolicy["resourceType"])}><option value="host">主机</option><option value="app">应用</option><option value="fileRoot">文件根</option><option value="database">数据库</option><option value="backupTarget">备份目标</option><option value="workspace">工作空间</option></select><input value={resourceId} onChange={(event) => setResourceId(event.target.value)} placeholder="资源 ID 或 *" /><select value={role} onChange={(event) => setRole(event.target.value as AccessPolicy["role"])}><option value="viewer">viewer</option><option value="operator">operator</option><option value="owner">owner</option></select><select value={permission} onChange={(event) => setPermission(event.target.value)}><option value="read">read</option><option value="write">write</option><option value="approve">approve</option><option value="admin">admin</option></select><button type="button" onClick={() => void createPolicy()}><Plus size={16} /> 访问</button></div>
        <div className="inline-form wrap"><input value={approvalAction} onChange={(event) => setApprovalAction(event.target.value)} placeholder="动作" /><button type="button" onClick={() => void createApprovalPolicy()}><ShieldCheck size={16} /> 审批策略</button></div>
        <p className="muted-text">访问策略 {policies.length} 条，审批策略 {approvalPolicies.length} 条。</p>
      </section>
      <section className="table-panel"><div className="panel-title">审计完整性和合规报表</div><p className="muted-text">事件：{compliance?.totalEvents ?? 0}，拒绝：{compliance?.denied ?? 0}，错误：{compliance?.errors ?? 0}</p><StatusPill status={compliance?.integrity.ok ? "secure" : "warn"} label={compliance?.integrity.ok ? "哈希链正常" : "需要检查"} />{compliance?.integrity.latestHash ? <code className="path-code">{compliance.integrity.latestHash}</code> : null}</section>
      <section className="table-panel"><div className="panel-title">自动化安全修复</div><table><thead><tr><th>项目</th><th>风险</th><th>建议</th><th>操作</th></tr></thead><tbody>{hardening?.items.map((item) => <tr key={item.id}><td>{item.title}</td><td>{item.risk}</td><td>{item.recommendation}</td><td><button className="mini-button" onClick={() => void dryRun(item.id)}><Play size={14} /> dry-run</button></td></tr>)}</tbody></table><p className="muted-text">最近运行：{runs[0] ? `${runs[0].itemId} / ${runs[0].status} / ${formatDate(runs[0].createdAt)}` : "无"}</p></section>
      <section className="table-panel"><div className="panel-title">容量、归档和升级</div><p>状态体积：{capacity?.stateBytes ?? 0} bytes；主机：{capacity?.hosts ?? 0}；样本：{capacity?.metricSamples ?? 0}</p>{capacity?.recommendations.map((item) => <p className="notice" key={item}>{item}</p>)}<div className="inline-form wrap"><button type="button" onClick={() => void archiveState(true)}><Archive size={16} /> 归档预演</button><button type="button" onClick={() => void archiveState(false)}><Archive size={16} /> 执行归档</button></div>{archiveResult ? <p className="muted-text">移除样本 {archiveResult.removedMetricSamples}，状态 {archiveResult.beforeBytes} -&gt; {archiveResult.afterBytes} bytes</p> : null}<table><tbody>{upgrade?.steps.map((step) => <tr key={step.id}><td><ClipboardList size={14} /> {step.title}</td><td><StatusPill status={step.status === "ready" ? "secure" : "warn"} /></td><td>{step.detail}</td></tr>)}</tbody></table></section>
      <section className="table-panel"><div className="panel-title">离线安装向导</div><table><tbody>{installer?.steps.map((step) => <tr key={step.id}><td>{step.title}</td><td>{step.command ? <code className="inline-code">{step.command}</code> : "-"}</td><td>{step.detail}</td></tr>)}</tbody></table><p className="muted-text">交付清单：{delivery?.items.filter((item) => item.ready).length ?? 0}/{delivery?.items.length ?? 0}</p></section>
      <section className="table-panel"><div className="panel-title">开放 API 和 SDK 示例</div><p className="muted-text">Webhook 事件：{openApi?.webhookEvents.join(", ")}</p><table><thead><tr><th>语言</th><th>示例</th><th>Scope</th><th>代码</th></tr></thead><tbody>{sdkExamples.map((example) => <tr key={example.id}><td>{example.language}</td><td>{example.title}</td><td>{example.requiredScopes.join(", ")}</td><td><pre className="inline-log"><Code2 size={14} /> {example.snippet}</pre></td></tr>)}</tbody></table></section>
      <section className="table-panel"><div className="panel-title">可访问性与国际化</div><p className="muted-text"><Accessibility size={14} /> 当前语言：{quality?.locale ?? "zh-CN"}</p><table><tbody>{quality?.checks.map((check) => <tr key={check.id}><td>{check.title}</td><td><StatusPill status={check.ready ? "secure" : "warn"} /></td><td>{check.detail}</td></tr>)}</tbody></table></section>
    </main>
  );
}