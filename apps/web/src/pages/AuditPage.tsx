import { useEffect, useState } from "react";
import { Download, RotateCw, Trash2 } from "lucide-react";
import type { AuditEvent } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { StatusPill } from "../components/StatusPill.js";
import { formatDate } from "../utils/format.js";

export function AuditPage(): JSX.Element {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [status, setStatus] = useState("");
  const [limit, setLimit] = useState("200");
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [total, setTotal] = useState(0);
  const [retainDays, setRetainDays] = useState("180");
  const [approvalId, setApprovalId] = useState("");
  const [packageHash, setPackageHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(cursor?: string): Promise<void> {
    try {
      const response = await api.auditPage({ actor: actor || undefined, action: action || undefined, status: toAuditStatus(status), limit: Number.parseInt(limit, 10), cursor });
      setEvents(response.page.events);
      setNextCursor(response.page.nextCursor);
      setTotal(response.page.total);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败。");
    }
  }

  async function exportAudit(format: "jsonl" | "csv"): Promise<void> {
    try {
      const blob = await api.exportAudit(format, { actor: actor || undefined, action: action || undefined, status: toAuditStatus(status), limit: Number.parseInt(limit, 10) });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `lxpanel-audit.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "导出失败。");
    }
  }

  async function exportPackage(format: "jsonl" | "csv"): Promise<void> {
    try {
      const response = await api.exportAuditPackage(format, { actor: actor || undefined, action: action || undefined, status: toAuditStatus(status), limit: Number.parseInt(limit, 10) });
      setPackageHash(response.package.manifestSha256);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成签名包失败。");
    }
  }

  async function pruneAudit(): Promise<void> {
    if (!approvalId) {
      setError("清理审计需要审批单 ID。");
      return;
    }
    if (!window.confirm(`仅保留最近 ${retainDays} 天审计日志，继续吗？`)) {
      return;
    }
    try {
      await api.pruneAudit(Number.parseInt(retainDays, 10), approvalId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "清理失败。");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading"><div><h1>审计</h1><p>安全事件、导出与保留</p></div><button className="icon-button" onClick={() => void load()} title="刷新"><RotateCw size={18} /></button></div>
      {error ? <div className="form-error">{error}</div> : null}
      <section className="table-panel">
        <div className="panel-title">筛选</div>
        <div className="inline-form wrap"><input value={actor} onChange={(event) => setActor(event.target.value)} placeholder="操作者" /><input value={action} onChange={(event) => setAction(event.target.value)} placeholder="动作" /><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">全部状态</option><option value="success">success</option><option value="denied">denied</option><option value="error">error</option></select><input value={limit} onChange={(event) => setLimit(event.target.value)} inputMode="numeric" placeholder="每页条数" /><button type="button" onClick={() => void load()}><RotateCw size={16} /> 查询</button>{nextCursor ? <button type="button" onClick={() => void load(nextCursor)}>下一页</button> : null}</div>
        <div className="inline-form wrap"><button type="button" onClick={() => void exportAudit("csv")}><Download size={16} /> CSV</button><button type="button" onClick={() => void exportAudit("jsonl")}><Download size={16} /> JSONL</button><button type="button" onClick={() => void exportPackage("jsonl")}><Download size={16} /> 签名包</button><input value={retainDays} onChange={(event) => setRetainDays(event.target.value)} inputMode="numeric" placeholder="保留天数" /><input value={approvalId} onChange={(event) => setApprovalId(event.target.value)} placeholder="审批单 ID" /><button type="button" onClick={() => void pruneAudit()}><Trash2 size={16} /> 清理</button></div>
        <p className="muted-text">匹配事件 {total} 条{packageHash ? `，签名包 manifest: ${packageHash}` : ""}</p>
      </section>
      <section className="table-panel">
        <table>
          <thead><tr><th>时间</th><th>操作者</th><th>动作</th><th>对象</th><th>状态</th></tr></thead>
          <tbody>{events.map((item) => <tr key={item.id}><td>{formatDate(item.time)}</td><td>{item.actor}</td><td>{item.action}</td><td>{item.target}</td><td><StatusPill status={item.status} /></td></tr>)}</tbody>
        </table>
      </section>
    </main>
  );
}

function toAuditStatus(value: string): "success" | "denied" | "error" | undefined {
  return value === "success" || value === "denied" || value === "error" ? value : undefined;
}
