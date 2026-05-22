import { useEffect, useState } from "react";
import { Cpu, HardDrive, Network, RotateCw, Timer } from "lucide-react";
import type { AlertSummary, SecurityPosture, SystemOverview } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { MetricCard } from "../components/MetricCard.js";
import { formatBytes, formatDuration } from "../utils/format.js";

export function DashboardPage(): JSX.Element {
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [posture, setPosture] = useState<SecurityPosture | null>(null);
  const [alertSummary, setAlertSummary] = useState<AlertSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    try {
      const [overviewResponse, securityResponse, alertsResponse] = await Promise.all([api.overview(), api.security(), api.alerts()]);
      setOverview(overviewResponse.overview);
      setPosture(securityResponse.posture);
      setAlertSummary(alertsResponse.summary);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败。");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading">
        <div>
          <h1>运行概览</h1>
          <p>{overview ? `${overview.hostname} · ${overview.platform}/${overview.arch}` : "正在同步"}</p>
        </div>
        <button className="icon-button" onClick={() => void load()} title="刷新"><RotateCw size={18} /></button>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <div className="metric-grid">
        <MetricCard label="CPU" value={`${overview?.cpu.usagePercent ?? 0}%`} meta={overview?.cpu.model} accent="#267871" icon={<Cpu size={22} />} />
        <MetricCard label="内存" value={`${overview?.memory.usedPercent ?? 0}%`} meta={overview ? `${formatBytes(overview.memory.totalBytes - overview.memory.freeBytes)} / ${formatBytes(overview.memory.totalBytes)}` : "-"} accent="#a05a2c" icon={<HardDrive size={22} />} />
        <MetricCard label="运行时间" value={overview ? formatDuration(overview.uptimeSeconds) : "-"} accent="#315f99" icon={<Timer size={22} />} />
        <MetricCard label="网络地址" value={`${overview?.networkInterfaces.filter((item) => !item.internal).length ?? 0}`} meta="外部接口" accent="#6f5a96" icon={<Network size={22} />} />
      </div>
      <section className="table-panel">
        <div className="panel-title">资源告警</div>
        {alertSummary && (alertSummary.activeCritical > 0 || alertSummary.activeWarning > 0) ? (
          <div className="alert-summary">
            <strong>{alertSummary.activeCritical} 严重 / {alertSummary.activeWarning} 警告</strong>
            <span>{alertSummary.latest?.message ?? "存在未确认告警"}</span>
          </div>
        ) : <p className="muted-text">当前没有未确认资源告警。</p>}
      </section>
      <section className="table-panel">
        <div className="panel-title">安全提醒</div>
        {posture?.recommendations.length ? posture.recommendations.map((item) => <p className="notice" key={item}>{item}</p>) : <p className="muted-text">当前没有高优先级提醒。</p>}
      </section>
    </main>
  );
}
