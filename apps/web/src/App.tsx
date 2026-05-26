import { useEffect, useState } from "react";
import { api, type AuthStatus, type AuthUser } from "./api/client.js";
import { LoginPanel } from "./components/LoginPanel.js";
import { Shell } from "./components/Shell.js";
import { ApprovalsPage } from "./pages/ApprovalsPage.js";
import { AuditPage } from "./pages/AuditPage.js";
import { AlertsPage } from "./pages/AlertsPage.js";
import { AppsPage } from "./pages/AppsPage.js";
import { BackupsPage } from "./pages/BackupsPage.js";
import { ConnectorsPage } from "./pages/ConnectorsPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { DatabasesPage } from "./pages/DatabasesPage.js";
import { DockerPage } from "./pages/DockerPage.js";
import { FilesPage } from "./pages/FilesPage.js";
import { HostsPage } from "./pages/HostsPage.js";
import { LogsPage } from "./pages/LogsPage.js";
import { MonitoringPage } from "./pages/MonitoringPage.js";
import { NotificationsPage } from "./pages/NotificationsPage.js";
import { PlatformPage } from "./pages/PlatformPage.js";
import { ProcessesPage } from "./pages/ProcessesPage.js";
import { SecurityPage } from "./pages/SecurityPage.js";
import { ServicesPage } from "./pages/ServicesPage.js";
import { TasksPage } from "./pages/TasksPage.js";
import { UsersPage } from "./pages/UsersPage.js";

export type ViewId = "dashboard" | "hosts" | "monitoring" | "processes" | "services" | "docker" | "apps" | "databases" | "files" | "logs" | "connectors" | "tasks" | "alerts" | "notifications" | "approvals" | "users" | "backups" | "security" | "platform" | "audit";

export default function App(): JSX.Element {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [view, setView] = useState<ViewId>("dashboard");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.authStatus().then(setStatus).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "无法连接 API。"));
  }, []);

  async function logout(): Promise<void> {
    await api.logout();
    setStatus({ setupRequired: false, user: null });
  }

  function authenticated(user: AuthUser): void {
    setStatus({ setupRequired: false, user });
  }

  if (error) {
    return <main className="login-screen"><div className="login-panel"><h1>连接失败</h1><div className="form-error">{error}</div></div></main>;
  }

  if (!status) {
    return <main className="login-screen"><div className="loader">LXPanel</div></main>;
  }

  if (!status.user) {
    return <LoginPanel setupRequired={status.setupRequired} onAuthenticated={authenticated} />;
  }

  return (
    <Shell user={status.user} activeView={view} onNavigate={setView} onLogout={() => void logout()}>
      {renderView(view)}
    </Shell>
  );
}

function renderView(view: ViewId): JSX.Element {
  switch (view) {
    case "hosts": return <HostsPage />;
    case "monitoring": return <MonitoringPage />;
    case "processes": return <ProcessesPage />;
    case "services": return <ServicesPage />;
    case "docker": return <DockerPage />;
    case "apps": return <AppsPage />;
    case "databases": return <DatabasesPage />;
    case "files": return <FilesPage />;
    case "logs": return <LogsPage />;
    case "connectors": return <ConnectorsPage />;
    case "tasks": return <TasksPage />;
    case "alerts": return <AlertsPage />;
    case "notifications": return <NotificationsPage />;
    case "approvals": return <ApprovalsPage />;
    case "users": return <UsersPage />;
    case "backups": return <BackupsPage />;
    case "security": return <SecurityPage />;
    case "platform": return <PlatformPage />;
    case "audit": return <AuditPage />;
    case "dashboard":
    default: return <DashboardPage />;
  }
}
