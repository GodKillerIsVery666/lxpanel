import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Archive, BellRing, Download, FileJson, Search, ShieldCheck, Star, X } from "lucide-react";
import { api, type AuthUser } from "../api/client.js";
import { navItems, navSections, roleRank, type NavItem, type ViewId } from "../navigation.js";
import { shellText } from "../i18n/resources.js";
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
  const text = shellText[locale];
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
  }, [filter, user.role, locale]);
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
      label: locale === "en-US" ? "Create state backup" : "创建状态备份",
      description: locale === "en-US" ? "Create a local state snapshot now" : "立即生成一份本地状态快照",
      section: text.sections.actions,
      keywords: ["backup", "snapshot", "create"],
      minRole: "owner",
      icon: Archive,
      run: async () => {
        const response = await api.createBackup();
        return locale === "en-US" ? `Backup created: ${response.backup.fileName}` : `已创建备份：${response.backup.fileName}`;
      }
    },
    {
      id: "alerts-check",
      label: locale === "en-US" ? "Run alert check" : "立即执行告警巡检",
      description: locale === "en-US" ? "Trigger threshold checks and refresh alert events" : "触发一次阈值检查并刷新告警事件",
      section: text.sections.actions,
      keywords: ["alert", "check", "巡检"],
      minRole: "operator",
      icon: BellRing,
      run: async () => {
        const response = await api.checkAlerts();
        return locale === "en-US" ? `Check complete: ${response.events.length} events` : `巡检完成：${response.events.length} 条事件`;
      }
    },
    {
      id: "openapi-download",
      label: locale === "en-US" ? "Download OpenAPI JSON" : "下载 OpenAPI JSON",
      description: locale === "en-US" ? "Export the current API contract" : "导出当前 API 契约文档",
      section: text.sections.actions,
      keywords: ["openapi", "schema", "json"],
      icon: FileJson,
      run: async () => {
        const document = await api.openApiDocument();
        downloadJson("lxpanel-openapi.json", document);
        return locale === "en-US" ? "OpenAPI JSON download is ready." : "OpenAPI JSON 已生成下载。";
      }
    },
    {
      id: "diagnostics-bundle",
      label: locale === "en-US" ? "Generate diagnostics summary" : "生成诊断包摘要",
      description: locale === "en-US" ? "Collect delivery diagnostics and checksum" : "采集平台交付诊断摘要和校验哈希",
      section: text.sections.actions,
      keywords: ["diagnostics", "bundle", "诊断"],
      minRole: "owner",
      icon: ShieldCheck,
      run: async () => {
        const response = await api.diagnosticsBundle();
        downloadJson("lxpanel-diagnostics.json", response.bundle);
        return locale === "en-US" ? `Diagnostics: ${response.bundle.sha256.slice(0, 12)}` : `诊断包摘要：${response.bundle.sha256.slice(0, 12)}`;
      }
    },
    {
      id: "prometheus-download",
      label: locale === "en-US" ? "Download Prometheus metrics" : "下载 Prometheus 指标",
      description: locale === "en-US" ? "Export current monitoring metrics text" : "导出当前监控指标文本",
      section: text.sections.actions,
      keywords: ["prometheus", "metrics", "监控"],
      icon: Download,
      run: async () => {
        const blob = await api.monitoringPrometheus();
        downloadBlob("lxpanel-prometheus.txt", blob);
        return locale === "en-US" ? "Prometheus metrics download is ready." : "Prometheus 指标已生成下载。";
      }
    }
  ], [locale, text.sections.actions]);
  const commandResults = useMemo<CommandEntry[]>(() => {
    const term = commandQuery.trim().toLowerCase();
    const views: CommandEntry[] = navSections
      .flatMap((section) => section.items.map((item) => ({ section: text.sections[section.id], item })))
      .filter((result) => !result.item.minRole || roleRank(user.role) >= roleRank(result.item.minRole))
      .filter((result) => term.length === 0 || matchesNavItem(result.item, term))
      .map((result) => ({ type: "view", section: result.section, item: result.item }));
    const actions: CommandEntry[] = commandActions
      .filter((action) => !action.minRole || roleRank(user.role) >= roleRank(action.minRole))
      .filter((action) => term.length === 0 || matchesAction(action, term))
      .map((action) => ({ type: "action", action }));
    return [...actions, ...views].slice(0, 10);
  }, [commandActions, commandQuery, user.role, locale]);

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
      <a className="skip-link" href="#main-content">{text.skip}</a>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">LXPanel</div>
          <span className="sidebar-subtitle">{text.brandSubtitle}</span>
        </div>
        <div className="nav-search">
          <input ref={searchRef} value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={text.navSearch} aria-label={text.navSearch} autoComplete="off" />
        </div>
        <nav>
          {visibleSections.map((section) => (
            <div className="nav-section" key={section.title}>
              <div className="nav-section-title">{text.sections[section.id]}</div>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.id} className={`nav-button${activeView === item.id ? " active" : ""}`} onClick={() => { setFilter(""); onNavigate(item.id); }} aria-current={activeView === item.id ? "page" : undefined}>
                    <Icon size={18} />
                    <span className="nav-label"><strong>{viewLabel(item, text)}</strong><small>{viewDescription(item, text)}</small></span>
                  </button>
                );
              })}
            </div>
          ))}
          {visibleSections.length === 0 ? <p className="nav-empty">{text.navEmpty}</p> : null}
        </nav>
      </aside>
      <div className="content-area" id="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">{text.views[activeView]?.label ?? activeView}</span>
            <strong>{text.views[activeView]?.description ?? ""}</strong>
          </div>
          <div className="topbar-actions">
            {favoriteItems.length ? <div className="recent-views">{favoriteItems.slice(0, 3).map((item) => <button type="button" key={item.id} onClick={() => { setFilter(""); onNavigate(item.id); }}>★ {viewLabel(item, text)}</button>)}</div> : recentItems.length ? <div className="recent-views">{recentItems.slice(0, 3).map((item) => <button type="button" key={item.id} onClick={() => { setFilter(""); onNavigate(item.id); }}>{viewLabel(item, text)}</button>)}</div> : null}
            <button className="command-trigger" type="button" onClick={() => setCommandOpen(true)} title={text.commandTrigger} aria-label={text.commandTrigger}><Search size={16} /><kbd>Ctrl K</kbd></button>
            <button className="icon-button" type="button" onClick={toggleFavorite} title={favoriteViews.includes(activeView) ? text.unfavorite : text.favorite} aria-label={favoriteViews.includes(activeView) ? text.unfavorite : text.favorite}><Star size={17} fill={favoriteViews.includes(activeView) ? "currentColor" : "none"} /></button>
            <select className="locale-select" value={locale} onChange={(event) => changeLocale(event.target.value as LocalePreference)} aria-label={text.language}><option value="zh-CN">中文</option><option value="en-US">EN</option></select>
            <div className="density-toggle" role="group" aria-label={text.density}>
              <button type="button" className={tableDensity === "comfortable" ? "active" : ""} onClick={() => changeTableDensity("comfortable")}>{text.comfortable}</button>
              <button type="button" className={tableDensity === "compact" ? "active" : ""} onClick={() => changeTableDensity("compact")}>{text.compact}</button>
            </div>
            <div className="user-chip"><span>{user.role}</span><strong>{user.username}</strong></div>
            <button className="ghost-button" onClick={onLogout}>{text.logout}</button>
          </div>
        </header>
        {children}
      </div>
      {commandOpen ? (
        <div className="command-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false); }}>
          <section className="command-panel" role="dialog" aria-modal="true" aria-label={text.commandDialog}>
            <form className="command-search" onSubmit={submitCommand}>
              <Search size={18} />
              <input ref={commandInputRef} value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder={text.commandSearch} aria-label={text.commandSearch} />
              <button type="button" onClick={() => setCommandOpen(false)} title={text.close}><X size={18} /></button>
            </form>
            {commandMessage ? <p className="command-message">{commandMessage}</p> : null}
            <div className="command-list">
              {commandResults.map((result) => {
                const Icon = result.type === "view" ? result.item.icon : result.action.icon;
                return (
                  <button type="button" key={result.type === "view" ? result.item.id : result.action.id} className="command-item" onClick={() => executeCommand(result)}>
                    <Icon size={18} />
                    <span><strong>{result.type === "view" ? viewLabel(result.item, text) : result.action.label}</strong><small>{result.type === "view" ? viewDescription(result.item, text) : result.action.description}</small></span>
                    <em>{result.type === "view" ? result.section : result.action.section}</em>
                  </button>
                );
              })}
              {commandResults.length === 0 ? <p className="command-empty">{text.noCommands}</p> : null}
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

function viewLabel(item: NavItem, text: typeof shellText[LocalePreference]): string {
  return text.views[item.id]?.label ?? item.label;
}

function viewDescription(item: NavItem, text: typeof shellText[LocalePreference]): string {
  return text.views[item.id]?.description ?? item.description;
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

