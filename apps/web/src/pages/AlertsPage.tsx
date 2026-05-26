import { useEffect, useState } from "react";
import { CheckCircle2, RotateCw, Save } from "lucide-react";
import type { AlertEvent, AlertSilence, AlertThreshold, AlertType } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { StatusPill } from "../components/StatusPill.js";
import { formatDate } from "../utils/format.js";

type ThresholdDrafts = Record<AlertType, { warningPercent: string; criticalPercent: string; enabled: boolean }>;

const alertLabels: Record<AlertType, string> = {
  cpu: "CPU",
  memory: "内存",
  disk: "磁盘"
};

const initialDrafts: ThresholdDrafts = {
  cpu: { warningPercent: "80", criticalPercent: "95", enabled: true },
  memory: { warningPercent: "80", criticalPercent: "95", enabled: true },
  disk: { warningPercent: "85", criticalPercent: "95", enabled: true }
};

export function AlertsPage(): JSX.Element {
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [silences, setSilences] = useState<AlertSilence[]>([]);
  const [thresholds, setThresholds] = useState<AlertThreshold[]>([]);
  const [drafts, setDrafts] = useState<ThresholdDrafts>(initialDrafts);
  const [silenceType, setSilenceType] = useState<AlertType | "">("");
  const [silenceTarget, setSilenceTarget] = useState("");
  const [silenceReason, setSilenceReason] = useState("");
  const [silenceMinutes, setSilenceMinutes] = useState("60");
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    try {
      const [alertsResponse, thresholdsResponse, silencesResponse] = await Promise.all([api.alerts(), api.alertThresholds(), api.alertSilences()]);
      setEvents(alertsResponse.events);
      setThresholds(thresholdsResponse.thresholds);
      setSilences(silencesResponse.silences);
      setDrafts(toDrafts(thresholdsResponse.thresholds));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败。");
    }
  }

  async function save(type: AlertType): Promise<void> {
    const draft = drafts[type];
    try {
      const response = await api.updateAlertThreshold({
        type,
        warningPercent: Number.parseInt(draft.warningPercent, 10),
        criticalPercent: Number.parseInt(draft.criticalPercent, 10),
        enabled: draft.enabled
      });
      setThresholds(response.thresholds);
      setDrafts(toDrafts(response.thresholds));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存失败。");
    }
  }

  async function checkNow(): Promise<void> {
    try {
      const response = await api.checkAlerts();
      setEvents(response.events);
      setError(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "检查失败。");
    }
  }

  async function dismiss(alertId: string): Promise<void> {
    try {
      await api.dismissAlert(alertId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "确认失败。");
    }
  }

  async function createSilence(): Promise<void> {
    try {
      await api.createAlertSilence({ ...(silenceType ? { type: silenceType } : {}), ...(silenceTarget ? { target: silenceTarget } : {}), reason: silenceReason, minutes: Number.parseInt(silenceMinutes, 10) || 60 });
      setSilenceType("");
      setSilenceTarget("");
      setSilenceReason("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建静默失败。");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading">
        <div><h1>资源告警</h1><p>CPU、内存和磁盘阈值</p></div>
        <button className="icon-button" onClick={() => void checkNow()} title="立即检查"><RotateCw size={18} /></button>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <section className="table-panel">
        <div className="panel-title">阈值</div>
        <table>
          <thead><tr><th>指标</th><th>警告</th><th>严重</th><th>启用</th><th>更新人</th><th>操作</th></tr></thead>
          <tbody>{thresholds.map((threshold) => {
            const draft = drafts[threshold.type];
            return (
              <tr key={threshold.type}>
                <td>{alertLabels[threshold.type]}</td>
                <td><input value={draft.warningPercent} onChange={(event) => updateDraft(threshold.type, { warningPercent: event.target.value }, setDrafts)} inputMode="numeric" /></td>
                <td><input value={draft.criticalPercent} onChange={(event) => updateDraft(threshold.type, { criticalPercent: event.target.value }, setDrafts)} inputMode="numeric" /></td>
                <td><input type="checkbox" checked={draft.enabled} onChange={(event) => updateDraft(threshold.type, { enabled: event.target.checked }, setDrafts)} /></td>
                <td>{threshold.updatedBy}</td>
                <td><button className="mini-button" onClick={() => void save(threshold.type)}><Save size={14} /> 保存</button></td>
              </tr>
            );
          })}</tbody>
        </table>
      </section>
      <section className="table-panel">
        <div className="panel-title">告警静默</div>
        <div className="inline-form wrap"><select value={silenceType} onChange={(event) => setSilenceType(event.target.value as AlertType | "")}><option value="">全部指标</option><option value="cpu">CPU</option><option value="memory">内存</option><option value="disk">磁盘</option></select><input value={silenceTarget} onChange={(event) => setSilenceTarget(event.target.value)} placeholder="目标，可选" /><input value={silenceReason} onChange={(event) => setSilenceReason(event.target.value)} placeholder="原因" /><input value={silenceMinutes} onChange={(event) => setSilenceMinutes(event.target.value)} inputMode="numeric" placeholder="分钟" /><button type="button" onClick={() => void createSilence()}>静默</button></div>
        <table><thead><tr><th>范围</th><th>原因</th><th>结束时间</th><th>创建人</th></tr></thead><tbody>{silences.map((silence) => <tr key={silence.id}><td>{silence.type ?? "全部"} {silence.target ?? ""}</td><td>{silence.reason}</td><td>{formatDate(silence.endsAt)}</td><td>{silence.createdBy}</td></tr>)}</tbody></table>
      </section>
      <section className="table-panel">
        <div className="panel-title">告警历史</div>
        {events.length ? (
          <table>
            <thead><tr><th>时间</th><th>指标</th><th>目标</th><th>级别</th><th>当前值</th><th>阈值</th><th>描述</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>{events.map((event) => <AlertRow key={event.id} event={event} onDismiss={dismiss} />)}</tbody>
          </table>
        ) : <p className="muted-text">暂无资源告警。</p>}
      </section>
    </main>
  );
}

function AlertRow({ event, onDismiss }: { event: AlertEvent; onDismiss: (alertId: string) => Promise<void> }): JSX.Element {
  return (
    <tr>
      <td>{formatDate(event.time)}</td>
      <td>{alertLabels[event.type]}</td>
      <td>{event.target}</td>
      <td><StatusPill status={event.level === "critical" ? "bad" : "warn"} /></td>
      <td>{event.currentValue}%</td>
      <td>{event.threshold}%</td>
      <td>{event.message}</td>
      <td>{event.dismissedAt ? `已确认 ${event.dismissedBy ?? ""}` : "未确认"}</td>
      <td>{event.dismissedAt ? null : <button className="mini-button" onClick={() => void onDismiss(event.id)}><CheckCircle2 size={14} /> 确认</button>}</td>
    </tr>
  );
}

function toDrafts(thresholds: AlertThreshold[]): ThresholdDrafts {
  const drafts = { ...initialDrafts };
  for (const threshold of thresholds) {
    drafts[threshold.type] = {
      warningPercent: String(threshold.warningPercent),
      criticalPercent: String(threshold.criticalPercent),
      enabled: threshold.enabled
    };
  }
  return drafts;
}

function updateDraft(type: AlertType, patch: Partial<ThresholdDrafts[AlertType]>, setDrafts: React.Dispatch<React.SetStateAction<ThresholdDrafts>>): void {
  setDrafts((current) => ({ ...current, [type]: { ...current[type], ...patch } }));
}
