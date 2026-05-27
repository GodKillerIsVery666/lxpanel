import { useEffect, useMemo, useState } from "react";
import { HeartPulse, History, Play, RotateCw, Square, UploadCloud } from "lucide-react";
import type { AppDeployment, AppDeploymentAction, AppTemplate } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { EmptyState } from "../components/EmptyState.js";
import { StatusPill } from "../components/StatusPill.js";
import { VirtualTable, type VirtualColumn } from "../components/VirtualTable.js";
import { pageText } from "../i18n/resources.js";
import { formatDate } from "../utils/format.js";
import { readDefaultWorkspacePreference, readLocalePreference } from "../utils/preferences.js";

export function AppsPage(): JSX.Element {
  const [templates, setTemplates] = useState<AppTemplate[]>([]);
  const [deployments, setDeployments] = useState<AppDeployment[]>([]);
  const [locale] = useState(() => readLocalePreference());
  const [workspace] = useState(() => readDefaultWorkspacePreference());
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  const [autoStart, setAutoStart] = useState(false);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [deploymentSearch, setDeploymentSearch] = useState("");
  const [healthText, setHealthText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedTemplate = useMemo(() => templates.find((template) => template.id === templateId), [templateId, templates]);
  const filteredDeployments = useMemo(() => {
    const query = deploymentSearch.trim().toLowerCase();
    return query ? deployments.filter((deployment) => [deployment.name, deployment.templateName, deployment.status, deployment.workspace].some((value) => value.toLowerCase().includes(query))) : deployments;
  }, [deploymentSearch, deployments]);
  const text = pageText[locale].apps;
  const deploymentColumns: Array<VirtualColumn<AppDeployment>> = [
    { id: "name", header: text.columns.name, cell: (deployment) => deployment.name, sortValue: (deployment) => deployment.name },
    { id: "template", header: text.columns.template, cell: (deployment) => deployment.templateName, sortValue: (deployment) => deployment.templateName },
    { id: "version", header: text.columns.version, cell: (deployment) => `v${deployment.version} / ${deployment.revisionCount}`, sortValue: (deployment) => deployment.version },
    { id: "status", header: text.columns.status, cell: (deployment) => <StatusPill status={deployment.status} />, sortValue: (deployment) => deployment.status },
    { id: "compose", header: text.columns.compose, cell: (deployment) => <code className="inline-code">{deployment.composePath}</code> },
    { id: "creator", header: text.columns.creator, cell: (deployment) => deployment.createdBy, sortValue: (deployment) => deployment.createdBy },
    { id: "lastAction", header: text.columns.lastAction, cell: (deployment) => deployment.lastActionAt ? formatDate(deployment.lastActionAt) : "-", sortValue: (deployment) => deployment.lastActionAt },
    { id: "output", header: text.columns.output, cell: (deployment) => <pre className="inline-log">{deployment.lastOutputTail ?? "-"}</pre> },
    { id: "actions", header: text.columns.actions, className: "row-actions", cell: (deployment) => <><button onClick={() => void checkHealth(deployment)} title="health"><HeartPulse size={14} /></button><button onClick={() => void action(deployment.id, "up")} title="up"><Play size={14} /></button><button onClick={() => void action(deployment.id, "restart")} title="restart"><RotateCw size={14} /></button><button onClick={() => void action(deployment.id, "down")} title="down"><Square size={14} /></button><button onClick={() => void upgrade(deployment)} title="upgrade"><UploadCloud size={14} /></button><button onClick={() => void rollback(deployment)} title="rollback" disabled={deployment.revisionCount === 0}><History size={14} /></button></> }
  ];

  async function load(): Promise<void> {
    try {
      const [templateResponse, deploymentResponse] = await Promise.all([api.appTemplates(), api.appDeployments(workspace)]);
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
      await api.createAppDeployment({ workspace, templateId, name, variables, autoStart });
      setName("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "部署失败。");
    }
  }

  async function action(deploymentId: string, actionName: AppDeploymentAction["action"]): Promise<void> {
    try {
      await api.runAppDeploymentAction({ workspace, deploymentId, action: actionName });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "操作失败。");
    }
  }

  async function upgrade(deployment: AppDeployment): Promise<void> {
    try {
      await api.updateAppDeployment({ workspace: deployment.workspace, deploymentId: deployment.id, variables: deployment.variables, autoRestart: false });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "升级失败。");
    }
  }

  async function rollback(deployment: AppDeployment): Promise<void> {
    try {
      await api.rollbackAppDeployment({ workspace: deployment.workspace, deploymentId: deployment.id, autoRestart: false });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "回滚失败。");
    }
  }

  async function checkHealth(deployment: AppDeployment): Promise<void> {
    try {
      const response = await api.appDeploymentHealth(deployment.id);
      setHealthText(`${deployment.name}: ${response.health.status} - ${response.health.detail}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "健康检查失败。");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading"><div><h1>{text.title}</h1><p>{text.subtitle}</p></div></div>
      {error ? <div className="form-error">{error}</div> : null}
      {healthText ? <p className="notice">{healthText}</p> : null}
      <section className="table-panel">
        <div className="panel-title">{text.deploy}</div>
        {templates.length === 0 ? <EmptyState title={text.noTemplatesTitle} description={text.noTemplatesDescription} /> : <div className="inline-form wrap">
          <select value={templateId} onChange={(event) => selectTemplate(event.target.value)}>
            {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder={text.deployName} />
          <label className="compact-check"><input type="checkbox" checked={autoStart} onChange={(event) => setAutoStart(event.target.checked)} /> {text.autoStart}</label>
          <button type="button" onClick={() => void deploy()}><UploadCloud size={16} /> {text.deployAction}</button>
        </div>}
        {selectedTemplate ? <p className="muted-text">{selectedTemplate.description}; {text.source}: {selectedTemplate.source ?? "builtin"}; {text.signature}: {selectedTemplate.signature ?? "-"}; {selectedTemplate.verified ? text.verified : text.unverified}</p> : null}
        {selectedTemplate ? <div className="variable-grid">{selectedTemplate.variables.map((variable) => (
          <label key={variable.key}>{variable.label}<input value={variables[variable.key] ?? variable.defaultValue} onChange={(event) => setVariables((current) => ({ ...current, [variable.key]: event.target.value }))} /></label>
        ))}</div> : null}
      </section>
      <section className="table-panel">
        <div className="panel-title">{text.records}</div>
        <div className="list-toolbar"><input value={deploymentSearch} onChange={(event) => setDeploymentSearch(event.target.value)} placeholder={text.search} /><p className="muted-text">{filteredDeployments.length} / {deployments.length}</p></div>
        <VirtualTable tableId="app-deployments" rows={filteredDeployments} columns={deploymentColumns} getRowKey={(deployment) => deployment.id} empty={<EmptyState title={text.emptyTitle} description={text.emptyDescription} />} />
      </section>
    </main>
  );
}

function defaultVariables(template: AppTemplate): Record<string, string> {
  return Object.fromEntries(template.variables.map((variable) => [variable.key, variable.defaultValue]));
}
