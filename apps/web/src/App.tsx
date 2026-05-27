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
import { canAccessView, navItems, type ViewId } from "./navigation.js";

const viewStorageKey = "lxpanel.activeView";

export default function App(): JSX.Element {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [view, setView] = useState<ViewId>(() => readStoredView());
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

  function navigate(nextView: ViewId): void {
    setView(nextView);
    window.localStorage.setItem(viewStorageKey, nextView);
  }

  useEffect(() => {
    if (status?.user && !canAccessView(status.user, view)) {
      navigate("dashboard");
    }
  }, [status, view]);

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
    <Shell user={status.user} activeView={view} onNavigate={navigate} onLogout={() => void logout()}>
      {renderView(view, navigate, status.user)}
    </Shell>
  );
}

function renderView(view: ViewId, navigate: (view: ViewId) => void, user: AuthUser): JSX.Element {
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
    default: return <DashboardPage user={user} onNavigate={navigate} />;
  }
}

function readStoredView(): ViewId {
  const storedView = window.localStorage.getItem(viewStorageKey);
  return isViewId(storedView) ? storedView : "dashboard";
}

function isViewId(value: string | null): value is ViewId {
  return navItems.some((item) => item.id === value);
}
