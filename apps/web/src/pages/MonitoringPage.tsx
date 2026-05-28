import { useEffect, useMemo, useState } from "react";
import { Activity, Clock, Cpu, Database, Gauge, HardDrive, MemoryStick, RotateCw } from "lucide-react";
import type { CapacityPlan, MetricSample } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { MetricCard } from "../components/MetricCard.js";

import { formatDate } from "../utils/format.js";

export function MonitoringPage(): JSX.Element {
  const [samples, setSamples] = useState<MetricSample[]>([]);
  const [hostId, setHostId] = useState("local");
  const [error, setError] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<CapacityPlan | null>(null);
  const [apiLatencyMs, setApiLatencyMs] = useState(0);
  const [schedulerDelayMs, setSchedulerDelayMs] = useState(0);
  const ordered = useMemo(() => [...samples].reverse(), [samples]);
  const latest = samples[0];

  async function load(): Promise<void> {
    try {
      const [samplesResponse, capacityResponse] = await Promise.all([
        api.monitoringSamples(hostId || "local", 288),
        api.capacityPlan().catch(() => null)
      ]);
      setSamples(samplesResponse.samples);
      setCapacity(capacityResponse?.plan ?? null);
      // 测量 API 延迟
      const t0 = performance.now();
      try { await fetch("/api/health/live", { signal: AbortSignal.timeout(5000) }); } catch { /* ignore */ }
      setApiLatencyMs(Math.round(performance.now() - t0));
      // 估计调度器延迟（基于样本时间差）
      if (samplesResponse.samples.length > 1) {
        const lastTwo = samplesResponse.samples.slice(0, 2);
        const delay = lastTwo[0] && lastTwo[1] ? new Date(lastTwo[0].time).getTime() - new Date(lastTwo[1].time).getTime() : 0;
        setSchedulerDelayMs(Math.max(0, delay - 30000)); // 减去 30s 标准间隔
      }
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
        <div><h1>监控趋势</h1><p>{latest ? `${latest.hostName} · ${formatDate(latest.time)}` : "等待调度器采样"}</p></div>
        <button className="icon-button" onClick={() => void load()} title="刷新"><RotateCw size={18} /></button>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <div className="list-toolbar">
        <input value={hostId} onChange={(event) => setHostId(event.target.value)} placeholder="hostId" aria-label="监控主机 ID" />
        <p className="muted-text">输入主机 ID 筛选监控数据</p>
      </div>
      <div className="metric-grid">
        <MetricCard label="CPU" value={`${latest?.cpuPercent ?? 0}%`} accent="#267871" icon={<Cpu size={22} />} />
        <MetricCard label="内存" value={`${latest?.memoryPercent ?? 0}%`} accent="#a05a2c" icon={<MemoryStick size={22} />} />
        <MetricCard label="磁盘" value={typeof latest?.diskUsedPercent === "number" ? `${latest.diskUsedPercent}%` : "-"} accent="#315f99" icon={<HardDrive size={22} />} />
        <MetricCard label="样本" value={`${samples.length}`} meta={`${hostId || "local"} 最近 288 条`} accent="#6f5a96" icon={<Activity size={22} />} />
      </div>
      <section className="table-panel"><div className="panel-title">性能面板 <span className="muted-text">实时诊断 API 与调度器状态</span></div>
        <div className="metric-grid">
          <MetricCard label="API 延迟" value={`${apiLatencyMs}ms`} accent="#267871" icon={<Gauge size={22} />} />
          <MetricCard label="调度器偏差" value={schedulerDelayMs > 5000 ? `${Math.round(schedulerDelayMs / 1000)}s` : "正常"} accent={schedulerDelayMs > 5000 ? "#c0392b" : "#27ae60"} icon={<Clock size={22} />} />
          <MetricCard label="状态体积" value={capacity ? `${(capacity.stateBytes / 1024).toFixed(1)}KB` : "-"} accent="#315f99" icon={<Database size={22} />} />
          <MetricCard label="监控样本" value={`${samples.length}`} meta={`${hostId || "local"}`} accent="#6f5a96" icon={<Activity size={22} />} />
        </div>
        {capacity?.recommendations.map((item) => <p className="notice" key={item}>{item}</p>)}
      </section>
      <section className="table-panel">
        <div className="panel-title">资源曲线</div>
        {ordered.length ? <TrendChart samples={ordered} /> : <p className="muted-text">暂无监控样本，调度器会自动写入。</p>}
      </section>
      <section className="table-panel">
        <div className="panel-title">最近样本</div>
        <table>
          <thead><tr><th>时间</th><th>主机</th><th>CPU</th><th>内存</th><th>磁盘</th></tr></thead>
          <tbody>{samples.slice(0, 20).map((sample) => (
            <tr key={sample.id}><td>{formatDate(sample.time)}</td><td>{sample.hostName}</td><td>{sample.cpuPercent}%</td><td>{sample.memoryPercent}%</td><td>{typeof sample.diskUsedPercent === "number" ? `${sample.diskUsedPercent}%` : "-"}</td></tr>
          ))}</tbody>
        </table>
      </section>
    </main>
  );
}

function TrendChart({ samples }: { samples: MetricSample[] }): JSX.Element {
  return (
    <svg className="trend-chart" viewBox="0 0 640 220" role="img" aria-label="资源使用率曲线">
      <Grid />
      <Polyline samples={samples} accessor={(sample) => sample.cpuPercent} color="#267871" />
      <Polyline samples={samples} accessor={(sample) => sample.memoryPercent} color="#a05a2c" />
      <Polyline samples={samples} accessor={(sample) => sample.diskUsedPercent ?? 0} color="#315f99" />
      <g className="trend-legend">
        <text x="18" y="206" fill="#267871">CPU</text>
        <text x="72" y="206" fill="#a05a2c">内存</text>
        <text x="138" y="206" fill="#315f99">磁盘</text>
      </g>
    </svg>
  );
}

function Grid(): JSX.Element {
  return (
    <g className="trend-grid">
      {[0, 25, 50, 75, 100].map((value) => <line key={value} x1="24" x2="620" y1={yFor(value)} y2={yFor(value)} />)}
    </g>
  );
}

function Polyline({ samples, accessor, color }: { samples: MetricSample[]; accessor: (sample: MetricSample) => number; color: string }): JSX.Element {
  const points = samples.map((sample, index) => `${xFor(index, samples.length)},${yFor(accessor(sample))}`).join(" ");
  return <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />;
}

function xFor(index: number, total: number): number {
  if (total <= 1) {
    return 24;
  }
  return 24 + (596 * index) / (total - 1);
}

function yFor(value: number): number {
  return 184 - (Math.max(0, Math.min(100, value)) / 100) * 156;
}
