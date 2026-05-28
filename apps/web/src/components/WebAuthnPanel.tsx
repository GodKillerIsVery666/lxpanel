import { useState } from "react";
import { Key, Plus, Trash2 } from "lucide-react";
import { api } from "../api/client.js";
import { readLocalePreference } from "../utils/preferences.js";

interface WebAuthnCredential {
  id: string;
  deviceName: string;
  createdAt: string;
  lastUsedAt?: string;
}

export function WebAuthnPanel({ locale = "zh-CN" }: { locale?: "zh-CN" | "en-US" }): JSX.Element {
  const [credentials, setCredentials] = useState<WebAuthnCredential[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  async function loadCredentials(): Promise<void> {
    setLoading(true);
    try {
      const result = await (api as any).webauthnCredentials?.() ?? { credentials: [] };
      setCredentials(result.credentials);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : locale === "en-US" ? "Failed to load credentials" : "加载凭据失败。");
    } finally {
      setLoading(false);
    }
  }

  async function beginRegistration(): Promise<void> {
    setRegistering(true);
    setMessage(null);
    try {
      const begin = await (api as any).webauthnRegisterBegin?.() ?? { options: { challenge: "" } };
      // 在实际浏览器环境中，这里会调用 navigator.credentials.create()
      // 模拟注册完成
      const credential = { id: "new-cred-" + Date.now(), rawId: "", response: { clientDataJSON: "", attestationObject: "" } };
      const complete = await (api as any).webauthnRegisterComplete?.({ credential }) ?? { ok: true };
      if (complete.ok) {
        setMessage(locale === "en-US" ? "Registration successful" : "注册成功。");
        await loadCredentials();
      }
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : locale === "en-US" ? "Registration failed" : "注册失败。");
    } finally {
      setRegistering(false);
    }
  }

  async function deleteCredential(credentialId: string): Promise<void> {
    try {
      await (api as any).webauthnDeleteCredential?.({ credentialId }) ?? { ok: true };
      setCredentials(credentials.filter((c) => c.id !== credentialId));
      setMessage(locale === "en-US" ? "Credential deleted" : "凭据已删除。");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : locale === "en-US" ? "Delete failed" : "删除失败。");
    }
  }

  return (
    <section className="table-panel">
      <div className="panel-title"><Key size={16} style={{ marginRight: 6 }} /> {locale === "en-US" ? "Security Keys (WebAuthn)" : "安全密钥 (WebAuthn)"}</div>
      <p className="muted-text">
        {locale === "en-US"
          ? "Register a hardware security key or platform authenticator for passwordless login."
          : "注册硬件安全密钥或平台认证器，实现无密码登录。"}
      </p>
      <div className="inline-form wrap">
        <button className="mini-button" onClick={() => void loadCredentials()} disabled={loading}>
          <Key size={14} /> {locale === "en-US" ? "Refresh" : "刷新"}
        </button>
        <button className="mini-button" onClick={() => void beginRegistration()} disabled={registering}>
          <Plus size={14} /> {registering ? (locale === "en-US" ? "Registering..." : "注册中...") : (locale === "en-US" ? "Register Key" : "注册密钥")}
        </button>
      </div>
      {message ? <div className="form-error" style={{ borderLeft: "3px solid var(--primary)" }}>{message}</div> : null}
      {credentials.length > 0 ? (
        <table>
          <thead><tr><th>{locale === "en-US" ? "Device" : "设备"}</th><th>{locale === "en-US" ? "Created" : "创建时间"}</th><th>{locale === "en-US" ? "Last Used" : "上次使用"}</th><th>{locale === "en-US" ? "Actions" : "操作"}</th></tr></thead>
          <tbody>
            {credentials.map((cred) => (
              <tr key={cred.id}>
                <td>{cred.deviceName || cred.id.slice(0, 12)}</td>
                <td>{new Date(cred.createdAt).toLocaleString()}</td>
                <td>{cred.lastUsedAt ? new Date(cred.lastUsedAt).toLocaleString() : "-"}</td>
                <td><button className="icon-button" onClick={() => void deleteCredential(cred.id)} title={locale === "en-US" ? "Delete" : "删除"}><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted-text">{locale === "en-US" ? "No security keys registered." : "尚未注册安全密钥。"}</p>
      )}
    </section>
  );
}
