import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Search, X } from "lucide-react";
import type { AuthUser } from "../api/client.js";
import { navItems, navSections, roleRank, viewDescription, viewTitle, type NavItem, type ViewId } from "../navigation.js";
import { addRecentViewPreference, readRecentViewsPreference, readTableDensityPreference, saveTableDensityPreference, type TableDensity } from "../utils/preferences.js";

interface ShellProps {
  user: AuthUser;
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
  onLogout: () => void;
  children: JSX.Element;
}

export function Shell({ user, activeView, onNavigate, onLogout, children }: ShellProps): JSX.Element {
  const [filter, setFilter] = useState("");
  const [recentViews, setRecentViews] = useState<ViewId[]>(() => readRecentViewsPreference());
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [tableDensity, setTableDensity] = useState<TableDensity>(() => readTableDensityPreference());
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
  const commandResults = useMemo(() => {
    const term = commandQuery.trim().toLowerCase();
    return navSections
      .flatMap((section) => section.items.map((item) => ({ section: section.title, item })))
      .filter((result) => !result.item.minRole || roleRank(user.role) >= roleRank(result.item.minRole))
      .filter((result) => term.length === 0 || matchesNavItem(result.item, term))
      .slice(0, 8);
  }, [commandQuery, user.role]);

  useEffect(() => {
    setRecentViews((current) => addRecentViewPreference(activeView, current));
  }, [activeView]);

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

  function submitCommand(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const firstResult = commandResults[0];
    if (firstResult) {
      navigateFromCommand(firstResult.item.id);
    }
  }

  function changeTableDensity(nextDensity: TableDensity): void {
    setTableDensity(nextDensity);
    saveTableDensityPreference(nextDensity);
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
            {recentItems.length ? <div className="recent-views">{recentItems.slice(0, 3).map((item) => <button type="button" key={item.id} onClick={() => onNavigate(item.id)}>{item.label}</button>)}</div> : null}
            <button className="command-trigger" type="button" onClick={() => setCommandOpen(true)} title="打开命令面板 Ctrl+K" aria-label="打开命令面板"><Search size={16} /><kbd>Ctrl K</kbd></button>
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
            <div className="command-list">
              {commandResults.map((result) => {
                const Icon = result.item.icon;
                return (
                  <button type="button" key={result.item.id} className="command-item" onClick={() => navigateFromCommand(result.item.id)}>
                    <Icon size={18} />
                    <span><strong>{result.item.label}</strong><small>{result.item.description}</small></span>
                    <em>{result.section}</em>
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

