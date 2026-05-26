import { useEffect, useMemo, useState } from "react";
import { History, Play, RotateCw, Square, UploadCloud } from "lucide-react";
import type { AppDeployment, AppDeploymentAction, AppTemplate } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { StatusPill } from "../components/StatusPill.js";
import { formatDate } from "../utils/format.js";

export function AppsPage(): JSX.Element {
  const [templates, setTemplates] = useState<AppTemplate[]>([]);
  const [deployments, setDeployments] = useState<AppDeployment[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  const [autoStart, setAutoStart] = useState(false);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const selectedTemplate = useMemo(() => templates.find((template) => template.id === templateId), [templateId, templates]);

  async function load(): Promise<void> {
    try {
      const [templateResponse, deploymentResponse] = await Promise.all([api.appTemplates(), api.appDeployments()]);
      setTemplates(templateResponse.templates);
      setDeployments(deploymentResponse.deployments);
      const firstTemplate = templateResponse.templates[0];
      if (!templateId && firstTemplate) {
        setTemplateId(firstTemplate.id);
        setVariables(defaultVariables(firstTemplate));
      }
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败。");
    }
  }

  function selectTemplate(nextTemplateId: string): void {
    const template = templates.find((item) => item.id === nextTemplateId);
    setTemplateId(nextTemplateId);
    setVariables(template ? defaultVariables(template) : {});
  }

  async function deploy(): Promise<void> {
    try {
      await api.createAppDeployment({ templateId, name, variables, autoStart });
      setName("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "部署失败。");
    }
  }

  async function action(deploymentId: string, actionName: AppDeploymentAction["action"]): Promise<void> {
    try {
      await api.runAppDeploymentAction({ deploymentId, action: actionName });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "操作失败。");
    }
  }

  async function upgrade(deployment: AppDeployment): Promise<void> {
    try {
      await api.updateAppDeployment({ deploymentId: deployment.id, variables: deployment.variables, autoRestart: false });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "升级失败。");
    }
  }

  async function rollback(deployment: AppDeployment): Promise<void> {
    try {
      await api.rollbackAppDeployment({ deploymentId: deployment.id, autoRestart: false });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "回滚失败。");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading"><div><h1>应用商店</h1><p>基于受控 Docker Compose 模板部署应用</p></div></div>
      {error ? <div className="form-error">{error}</div> : null}
      <section className="table-panel">
        <div className="panel-title">一键部署</div>
        <div className="inline-form wrap">
          <select value={templateId} onChange={(event) => selectTemplate(event.target.value)}>
            {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="部署名称，例如 redis-prod" />
          <label className="compact-check"><input type="checkbox" checked={autoStart} onChange={(event) => setAutoStart(event.target.checked)} /> 自动启动</label>
          <button type="button" onClick={() => void deploy()}><UploadCloud size={16} /> 部署</button>
        </div>
        {selectedTemplate ? <p className="muted-text">{selectedTemplate.description}</p> : null}
        {selectedTemplate ? <div className="variable-grid">{selectedTemplate.variables.map((variable) => (
          <label key={variable.key}>{variable.label}<input value={variables[variable.key] ?? variable.defaultValue} onChange={(event) => setVariables((current) => ({ ...current, [variable.key]: event.target.value }))} /></label>
        ))}</div> : null}
      </section>
      <section className="table-panel">
        <div className="panel-title">部署记录</div>
        <table>
          <thead><tr><th>名称</th><th>模板</th><th>版本</th><th>状态</th><th>Compose</th><th>创建人</th><th>最近操作</th><th>输出</th><th>操作</th></tr></thead>
          <tbody>{deployments.map((deployment) => (
            <tr key={deployment.id}>
              <td>{deployment.name}</td>
              <td>{deployment.templateName}</td>
              <td>v{deployment.version} / {deployment.revisionCount}</td>
              <td><StatusPill status={deployment.status} /></td>
              <td><code className="inline-code">{deployment.composePath}</code></td>
              <td>{deployment.createdBy}</td>
              <td>{deployment.lastActionAt ? formatDate(deployment.lastActionAt) : "-"}</td>
              <td><pre className="inline-log">{deployment.lastOutputTail ?? "-"}</pre></td>
              <td className="row-actions"><button onClick={() => void action(deployment.id, "up")} title="启动"><Play size={14} /></button><button onClick={() => void action(deployment.id, "restart")} title="重启"><RotateCw size={14} /></button><button onClick={() => void action(deployment.id, "down")} title="停止"><Square size={14} /></button><button onClick={() => void upgrade(deployment)} title="升级"><UploadCloud size={14} /></button><button onClick={() => void rollback(deployment)} title="回滚" disabled={deployment.revisionCount === 0}><History size={14} /></button></td>
            </tr>
          ))}</tbody>
        </table>
      </section>
    </main>
  );
}

function defaultVariables(template: AppTemplate): Record<string, string> {
  return Object.fromEntries(template.variables.map((variable) => [variable.key, variable.defaultValue]));
}
