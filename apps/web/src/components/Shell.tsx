import type { ComponentType } from "react";
import { Archive, Cable, ClipboardList, Container, FileText, Files, Gauge, ListTree, ScrollText, ShieldCheck, SquareActivity, Users } from "lucide-react";
import type { AuthUser } from "../api/client.js";
import type { ViewId } from "../App.js";

interface NavItem {
  id: ViewId;
  label: string;
  icon: ComponentType<{ size?: number }>;
  minRole?: AuthUser["role"];
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "概览", icon: Gauge },
  { id: "processes", label: "进程", icon: SquareActivity },
  { id: "services", label: "服务", icon: ListTree },
  { id: "docker", label: "容器", icon: Container },
  { id: "files", label: "文件", icon: Files },
  { id: "logs", label: "日志", icon: FileText },
  { id: "connectors", label: "连接器", icon: Cable },
  { id: "tasks", label: "任务", icon: ClipboardList, minRole: "operator" },
  { id: "users", label: "用户", icon: Users, minRole: "owner" },
  { id: "backups", label: "备份", icon: Archive, minRole: "owner" },
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
  const visibleItems = navItems.filter((item) => !item.minRole || roleRank(user.role) >= roleRank(item.minRole));
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">LXPanel</div>
        <nav>
          {visibleItems.map((item) => {
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

function roleRank(role: AuthUser["role"]): number {
  return role === "owner" ? 3 : role === "operator" ? 2 : 1;
}

