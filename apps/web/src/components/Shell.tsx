import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Archive, BellRing, Download, FileJson, Search, ShieldCheck, Star, X } from "lucide-react";
import { api, type AuthUser } from "../api/client.js";
import { navItems, navSections, roleRank, viewDescription, viewTitle, type NavItem, type ViewId } from "../navigation.js";
import { addRecentViewPreference, readFavoriteViewsPreference, readLocalePreference, readRecentViewsPreference, readTableDensityPreference, saveLocalePreference, saveTableDensityPreference, toggleFavoriteViewPreference, type LocalePreference, type TableDensity } from "../utils/preferences.js";

interface ShellProps {
  user: AuthUser;
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
  onLogout: () => void;
  children: JSX.Element;
}

interface CommandAction {
  id: string;
  label: string;
  description: string;
  section: string;
  keywords: string[];
  minRole?: AuthUser["role"];
  icon: typeof Archive;
  run: () => Promise<string>;
}

type CommandEntry = { type: "view"; section: string; item: NavItem } | { type: "action"; action: CommandAction };

export function Shell({ user, activeView, onNavigate, onLogout, children }: ShellProps): JSX.Element {
  const [filter, setFilter] = useState("");
  const [recentViews, setRecentViews] = useState<ViewId[]>(() => readRecentViewsPreference());
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandMessage, setCommandMessage] = useState<string | null>(null);
  const [tableDensity, setTableDensity] = useState<TableDensity>(() => readTableDensityPreference());
  const [locale, setLocale] = useState<LocalePreference>(() => readLocalePreference());
  const [favoriteViews, setFavoriteViews] = useState<ViewId[]>(() => readFavoriteViewsPreference());
  const searchRef = useRef<HTMLInputElement | null>(null);
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const visibleSections = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return navSections
      .map((section) => ({
        ...section,
        items: section.items
          .filter((item) => !item.minRole || roleRank(user.role) >= roleRank(item.minRole))
          .filter((item) => term.length === 0 || matchesNavItem(item, term))
      }))
      .filter((section) => section.items.length > 0);
  }, [filter, user.role]);
  const recentItems = recentViews
    .map((view) => navItems.find((item) => item.id === view))
    .filter((item): item is NavItem => {
      if (!item) {
        return false;
      }
      return !item.minRole || roleRank(user.role) >= roleRank(item.minRole);
    });
  const favoriteItems = favoriteViews
    .map((view) => navItems.find((item) => item.id === view))
    .filter((item): item is NavItem => {
      if (!item) {
        return false;
      }
      return !item.minRole || roleRank(user.role) >= roleRank(item.minRole);
    });
  const commandActions = useMemo<CommandAction[]>(() => [
    {
      id: "backup-create",
      label: "创建状态备份",
      description: "立即生成一份本地状态快照",
      section: "快捷动作",
      keywords: ["backup", "snapshot", "create"],
      minRole: "operator",
      icon: Archive,
      run: async () => {
        const response = await api.createBackup();
        return `已创建备份：${response.backup.fileName}`;
      }
    },
    {
      id: "alerts-check",
      label: "立即执行告警巡检",
      description: "触发一次阈值检查并刷新告警事件",
      section: "快捷动作",
      keywords: ["alert", "check", "巡检"],
      minRole: "operator",
      icon: BellRing,
      run: async () => {
        const response = await api.checkAlerts();
        return `巡检完成：${response.events.length} 条事件`;
      }
    },
    {
      id: "openapi-download",
      label: "下载 OpenAPI JSON",
      description: "导出当前 API 契约文档",
      section: "快捷动作",
      keywords: ["openapi", "schema", "json"],
      icon: FileJson,
      run: async () => {
        const document = await api.openApiDocument();
        downloadJson("lxpanel-openapi.json", document);
        return "OpenAPI JSON 已生成下载。";
      }
    },
    {
      id: "diagnostics-bundle",
      label: "生成诊断包摘要",
      description: "采集平台交付诊断摘要和校验哈希",
      section: "快捷动作",
      keywords: ["diagnostics", "bundle", "诊断"],
      minRole: "owner",
      icon: ShieldCheck,
      run: async () => {
        const response = await api.diagnosticsBundle();
        downloadJson("lxpanel-diagnostics.json", response.bundle);
        return `诊断包摘要：${response.bundle.sha256.slice(0, 12)}`;
      }
    },
    {
      id: "prometheus-download",
      label: "下载 Prometheus 指标",
      description: "导出当前监控指标文本",
      section: "快捷动作",
      keywords: ["prometheus", "metrics", "监控"],
      icon: Download,
      run: async () => {
        const blob = await api.monitoringPrometheus();
        downloadBlob("lxpanel-prometheus.txt", blob);
        return "Prometheus 指标已生成下载。";
      }
    }
  ], []);
  const commandResults = useMemo<CommandEntry[]>(() => {
    const term = commandQuery.trim().toLowerCase();
    const views: CommandEntry[] = navSections
      .flatMap((section) => section.items.map((item) => ({ section: section.title, item })))
      .filter((result) => !result.item.minRole || roleRank(user.role) >= roleRank(result.item.minRole))
      .filter((result) => term.length === 0 || matchesNavItem(result.item, term))
      .map((result) => ({ type: "view", section: result.section, item: result.item }));
    const actions: CommandEntry[] = commandActions
      .filter((action) => !action.minRole || roleRank(user.role) >= roleRank(action.minRole))
      .filter((action) => term.length === 0 || matchesAction(action, term))
      .map((action) => ({ type: "action", action }));
    return [...actions, ...views].slice(0, 10);
  }, [commandActions, commandQuery, user.role]);

  useEffect(() => {
    setRecentViews((current) => addRecentViewPreference(activeView, current));
  }, [activeView]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    function handleGlobalKeys(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
      }
    }
    window.addEventListener("keydown", handleGlobalKeys);
    return () => window.removeEventListener("keydown", handleGlobalKeys);
  }, []);

  useEffect(() => {
    if (commandOpen) {
      commandInputRef.current?.focus();
    }
  }, [commandOpen]);

  function navigateFromCommand(view: ViewId): void {
    onNavigate(view);
    setCommandOpen(false);
    setCommandQuery("");
  }

  async function runCommandAction(action: CommandAction): Promise<void> {
    try {
      const message = await action.run();
      setCommandMessage(message);
    } catch (caught) {
      setCommandMessage(caught instanceof Error ? caught.message : "命令执行失败。");
    }
  }

  function executeCommand(entry: CommandEntry): void {
    if (entry.type === "view") {
      navigateFromCommand(entry.item.id);
      return;
    }
    void runCommandAction(entry.action);
  }

  function submitCommand(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const firstResult = commandResults[0];
    if (firstResult) {
      executeCommand(firstResult);
    }
  }

  function changeTableDensity(nextDensity: TableDensity): void {
    setTableDensity(nextDensity);
    saveTableDensityPreference(nextDensity);
  }

  function changeLocale(nextLocale: LocalePreference): void {
    setLocale(nextLocale);
    saveLocalePreference(nextLocale);
  }

  function toggleFavorite(): void {
    setFavoriteViews((current) => toggleFavoriteViewPreference(activeView, current));
  }

  return (
    <div className={`app-shell density-${tableDensity}`}>
      <a className="skip-link" href="#main-content">跳到主内容</a>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">LXPanel</div>
          <span className="sidebar-subtitle">轻量运维工作台</span>
        </div>
        <div className="nav-search">
          <input ref={searchRef} value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="搜索功能、资源或动作" aria-label="搜索导航" />
        </div>
        <nav>
          {visibleSections.map((section) => (
            <div className="nav-section" key={section.title}>
              <div className="nav-section-title">{section.title}</div>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.id} className={`nav-button${activeView === item.id ? " active" : ""}`} onClick={() => onNavigate(item.id)} aria-current={activeView === item.id ? "page" : undefined}>
                    <Icon size={18} />
                    <span className="nav-label"><strong>{item.label}</strong><small>{item.description}</small></span>
                  </button>
                );
              })}
            </div>
          ))}
          {visibleSections.length === 0 ? <p className="nav-empty">没有匹配的入口。</p> : null}
        </nav>
      </aside>
      <div className="content-area" id="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">{viewTitle(activeView)}</span>
            <strong>{viewDescription(activeView)}</strong>
          </div>
          <div className="topbar-actions">
            {favoriteItems.length ? <div className="recent-views">{favoriteItems.slice(0, 3).map((item) => <button type="button" key={item.id} onClick={() => onNavigate(item.id)}>★ {item.label}</button>)}</div> : recentItems.length ? <div className="recent-views">{recentItems.slice(0, 3).map((item) => <button type="button" key={item.id} onClick={() => onNavigate(item.id)}>{item.label}</button>)}</div> : null}
            <button className="command-trigger" type="button" onClick={() => setCommandOpen(true)} title="打开命令面板 Ctrl+K" aria-label="打开命令面板"><Search size={16} /><kbd>Ctrl K</kbd></button>
            <button className="icon-button" type="button" onClick={toggleFavorite} title={favoriteViews.includes(activeView) ? "取消收藏当前页面" : "收藏当前页面"} aria-label={favoriteViews.includes(activeView) ? "取消收藏当前页面" : "收藏当前页面"}><Star size={17} fill={favoriteViews.includes(activeView) ? "currentColor" : "none"} /></button>
            <select className="locale-select" value={locale} onChange={(event) => changeLocale(event.target.value as LocalePreference)} aria-label="界面语言"><option value="zh-CN">中文</option><option value="en-US">EN</option></select>
            <div className="density-toggle" role="group" aria-label="表格密度">
              <button type="button" className={tableDensity === "comfortable" ? "active" : ""} onClick={() => changeTableDensity("comfortable")}>舒适</button>
              <button type="button" className={tableDensity === "compact" ? "active" : ""} onClick={() => changeTableDensity("compact")}>紧凑</button>
            </div>
            <div className="user-chip"><span>{user.role}</span><strong>{user.username}</strong></div>
            <button className="ghost-button" onClick={onLogout}>退出</button>
          </div>
        </header>
        {children}
      </div>
      {commandOpen ? (
        <div className="command-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false); }}>
          <section className="command-panel" role="dialog" aria-modal="true" aria-label="全局命令面板">
            <form className="command-search" onSubmit={submitCommand}>
              <Search size={18} />
              <input ref={commandInputRef} value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="搜索页面、资源或动作" aria-label="命令搜索" />
              <button type="button" onClick={() => setCommandOpen(false)} title="关闭"><X size={18} /></button>
            </form>
            {commandMessage ? <p className="command-message">{commandMessage}</p> : null}
            <div className="command-list">
              {commandResults.map((result) => {
                const Icon = result.type === "view" ? result.item.icon : result.action.icon;
                return (
                  <button type="button" key={result.type === "view" ? result.item.id : result.action.id} className="command-item" onClick={() => executeCommand(result)}>
                    <Icon size={18} />
                    <span><strong>{result.type === "view" ? result.item.label : result.action.label}</strong><small>{result.type === "view" ? result.item.description : result.action.description}</small></span>
                    <em>{result.type === "view" ? result.section : result.action.section}</em>
                  </button>
                );
              })}
              {commandResults.length === 0 ? <p className="command-empty">没有匹配的命令。</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function matchesNavItem(item: NavItem, term: string): boolean {
  return [item.label, item.description, ...item.keywords].some((value) => value.toLowerCase().includes(term));
}

function matchesAction(action: CommandAction, term: string): boolean {
  return [action.label, action.description, action.section, ...action.keywords].some((value) => value.toLowerCase().includes(term));
}

function downloadJson(fileName: string, value: unknown): void {
  downloadBlob(fileName, new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
}

function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

