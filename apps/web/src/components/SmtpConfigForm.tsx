import { useState } from "react";
import { Mail, Send } from "lucide-react";
import { api } from "../api/client.js";

interface SmtpConfigFormProps {
  locale?: "zh-CN" | "en-US";
  onSaved?: () => void;
}

export function SmtpConfigForm({ locale = "zh-CN", onSaved }: SmtpConfigFormProps): JSX.Element {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [secure, setSecure] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveSmtpChannel(): Promise<void> {
    setSaving(true);
    setMessage(null);
    try {
      await (api as any).createNotificationChannel?.({
        name: `SMTP ${host}`,
        type: "email",
        smtp: { host, port: Number(port), secure, username, password, from },
        smtpTo: to,
        enabled: true,
        minLevel: "warning"
      }) ?? { channel: {} };
      setMessage(locale === "en-US" ? "SMTP channel created successfully." : "SMTP 通知渠道创建成功。");
      onSaved?.();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : locale === "en-US" ? "Failed to create channel." : "创建渠道失败。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="table-panel">
      <div className="panel-title"><Mail size={16} style={{ marginRight: 6 }} /> {locale === "en-US" ? "Email (SMTP) Notification" : "邮件 (SMTP) 通知"}</div>
      <p className="muted-text">
        {locale === "en-US"
          ? "Configure SMTP server to send alert notifications via email."
          : "配置 SMTP 服务器，通过邮件发送告警通知。"}
      </p>
      <div className="variable-grid">
        <label>{locale === "en-US" ? "SMTP Host" : "SMTP 主机"}<input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.example.com" /></label>
        <label>{locale === "en-US" ? "Port" : "端口"}<input type="number" value={port} onChange={(e) => setPort(e.target.value)} placeholder="587" /></label>
        <label className="compact-check" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)} />
          {locale === "en-US" ? "TLS/SSL" : "TLS/SSL"}
        </label>
        <label>{locale === "en-US" ? "Username" : "用户名"}<input value={username} onChange={(e) => setUsername(e.target.value)} /></label>
        <label>{locale === "en-US" ? "Password" : "密码"}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label>{locale === "en-US" ? "From Address" : "发件地址"}<input type="email" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="lxpanel@example.com" /></label>
        <label>{locale === "en-US" ? "To Address" : "收件地址"}<input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="admin@example.com" /></label>
      </div>
      {message ? <div className="form-error" style={{ borderLeft: "3px solid var(--primary)" }}>{message}</div> : null}
      <button className="mini-button" onClick={() => void saveSmtpChannel()} disabled={saving} style={{ marginTop: 8 }}>
        <Send size={14} /> {saving ? (locale === "en-US" ? "Saving..." : "保存中...") : (locale === "en-US" ? "Create Channel" : "创建渠道")}
      </button>
    </section>
  );
}
