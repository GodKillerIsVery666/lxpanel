import { useEffect, useState } from "react";
import { ClipboardList, Play, Plus, ShieldCheck } from "lucide-react";
import type { AccessPolicy, CapacityPlan, ComplianceReport, DeliveryChecklist, OpenApiSummary, SecurityHardeningPlan, SecurityRemediationRun, UpgradePlan } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { StatusPill } from "../components/StatusPill.js";
import { formatDate } from "../utils/format.js";

export function PlatformPage(): JSX.Element {
  const [policies, setPolicies] = useState<AccessPolicy[]>([]);
  const [runs, setRuns] = useState<SecurityRemediationRun[]>([]);
  const [hardening, setHardening] = useState<SecurityHardeningPlan | null>(null);
  const [capacity, setCapacity] = useState<CapacityPlan | null>(null);
  const [upgrade, setUpgrade] = useState<UpgradePlan | null>(null);
  const [delivery, setDelivery] = useState<DeliveryChecklist | null>(null);
  const [openApi, setOpenApi] = useState<OpenApiSummary | null>(null);
  const [compliance, setCompliance] = useState<ComplianceReport | null>(null);
  const [workspace, setWorkspace] = useState("default");
  const [resourceType, setResourceType] = useState<AccessPolicy["resourceType"]>("host");
  const [resourceId, setResourceId] = useState("*");
  const [role, setRole] = useState<AccessPolicy["role"]>("operator");
  const [permission, setPermission] = useState("read");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    try {
      const [policyResponse, remediationResponse, hardeningResponse, capacityResponse, upgradeResponse, deliveryResponse, openApiResponse, complianceResponse] = await Promise.all([api.accessPolicies(), api.remediationRuns(), api.securityHardeningPlan(), api.capacityPlan(), api.upgradePlan(), api.deliveryChecklist(), api.openApiSummary(), api.complianceReport()]);
      setPolicies(policyResponse.policies);
      setRuns(remediationResponse.runs);
      setHardening(hardeningResponse.plan);
      setCapacity(capacityResponse.plan);
      setUpgrade(upgradeResponse.plan);
      setDelivery(deliveryResponse.checklist);
      setOpenApi(openApiResponse.summary);
      setCompliance(complianceResponse.report);
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

  async function dryRun(itemId: string): Promise<void> {
    try {
      const response = await api.createRemediationRun({ itemId, dryRun: true });
      setNotice(`${response.run.itemId}: ${response.run.outputTail ?? response.run.status}`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成修复计划失败。");
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
        <div className="panel-title">资源访问策略</div>
        <div className="inline-form wrap"><input value={workspace} onChange={(event) => setWorkspace(event.target.value)} placeholder="工作空间" /><select value={resourceType} onChange={(event) => setResourceType(event.target.value as AccessPolicy["resourceType"])}><option value="host">主机</option><option value="app">应用</option><option value="fileRoot">文件根</option><option value="database">数据库</option><option value="backupTarget">备份目标</option><option value="workspace">工作空间</option></select><input value={resourceId} onChange={(event) => setResourceId(event.target.value)} placeholder="资源 ID 或 *" /><select value={role} onChange={(event) => setRole(event.target.value as AccessPolicy["role"])}><option value="viewer">viewer</option><option value="operator">operator</option><option value="owner">owner</option></select><select value={permission} onChange={(event) => setPermission(event.target.value)}><option value="read">read</option><option value="write">write</option><option value="approve">approve</option><option value="admin">admin</option></select><button type="button" onClick={() => void createPolicy()}><Plus size={16} /> 添加</button></div>
        <table><thead><tr><th>工作空间</th><th>资源</th><th>角色</th><th>权限</th><th>更新人</th></tr></thead><tbody>{policies.map((policy) => <tr key={policy.id}><td>{policy.workspace}</td><td>{policy.resourceType}:{policy.resourceId}</td><td>{policy.role}</td><td>{policy.permissions.join(", ")}</td><td>{policy.updatedBy}</td></tr>)}</tbody></table>
      </section>
      <section className="table-panel"><div className="panel-title">审计完整性和合规报表</div><p className="muted-text">事件：{compliance?.totalEvents ?? 0}，拒绝：{compliance?.denied ?? 0}，错误：{compliance?.errors ?? 0}</p><StatusPill status={compliance?.integrity.ok ? "secure" : "warn"} label={compliance?.integrity.ok ? "哈希链正常" : "需要检查"} />{compliance?.integrity.latestHash ? <code className="path-code">{compliance.integrity.latestHash}</code> : null}</section>
      <section className="table-panel"><div className="panel-title">自动化安全修复</div><table><thead><tr><th>项目</th><th>风险</th><th>建议</th><th>操作</th></tr></thead><tbody>{hardening?.items.map((item) => <tr key={item.id}><td>{item.title}</td><td>{item.risk}</td><td>{item.recommendation}</td><td><button className="mini-button" onClick={() => void dryRun(item.id)}><Play size={14} /> dry-run</button></td></tr>)}</tbody></table><p className="muted-text">最近运行：{runs[0] ? `${runs[0].itemId} / ${runs[0].status} / ${formatDate(runs[0].createdAt)}` : "无"}</p></section>
      <section className="table-panel"><div className="panel-title">容量和性能建议</div><p>状态体积：{capacity?.stateBytes ?? 0} bytes；主机：{capacity?.hosts ?? 0}；样本：{capacity?.metricSamples ?? 0}</p>{capacity?.recommendations.map((item) => <p className="notice" key={item}>{item}</p>)}</section>
      <section className="table-panel"><div className="panel-title">升级向导</div><table><tbody>{upgrade?.steps.map((step) => <tr key={step.id}><td><ClipboardList size={14} /> {step.title}</td><td><StatusPill status={step.status === "ready" ? "secure" : "warn"} /></td><td>{step.detail}</td></tr>)}</tbody></table></section>
      <section className="table-panel"><div className="panel-title">离线交付清单</div><table><tbody>{delivery?.items.map((item) => <tr key={item.id}><td>{item.title}</td><td><StatusPill status={item.ready ? "secure" : "warn"} /></td><td>{item.detail}</td></tr>)}</tbody></table></section>
      <section className="table-panel"><div className="panel-title">开放 API 和 Webhook</div><p className="muted-text">Webhook 事件：{openApi?.webhookEvents.join(", ")}</p><table><thead><tr><th>方法</th><th>路径</th><th>Scope</th></tr></thead><tbody>{openApi?.paths.map((path) => <tr key={`${path.method}-${path.path}`}><td>{path.method}</td><td><code className="inline-code">{path.path}</code></td><td>{path.scope ?? "cookie"}</td></tr>)}</tbody></table><p className="muted-text"><ShieldCheck size={14} /> API Token 调用会进入审计链路。</p></section>
    </main>
  );
}
