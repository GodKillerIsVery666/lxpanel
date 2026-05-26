import { useEffect, useState } from "react";
import { Check, Plus, RotateCw, X } from "lucide-react";
import type { Approval, ApprovalAction, ApprovalStatus } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { StatusPill } from "../components/StatusPill.js";
import { formatDate } from "../utils/format.js";

export function ApprovalsPage(): JSX.Element {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [action, setAction] = useState<ApprovalAction>("backup.restore");
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [expiresInMinutes, setExpiresInMinutes] = useState("120");
  const [status, setStatus] = useState<"" | ApprovalStatus>("");
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    try {
      const response = await api.approvals({ status: status || undefined });
      setApprovals(response.approvals);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败。");
    }
  }

  async function create(): Promise<void> {
    try {
      await api.createApproval({ action, target, reason, expiresInMinutes: Number.parseInt(expiresInMinutes, 10) });
      setTarget("");
      setReason("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建失败。");
    }
  }

  async function decide(approvalId: string, approved: boolean): Promise<void> {
    const comment = window.prompt(approved ? "批准备注" : "驳回备注") ?? undefined;
    try {
      if (approved) {
        await api.approveApproval(approvalId, comment);
      } else {
        await api.rejectApproval(approvalId, comment);
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "处理失败。");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading"><div><h1>审批</h1><p>高风险操作准入</p></div><button className="icon-button" onClick={() => void load()} title="刷新"><RotateCw size={18} /></button></div>
      {error ? <div className="form-error">{error}</div> : null}
      <section className="table-panel">
        <div className="panel-title">新建审批</div>
        <div className="inline-form wrap"><select value={action} onChange={(event) => setAction(event.target.value as ApprovalAction)}><option value="backup.restore">backup.restore</option><option value="audit.prune">audit.prune</option></select><input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="目标" /><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="原因" /><input value={expiresInMinutes} onChange={(event) => setExpiresInMinutes(event.target.value)} inputMode="numeric" placeholder="有效分钟" /><button type="button" onClick={() => void create()}><Plus size={16} /> 创建</button></div>
      </section>
      <section className="table-panel">
        <div className="panel-title">列表</div>
        <div className="inline-form wrap"><select value={status} onChange={(event) => setStatus(event.target.value as "" | ApprovalStatus)}><option value="">全部状态</option><option value="pending">pending</option><option value="approved">approved</option><option value="used">used</option><option value="rejected">rejected</option><option value="expired">expired</option></select><button type="button" onClick={() => void load()}><RotateCw size={16} /> 查询</button></div>
        <table><thead><tr><th>ID</th><th>动作</th><th>目标</th><th>状态</th><th>申请人</th><th>到期</th><th>处理</th><th>操作</th></tr></thead><tbody>{approvals.map((approval) => <tr key={approval.id}><td><code>{approval.id}</code></td><td>{approval.action}</td><td>{approval.target}<div className="muted-text">{approval.reason}</div></td><td><StatusPill status={approval.status} /></td><td>{approval.requestedBy}<div className="muted-text">{formatDate(approval.requestedAt)}</div></td><td>{formatDate(approval.expiresAt)}</td><td>{approval.reviewedBy ?? "-"}{approval.consumedBy ? <div className="muted-text">used by {approval.consumedBy}</div> : null}</td><td className="row-actions">{approval.status === "pending" ? <><button title="批准" onClick={() => void decide(approval.id, true)}><Check size={15} /></button><button title="驳回" onClick={() => void decide(approval.id, false)}><X size={15} /></button></> : null}</td></tr>)}</tbody></table>
      </section>
    </main>
  );
}
