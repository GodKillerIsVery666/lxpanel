import { useEffect, useState } from "react";
import { Download, RotateCw, Trash2 } from "lucide-react";
import type { AuditEvent } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { EmptyState } from "../components/EmptyState.js";
import { StatusPill } from "../components/StatusPill.js";
import { VirtualTable, type VirtualColumn } from "../components/VirtualTable.js";
import { pageText } from "../i18n/resources.js";
import { formatDate } from "../utils/format.js";
import { readLocalePreference } from "../utils/preferences.js";

export function AuditPage(): JSX.Element {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [locale] = useState(() => readLocalePreference());
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [status, setStatus] = useState("");
  const [limit, setLimit] = useState("200");
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [total, setTotal] = useState(0);
  const [retainDays, setRetainDays] = useState("180");
  const [approvalId, setApprovalId] = useState("");
  const [packageHash, setPackageHash] = useState<string | null>(null);
  const [pruneConfirmOpen, setPruneConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = pageText[locale].audit;
  const columns: Array<VirtualColumn<AuditEvent>> = [
    { id: "time", header: text.columns.time, cell: (item) => formatDate(item.time), sortValue: (item) => item.time },
    { id: "actor", header: text.columns.actor, cell: (item) => item.actor, sortValue: (item) => item.actor },
    { id: "action", header: text.columns.action, cell: (item) => item.action, sortValue: (item) => item.action },
    { id: "target", header: text.columns.target, cell: (item) => item.target, sortValue: (item) => item.target },
    { id: "status", header: text.columns.status, cell: (item) => <StatusPill status={item.status} />, sortValue: (item) => item.status }
  ];

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

  function pruneAudit(): void {
    if (!approvalId) {
      setError("清理审计需要审批单 ID。");
      return;
    }
    setPruneConfirmOpen(true);
  }

  async function confirmPruneAudit(): Promise<void> {
    try {
      await api.pruneAudit(Number.parseInt(retainDays, 10), approvalId);
      setPruneConfirmOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "清理失败。");
      setPruneConfirmOpen(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page-stack">
      <ConfirmDialog open={pruneConfirmOpen} title={text.confirmTitle} description={locale === "en-US" ? `Only retain audit logs from the last ${retainDays} days. Confirm exported evidence first.` : `仅保留最近 ${retainDays} 天审计日志，已归档或导出的证据请先确认。`} confirmText={text.confirmText} onConfirm={() => void confirmPruneAudit()} onCancel={() => setPruneConfirmOpen(false)} />
      <div className="page-heading"><div><h1>{text.title}</h1><p>{text.subtitle}</p></div><button className="icon-button" onClick={() => void load()} title="refresh"><RotateCw size={18} /></button></div>
      {error ? <div className="form-error">{error}</div> : null}
      <section className="table-panel">
        <div className="panel-title">{text.filter}</div>
        <div className="inline-form wrap"><input value={actor} onChange={(event) => setActor(event.target.value)} placeholder={text.actor} /><input value={action} onChange={(event) => setAction(event.target.value)} placeholder={text.action} /><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{text.allStatus}</option><option value="success">success</option><option value="denied">denied</option><option value="error">error</option></select><input value={limit} onChange={(event) => setLimit(event.target.value)} inputMode="numeric" placeholder={text.limit} /><button type="button" onClick={() => void load()}><RotateCw size={16} /> {text.query}</button>{nextCursor ? <button type="button" onClick={() => void load(nextCursor)}>{text.next}</button> : null}</div>
        <div className="inline-form wrap"><button type="button" onClick={() => void exportAudit("csv")}><Download size={16} /> CSV</button><button type="button" onClick={() => void exportAudit("jsonl")}><Download size={16} /> JSONL</button><button type="button" onClick={() => void exportPackage("jsonl")}><Download size={16} /> {locale === "en-US" ? "Signed package" : "签名包"}</button><input value={retainDays} onChange={(event) => setRetainDays(event.target.value)} inputMode="numeric" placeholder={text.retainDays} /><input value={approvalId} onChange={(event) => setApprovalId(event.target.value)} placeholder={text.approvalId} /><button type="button" onClick={() => void pruneAudit()}><Trash2 size={16} /> {text.prune}</button></div>
        <p className="muted-text">{text.matched} {total}{packageHash ? `, manifest: ${packageHash}` : ""}</p>
      </section>
      <section className="table-panel">
        <VirtualTable tableId="audit-events" rows={events} columns={columns} getRowKey={(item) => item.id} empty={<EmptyState title={text.emptyTitle} description={text.emptyDescription} />} />
      </section>
    </main>
  );
}

function toAuditStatus(value: string): "success" | "denied" | "error" | undefined {
  return value === "success" || value === "denied" || value === "error" ? value : undefined;
}
