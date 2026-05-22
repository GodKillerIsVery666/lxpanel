import { useEffect, useState } from "react";
import { api, type AuthStatus, type AuthUser } from "./api/client.js";
import { LoginPanel } from "./components/LoginPanel.js";
import { Shell } from "./components/Shell.js";
import { AuditPage } from "./pages/AuditPage.js";
import { ConnectorsPage } from "./pages/ConnectorsPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { FilesPage } from "./pages/FilesPage.js";
import { ProcessesPage } from "./pages/ProcessesPage.js";
import { SecurityPage } from "./pages/SecurityPage.js";
import { ServicesPage } from "./pages/ServicesPage.js";

export type ViewId = "dashboard" | "processes" | "services" | "files" | "connectors" | "security" | "audit";

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
    case "processes": return <ProcessesPage />;
    case "services": return <ServicesPage />;
    case "files": return <FilesPage />;
    case "connectors": return <ConnectorsPage />;
    case "security": return <SecurityPage />;
    case "audit": return <AuditPage />;
    case "dashboard":
    default: return <DashboardPage />;
  }
}
