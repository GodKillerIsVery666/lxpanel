import { useEffect, useState } from "react";
import { Archive, BellRing, Cpu, Database, HardDrive, Network, PackagePlus, RotateCw, Server, ShieldCheck, SlidersHorizontal, Timer } from "lucide-react";
import type { AlertSummary, SecurityPosture, SystemOverview } from "@lxpanel/shared";
import type { AuthUser } from "../api/client.js";
import { api } from "../api/client.js";
import { MetricCard } from "../components/MetricCard.js";
import { StatusPill } from "../components/StatusPill.js";
import { canAccessView, type ViewId } from "../navigation.js";
import { formatBytes, formatDuration, formatPercent } from "../utils/format.js";

interface DashboardPageProps {
  user: AuthUser;
  onNavigate: (view: ViewId) => void;
}

interface QuickAction {
  view: ViewId;
  title: string;
  detail: string;
  icon: typeof Server;
  tone: string;
}

export function DashboardPage({ user, onNavigate }: DashboardPageProps): JSX.Element {
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

  const alertAttention = (alertSummary?.activeCritical ?? 0) + (alertSummary?.activeWarning ?? 0);
  const securityAttention = posture?.checks.filter((check) => check.status !== "secure").length ?? 0;
  const quickActions = dashboardActions(alertAttention, securityAttention).filter((action) => canAccessView(user, action.view));
  const primaryRecommendation = dashboardRecommendation(alertSummary, posture);

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
      <section className="workbench-band">
        <div>
          <span className="eyebrow">当前状态</span>
          <h2>{alertAttention > 0 ? "需要先处理告警" : securityAttention > 0 ? "安全项值得关注" : "运行平稳"}</h2>
          <p>{primaryRecommendation}</p>
        </div>
        <div className="workbench-status">
          <StatusPill status={alertAttention > 0 ? "warn" : "secure"} label={`${alertAttention} 个告警`} />
          <StatusPill status={securityAttention > 0 ? "warn" : "secure"} label={`${securityAttention} 个安全项`} />
        </div>
      </section>
      <section className="quick-action-grid" aria-label="常用操作">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button type="button" className="quick-action" key={action.view} onClick={() => onNavigate(action.view)} style={{ borderTopColor: action.tone }}>
              <Icon size={20} />
              <span><strong>{action.title}</strong><small>{action.detail}</small></span>
            </button>
          );
        })}
      </section>
      <div className="metric-grid">
        <MetricCard label="CPU" value={formatPercent(overview?.cpu.usagePercent ?? 0)} meta={overview?.cpu.model} progressPercent={overview?.cpu.usagePercent ?? 0} accent="#267871" icon={<Cpu size={22} />} />
        <MetricCard label="内存" value={formatPercent(overview?.memory.usedPercent ?? 0)} meta={overview ? `${formatBytes(overview.memory.totalBytes - overview.memory.freeBytes)} / ${formatBytes(overview.memory.totalBytes)}` : "-"} progressPercent={overview?.memory.usedPercent ?? 0} accent="#b8692d" icon={<HardDrive size={22} />} />
        <MetricCard label="运行时间" value={overview ? formatDuration(overview.uptimeSeconds) : "-"} accent="#315f99" icon={<Timer size={22} />} />
        <MetricCard label="网络地址" value={`${overview?.networkInterfaces.filter((item) => !item.internal).length ?? 0}`} meta="外部接口" accent="#7356a1" icon={<Network size={22} />} />
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

function dashboardActions(alertAttention: number, securityAttention: number): QuickAction[] {
  return [
    { view: "hosts", title: "纳管主机", detail: "资产、分组、批量命令", icon: Server, tone: "#267871" },
    { view: "apps", title: "部署应用", detail: "模板、升级、回滚", icon: PackagePlus, tone: "#315f99" },
    { view: "databases", title: "数据库备份", detail: "连接、计划、演练", icon: Database, tone: "#b8692d" },
    { view: "alerts", title: "处理告警", detail: alertAttention > 0 ? `${alertAttention} 个未确认` : "阈值和静默", icon: BellRing, tone: alertAttention > 0 ? "#b9473f" : "#267871" },
    { view: "backups", title: "创建快照", detail: "本地与远程备份", icon: Archive, tone: "#7356a1" },
    { view: "security", title: "安全巡检", detail: securityAttention > 0 ? `${securityAttention} 项需关注` : "会话和 Token", icon: ShieldCheck, tone: securityAttention > 0 ? "#b8692d" : "#267871" },
    { view: "platform", title: "交付治理", detail: "许可证、工作空间、OpenAPI", icon: SlidersHorizontal, tone: "#202520" }
  ];
}

function dashboardRecommendation(alertSummary: AlertSummary | null, posture: SecurityPosture | null): string {
  if ((alertSummary?.activeCritical ?? 0) > 0) {
    return alertSummary?.latest?.message ?? "存在严重资源告警。";
  }
  if ((alertSummary?.activeWarning ?? 0) > 0) {
    return alertSummary?.latest?.message ?? "存在资源警告。";
  }
  const recommendation = posture?.recommendations[0];
  return recommendation ?? "关键巡检项暂无高优先级提醒。";
}
