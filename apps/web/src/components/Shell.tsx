import type { ComponentType } from "react";
import { Cable, Files, Gauge, ListTree, ScrollText, ShieldCheck, SquareActivity } from "lucide-react";
import type { AuthUser } from "../api/client.js";
import type { ViewId } from "../App.js";

interface NavItem {
  id: ViewId;
  label: string;
  icon: ComponentType<{ size?: number }>;
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "概览", icon: Gauge },
  { id: "processes", label: "进程", icon: SquareActivity },
  { id: "services", label: "服务", icon: ListTree },
  { id: "files", label: "文件", icon: Files },
  { id: "connectors", label: "连接器", icon: Cable },
  { id: "security", label: "安全", icon: ShieldCheck },
  { id: "audit", label: "审计", icon: ScrollText }
];

interface ShellProps {
  user: AuthUser;
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
  onLogout: () => void;
  children: JSX.Element;
}

export function Shell({ user, activeView, onNavigate, onLogout, children }: ShellProps): JSX.Element {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">LXPanel</div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={activeView === item.id ? "active" : ""} onClick={() => onNavigate(item.id)}>
                <Icon size={18} /> {item.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <div className="content-area">
        <header className="topbar">
          <div>
            <span className="eyebrow">{user.role}</span>
            <strong>{user.username}</strong>
          </div>
          <button className="ghost-button" onClick={onLogout}>退出</button>
        </header>
        {children}
      </div>
    </div>
  );
}
