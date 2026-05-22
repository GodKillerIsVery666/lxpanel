import { useState, type FormEvent } from "react";
import { LockKeyhole, LogIn } from "lucide-react";
import { api, type AuthUser } from "../api/client.js";

interface LoginPanelProps {
  setupRequired: boolean;
  onAuthenticated: (user: AuthUser) => void;
}

export function LoginPanel({ setupRequired, onAuthenticated }: LoginPanelProps): JSX.Element {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = setupRequired
        ? await api.setup({ username, password })
        : await api.login({ username, password });
      onAuthenticated(response.user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登录失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <form className="login-panel" onSubmit={(event) => void submit(event)}>
        <div className="brand-mark"><LockKeyhole size={22} /> LXPanel</div>
        <h1>{setupRequired ? "初始化管理员" : "登录面板"}</h1>
        <label>
          用户名
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </label>
        <label>
          密码
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={setupRequired ? "new-password" : "current-password"} minLength={8} />
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <button className="primary-button" type="submit" disabled={busy}>
          <LogIn size={18} /> {busy ? "处理中" : setupRequired ? "完成初始化" : "进入面板"}
        </button>
      </form>
    </main>
  );
}
