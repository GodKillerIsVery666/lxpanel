import { useEffect, useMemo, useRef, useState } from "react";
import type { AuthUser } from "../api/client.js";
import { navItems, navSections, roleRank, viewDescription, viewTitle, type NavItem, type ViewId } from "../navigation.js";

interface ShellProps {
  user: AuthUser;
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
  onLogout: () => void;
  children: JSX.Element;
}

export function Shell({ user, activeView, onNavigate, onLogout, children }: ShellProps): JSX.Element {
  const [filter, setFilter] = useState("");
  const [recentViews, setRecentViews] = useState<ViewId[]>(() => readRecentViews());
  const searchRef = useRef<HTMLInputElement | null>(null);
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

  useEffect(() => {
    setRecentViews((current) => writeRecentViews(activeView, current));
  }, [activeView]);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <div className="app-shell">
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
            <div className="user-chip"><span>{user.role}</span><strong>{user.username}</strong></div>
            <button className="ghost-button" onClick={onLogout}>退出</button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

function matchesNavItem(item: NavItem, term: string): boolean {
  return [item.label, item.description, ...item.keywords].some((value) => value.toLowerCase().includes(term));
}

const recentStorageKey = "lxpanel.recentViews";

function readRecentViews(): ViewId[] {
  try {
    const rawValue = window.localStorage.getItem(recentStorageKey);
    if (!rawValue) {
      return [];
    }
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isViewId).slice(0, 5);
  } catch {
    return [];
  }
}

function writeRecentViews(activeView: ViewId, current: ViewId[]): ViewId[] {
  const nextViews = [activeView, ...current.filter((view) => view !== activeView)].slice(0, 5);
  window.localStorage.setItem(recentStorageKey, JSON.stringify(nextViews));
  return nextViews;
}

function isViewId(value: unknown): value is ViewId {
  return typeof value === "string" && navItems.some((item) => item.id === value);
}

