import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api } from "../api/client.js";
import { readLocalePreference } from "../utils/preferences.js";

interface CustomRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  metric: string;
  condition: string;
  threshold: number;
  level: string;
  target?: string;
  messageTemplate: string;
}

export function CustomAlertRulesPanel({ locale = "zh-CN" }: { locale?: "zh-CN" | "en-US" }): JSX.Element {
  const [rules, setRules] = useState<CustomRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Partial<CustomRule> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadRules(): Promise<void> {
    setLoading(true);
    try {
      const result = await (api as any).customAlertRules?.() ?? { rules: [] };
      setRules(result.rules);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : locale === "en-US" ? "Failed to load rules" : "加载规则失败。");
    } finally {
      setLoading(false);
    }
  }

  async function saveRule(): Promise<void> {
    if (!editing) {
      return;
    }
    setLoading(true);
    try {
      if (editing.id) {
        await (api as any).updateCustomAlertRule?.({ ruleId: editing.id, ...editing }) ?? { rule: {} };
      } else {
        await (api as any).createCustomAlertRule?.(editing) ?? { rule: {} };
      }
      setEditing(null);
      setMessage(locale === "en-US" ? "Rule saved" : "规则已保存。");
      await loadRules();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : locale === "en-US" ? "Save failed" : "保存失败。");
    } finally {
      setLoading(false);
    }
  }

  async function deleteRule(ruleId: string): Promise<void> {
    try {
      await (api as any).deleteCustomAlertRule?.({ ruleId }) ?? { ok: true };
      setRules(rules.filter((r) => r.id !== ruleId));
      setMessage(locale === "en-US" ? "Rule deleted" : "规则已删除。");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : locale === "en-US" ? "Delete failed" : "删除失败。");
    }
  }

  const text = {
    title: locale === "en-US" ? "Custom Alert Rules" : "自定义告警规则",
    desc: locale === "en-US" ? "Define custom alert rules with JSON-like conditions." : "使用 JSON 条件表达式定义自定义告警规则。",
    add: locale === "en-US" ? "Add Rule" : "添加规则",
    save: locale === "en-US" ? "Save" : "保存",
    cancel: locale === "en-US" ? "Cancel" : "取消",
    name: locale === "en-US" ? "Rule Name" : "规则名称",
    metric: locale === "en-US" ? "Metric" : "指标",
    condition: locale === "en-US" ? "Condition" : "条件",
    threshold: locale === "en-US" ? "Threshold" : "阈值",
    level: locale === "en-US" ? "Level" : "级别",
    target: locale === "en-US" ? "Target" : "目标",
    template: locale === "en-US" ? "Message Template" : "消息模板",
    empty: locale === "en-US" ? "No custom rules defined." : "暂无自定义告警规则。"
  };

  const conditions = [">", ">=", "<", "<=", "==", "!="];

  return (
    <section className="table-panel">
      <div className="panel-title">{text.title}</div>
      <p className="muted-text">{text.desc}</p>
      <div className="inline-form wrap">
        <button className="mini-button" onClick={() => void loadRules()} disabled={loading}>
          {locale === "en-US" ? "Refresh" : "刷新"}
        </button>
        <button className="mini-button" onClick={() => setEditing({ enabled: true, condition: ">", level: "warning", metric: "cpu.percent", threshold: 90, messageTemplate: "", description: "" })}>
          <Plus size={14} /> {text.add}
        </button>
      </div>
      {message ? <div className="form-error" style={{ borderLeft: "3px solid var(--primary)" }}>{message}</div> : null}

      {editing && (
        <div className="step-content" style={{ margin: "12px 0" }}>
          <div className="variable-grid">
            <label>{text.name}<input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
            <label>{text.metric}<input value={editing.metric ?? ""} onChange={(e) => setEditing({ ...editing, metric: e.target.value })} placeholder="cpu.percent" /></label>
            <label>{text.condition}
              <select value={editing.condition} onChange={(e) => setEditing({ ...editing, condition: e.target.value })}>
                {conditions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>{text.threshold}<input type="number" value={editing.threshold ?? 90} onChange={(e) => setEditing({ ...editing, threshold: Number(e.target.value) })} /></label>
            <label>{text.level}
              <select value={editing.level} onChange={(e) => setEditing({ ...editing, level: e.target.value })}>
                <option value="warning">{locale === "en-US" ? "Warning" : "警告"}</option>
                <option value="critical">{locale === "en-US" ? "Critical" : "严重"}</option>
              </select>
            </label>
            <label>{text.target}<input value={editing.target ?? ""} onChange={(e) => setEditing({ ...editing, target: e.target.value })} placeholder="system" /></label>
            <label style={{ gridColumn: "span 2" }}>{text.template}<input value={editing.messageTemplate ?? ""} onChange={(e) => setEditing({ ...editing, messageTemplate: e.target.value })} placeholder="CPU 超过 {{value}}%" /></label>
          </div>
          <div className="inline-form wrap" style={{ marginTop: 8 }}>
            <button className="mini-button" onClick={() => void saveRule()} disabled={loading}>{text.save}</button>
            <button className="mini-button" onClick={() => setEditing(null)}>{text.cancel}</button>
          </div>
        </div>
      )}

      {rules.length > 0 ? (
        <table>
          <thead><tr><th>{text.name}</th><th>{text.metric}</th><th>{text.condition}</th><th>{text.threshold}</th><th>{text.level}</th><th>{locale === "en-US" ? "Status" : "状态"}</th><th>{locale === "en-US" ? "Actions" : "操作"}</th></tr></thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.name}</td>
                <td><code>{rule.metric}</code></td>
                <td>{rule.condition}</td>
                <td>{rule.threshold}</td>
                <td><span className={`status-pill ${rule.level === "critical" ? "bad" : "warn"}`}>{rule.level}</span></td>
                <td><span className={`status-pill ${rule.enabled ? "good" : "muted"}`}>{rule.enabled ? (locale === "en-US" ? "Enabled" : "启用") : (locale === "en-US" ? "Disabled" : "禁用")}</span></td>
                <td>
                  <div className="row-actions">
                    <button className="icon-button" onClick={() => setEditing(rule)} title={locale === "en-US" ? "Edit" : "编辑"}><Pencil size={14} /></button>
                    <button className="icon-button" onClick={() => void deleteRule(rule.id)} title={locale === "en-US" ? "Delete" : "删除"}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted-text">{text.empty}</p>
      )}
    </section>
  );
}
