import { useState } from "react";
import { Shield, Globe, Lock, Eye } from "lucide-react";
import { api } from "../api/client.js";

export function SecuritySettingsPanel(): JSX.Element {
  const [activeTab, setActiveTab] = useState<"rate-limit" | "ip-whitelist" | "audit-encrypt">("rate-limit");
  const [rateLimit, setRateLimit] = useState({ max: 300, window: "1 minute" });
  const [ipWhitelist, setIpWhitelist] = useState<string[]>([]);
  const [newIp, setNewIp] = useState("");
  const [auditEncryption, setAuditEncryption] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveRateLimit(): Promise<void> {
    setSaving(true);
    try {
      await (api as any).updateSecuritySettings?.({ rateLimit });
      setMessage("速率限制已更新。");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  }

  async function saveIpWhitelist(): Promise<void> {
    setSaving(true);
    try {
      await (api as any).updateIpWhitelist?.({ ips: ipWhitelist });
      setMessage("IP 白名单已更新。");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAuditEncryption(): Promise<void> {
    setSaving(true);
    try {
      const newValue = !auditEncryption;
      await (api as any).updateAuditEncryption?.({ enabled: newValue });
      setAuditEncryption(newValue);
      setMessage(newValue ? "审计日志加密已启用。" : "审计日志加密已禁用。");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "操作失败。");
    } finally {
      setSaving(false);
    }
  }

  const tabs = [
    { id: "rate-limit" as const, label: "速率限制", icon: Shield },
    { id: "ip-whitelist" as const, label: "IP 白名单", icon: Globe },
    { id: "audit-encrypt" as const, label: "审计加密", icon: Lock }
  ];

  return (
    <section className="table-panel">
      <div className="panel-title"><Eye size={16} style={{ marginRight: 6 }} /> 安全设置</div>
      <div className="step-track" style={{ marginBottom: 16 }}>
        {tabs.map((tab) => (
          <button key={tab.id} type="button" className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
            <tab.icon size={18} />
            <strong>{tab.label}</strong>
          </button>
        ))}
      </div>

      {message ? <div className="form-error" style={{ borderLeft: "3px solid var(--primary)" }}>{message}</div> : null}

      {activeTab === "rate-limit" && (
        <div>
          <p className="muted-text">配置 API 速率限制，防止暴力破解和滥用。</p>
          <label>最大请求数/时间窗口
            <input type="number" value={rateLimit.max} onChange={(e) => setRateLimit({ ...rateLimit, max: Number(e.target.value) })} />
          </label>
          <label>时间窗口
            <select value={rateLimit.window} onChange={(e) => setRateLimit({ ...rateLimit, window: e.target.value })}>
              <option value="1 minute">每分钟</option>
              <option value="5 minutes">每5分钟</option>
              <option value="1 hour">每小时</option>
            </select>
          </label>
          <button className="mini-button" onClick={() => void saveRateLimit()} disabled={saving}><Shield size={14} /> 保存</button>
        </div>
      )}

      {activeTab === "ip-whitelist" && (
        <div>
          <p className="muted-text">管理允许访问面板的 IP 地址列表（留空表示不限制）。</p>
          <div className="inline-form wrap">
            <input value={newIp} onChange={(e) => setNewIp(e.target.value)} placeholder="例如 192.168.1.0/24" />
            <button className="mini-button" onClick={() => { if (newIp.trim()) { setIpWhitelist([...ipWhitelist, newIp.trim()]); setNewIp(""); } }}>添加</button>
          </div>
          {ipWhitelist.length > 0 ? (
            <div className="root-chips">
              {ipWhitelist.map((ip, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", borderRadius: 999, padding: "4px 10px", fontSize: 13 }}>
                  {ip}
                  <button style={{ border: 0, background: "none", cursor: "pointer", color: "var(--muted)" }} onClick={() => setIpWhitelist(ipWhitelist.filter((_, j) => j !== i))}>×</button>
                </span>
              ))}
            </div>
          ) : (
            <p className="muted-text">当前未设置 IP 白名单。</p>
          )}
          <button className="mini-button" style={{ marginTop: 8 }} onClick={() => void saveIpWhitelist()} disabled={saving}><Globe size={14} /> 保存白名单</button>
        </div>
      )}

      {activeTab === "audit-encrypt" && (
        <div>
          <p className="muted-text">审计日志加密选项：启用后新写入的审计事件将使用服务器密钥加密存储。</p>
          <div className="inline-form wrap">
            <span className={`status-pill ${auditEncryption ? "good" : "muted"}`}>{auditEncryption ? "已启用" : "已禁用"}</span>
            <button className="mini-button" onClick={() => void toggleAuditEncryption()} disabled={saving}>
              <Lock size={14} /> {auditEncryption ? "禁用加密" : "启用加密"}
            </button>
          </div>
          <p className="muted-text" style={{ marginTop: 8 }}>注意：加密仅影响新事件，已有历史事件保持不变。</p>
        </div>
      )}
    </section>
  );
}
