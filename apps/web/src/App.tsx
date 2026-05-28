import { lazy, Suspense, useEffect, useState } from "react";
import { api, type AuthStatus, type AuthUser } from "./api/client.js";
import { LoginPanel } from "./components/LoginPanel.js";
import { Shell } from "./components/Shell.js";
import { canAccessView, type ViewId } from "./navigation.js";
import { readActiveViewPreference, saveActiveViewPreference } from "./utils/preferences.js";

// 路由级代码分割 - 每个页面独立懒加载
const ApprovalsPage = lazy(() => import("./pages/ApprovalsPage.js").then((m) => ({ default: m.ApprovalsPage })));
const AuditPage = lazy(() => import("./pages/AuditPage.js").then((m) => ({ default: m.AuditPage })));
const AlertsPage = lazy(() => import("./pages/AlertsPage.js").then((m) => ({ default: m.AlertsPage })));
const AppsPage = lazy(() => import("./pages/AppsPage.js").then((m) => ({ default: m.AppsPage })));
const BackupsPage = lazy(() => import("./pages/BackupsPage.js").then((m) => ({ default: m.BackupsPage })));
const ConnectorsPage = lazy(() => import("./pages/ConnectorsPage.js").then((m) => ({ default: m.ConnectorsPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage.js").then((m) => ({ default: m.DashboardPage })));
const DatabasesPage = lazy(() => import("./pages/DatabasesPage.js").then((m) => ({ default: m.DatabasesPage })));
const DockerPage = lazy(() => import("./pages/DockerPage.js").then((m) => ({ default: m.DockerPage })));
const FilesPage = lazy(() => import("./pages/FilesPage.js").then((m) => ({ default: m.FilesPage })));
const HostsPage = lazy(() => import("./pages/HostsPage.js").then((m) => ({ default: m.HostsPage })));
const LogsPage = lazy(() => import("./pages/LogsPage.js").then((m) => ({ default: m.LogsPage })));
const MonitoringPage = lazy(() => import("./pages/MonitoringPage.js").then((m) => ({ default: m.MonitoringPage })));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage.js").then((m) => ({ default: m.NotificationsPage })));
const PlatformPage = lazy(() => import("./pages/PlatformPage.js").then((m) => ({ default: m.PlatformPage })));
const ProcessesPage = lazy(() => import("./pages/ProcessesPage.js").then((m) => ({ default: m.ProcessesPage })));
const SecurityPage = lazy(() => import("./pages/SecurityPage.js").then((m) => ({ default: m.SecurityPage })));
const ServicesPage = lazy(() => import("./pages/ServicesPage.js").then((m) => ({ default: m.ServicesPage })));
const TasksPage = lazy(() => import("./pages/TasksPage.js").then((m) => ({ default: m.TasksPage })));
const UsersPage = lazy(() => import("./pages/UsersPage.js").then((m) => ({ default: m.UsersPage })));
const MigrationPage = lazy(() => import("./pages/MigrationPage.js").then((m) => ({ default: m.MigrationPage })));

export default function App(): JSX.Element {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [view, setView] = useState<ViewId>(() => readActiveViewPreference());
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
    saveActiveViewPreference(nextView);
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
      <Suspense fallback={<div className="page-stack"><div className="loader">加载中...</div></div>}>
        {renderView(view, navigate, status.user)}
      </Suspense>
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
    case "migration": return <MigrationPage />;
    case "dashboard":
    default: return <DashboardPage user={user} onNavigate={navigate} />;
  }
}
