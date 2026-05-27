import { useEffect, useMemo, useState } from "react";
import { Database, RotateCw, Save, Trash2 } from "lucide-react";
import type { DatabaseConnection, DatabaseType } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { EmptyState } from "../components/EmptyState.js";
import { StepWizard, type WizardStep } from "../components/StepWizard.js";
import { StatusPill } from "../components/StatusPill.js";
import { VirtualTable, type VirtualColumn } from "../components/VirtualTable.js";
import { pageText } from "../i18n/resources.js";
import { formatDate } from "../utils/format.js";
import { readDefaultWorkspacePreference, readLocalePreference } from "../utils/preferences.js";

export function DatabasesPage(): JSX.Element {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [workspace] = useState(() => readDefaultWorkspacePreference());
  const [locale] = useState(() => readLocalePreference());
  const [name, setName] = useState("");
  const [type, setType] = useState<DatabaseType>("postgres");
  const [url, setUrl] = useState("");
  const [retentionDays, setRetentionDays] = useState("30");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleEveryHours, setScheduleEveryHours] = useState("24");
  const [formStep, setFormStep] = useState(0);
  const [connectionSearch, setConnectionSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const filteredConnections = useMemo(() => {
    const query = connectionSearch.trim().toLowerCase();
    return query ? connections.filter((connection) => [connection.name, connection.type, connection.workspace, connection.maskedUrl, connection.lastStatus ?? ""].some((value) => value.toLowerCase().includes(query))) : connections;
  }, [connectionSearch, connections]);
  const text = pageText[locale].databases;
  const wizardSteps: WizardStep[] = [
    {
      id: "identity",
      title: text.identityTitle,
      detail: text.identityDetail,
      content: <div className="inline-form wrap"><input value={name} onChange={(event) => setName(event.target.value)} placeholder={text.connectionName} /><select value={type} onChange={(event) => setType(event.target.value as DatabaseType)}><option value="postgres">PostgreSQL</option><option value="mysql">MySQL</option><option value="mariadb">MariaDB</option></select><button type="button" onClick={() => setFormStep(1)}>{text.next}</button></div>
    },
    {
      id: "url",
      title: text.urlTitle,
      detail: text.urlDetail,
      content: <div className="inline-form wrap"><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder={type === "postgres" ? "postgres://user:password@host:5432/db" : "mysql://user:password@host:3306/db"} /><button type="button" onClick={() => setFormStep(0)}>{text.previous}</button><button type="button" onClick={() => setFormStep(2)}>{text.next}</button></div>
    },
    {
      id: "policy",
      title: text.policyTitle,
      detail: text.policyDetail,
      content: <div className="inline-form wrap"><input value={retentionDays} onChange={(event) => setRetentionDays(event.target.value)} inputMode="numeric" placeholder={text.retentionDays} /><label className="compact-check"><input type="checkbox" checked={scheduleEnabled} onChange={(event) => setScheduleEnabled(event.target.checked)} /> {text.schedule}</label><input value={scheduleEveryHours} onChange={(event) => setScheduleEveryHours(event.target.value)} inputMode="numeric" placeholder={text.intervalHours} /><button type="button" onClick={() => setFormStep(1)}>{text.previous}</button><button type="button" onClick={() => void create()}><Database size={16} /> {text.add}</button></div>
    }
  ];
  const columns: Array<VirtualColumn<DatabaseConnection>> = [
    { id: "name", header: text.columns.name, cell: (connection) => connection.name, sortValue: (connection) => connection.name },
    { id: "type", header: text.columns.type, cell: (connection) => connection.type, sortValue: (connection) => connection.type },
    { id: "status", header: text.columns.status, cell: (connection) => <StatusPill status={connection.enabled ? "active" : "inactive"} />, sortValue: (connection) => connection.enabled },
    { id: "url", header: text.columns.url, cell: (connection) => <code className="inline-code">{connection.maskedUrl}</code> },
    { id: "retention", header: text.columns.retention, cell: (connection) => `${connection.backupRetentionDays} ${text.days}`, sortValue: (connection) => connection.backupRetentionDays },
    { id: "schedule", header: text.columns.schedule, cell: (connection) => connection.scheduleEnabled ? `${connection.scheduleEveryHours}h / ${connection.nextBackupAt ? formatDate(connection.nextBackupAt) : text.pending}` : text.disabled, sortValue: (connection) => connection.nextBackupAt },
    { id: "backup", header: text.columns.backup, cell: (connection) => connection.lastBackupAt ? formatDate(connection.lastBackupAt) : "-", sortValue: (connection) => connection.lastBackupAt },
    { id: "drill", header: text.columns.drill, cell: (connection) => connection.lastRestoreDrillAt ? `${connection.lastRestoreDrillStatus ?? "-"} / ${formatDate(connection.lastRestoreDrillAt)}` : "-", sortValue: (connection) => connection.lastRestoreDrillAt },
    { id: "result", header: text.columns.result, cell: (connection) => connection.lastStatus ? <StatusPill status={connection.lastStatus} /> : "-", sortValue: (connection) => connection.lastStatus },
    { id: "actions", header: text.columns.actions, className: "row-actions", cell: (connection) => <><button onClick={() => void backup(connection)} title="backup"><Save size={14} /></button><button onClick={() => void restoreDrill(connection)} title="restore drill"><RotateCw size={14} /></button><button onClick={() => void toggleSchedule(connection)}>{connection.scheduleEnabled ? text.stopSchedule : text.enableSchedule}</button><button onClick={() => void toggle(connection)}>{connection.enabled ? text.disable : text.enable}</button><button onClick={() => void remove(connection.id)} title="delete"><Trash2 size={14} /></button></> }
  ];

  async function load(): Promise<void> {
    try {
      const response = await api.databaseConnections(workspace);
      setConnections(response.connections);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败。");
    }
  }

  async function create(): Promise<void> {
    try {
      await api.createDatabaseConnection({ workspace, name, type, url, enabled: true, backupRetentionDays: Number.parseInt(retentionDays, 10) || 30, scheduleEnabled, scheduleEveryHours: Number.parseInt(scheduleEveryHours, 10) || 24 });
      setName("");
      setUrl("");
      setFormStep(0);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建失败。");
    }
  }

  async function toggle(connection: DatabaseConnection): Promise<void> {
    try {
      await api.updateDatabaseConnection({ connectionId: connection.id, enabled: !connection.enabled });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新失败。");
    }
  }

  async function toggleSchedule(connection: DatabaseConnection): Promise<void> {
    try {
      await api.updateDatabaseConnection({ connectionId: connection.id, scheduleEnabled: !connection.scheduleEnabled, scheduleEveryHours: connection.scheduleEveryHours });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新计划失败。");
    }
  }

  async function backup(connection: DatabaseConnection): Promise<void> {
    try {
      const response = await api.backupDatabaseConnection(connection.id);
      setResult(response.result.status === "success" ? `${text.backupDone}: ${response.result.filePath}` : `${text.backupFailed}: ${response.result.error ?? "unknown"}`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "备份失败。");
    }
  }

  async function restoreDrill(connection: DatabaseConnection): Promise<void> {
    try {
      const response = await api.drillDatabaseRestore(connection.id);
      setResult(response.result.status === "success" ? `${text.drillPassed}: ${response.result.backupPath ?? "-"}` : `${text.drillFailed} ${response.result.status}: ${response.result.error ?? response.result.outputTail ?? "-"}`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "恢复演练失败。");
    }
  }

  async function remove(connectionId: string): Promise<void> {
    try {
      await api.deleteDatabaseConnection(connectionId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "删除失败。");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading"><div><h1>{text.title}</h1><p>{text.subtitle}</p></div></div>
      {error ? <div className="form-error">{error}</div> : null}
      {result ? <p className="notice">{result}</p> : null}
      <section className="table-panel">
        <div className="panel-title">{text.add}</div>
        <StepWizard steps={wizardSteps} activeStep={formStep} onStepChange={setFormStep} />
      </section>
      <section className="table-panel">
        <div className="panel-title">{text.list}</div>
        <div className="list-toolbar"><input value={connectionSearch} onChange={(event) => setConnectionSearch(event.target.value)} placeholder={text.search} /><p className="muted-text">{filteredConnections.length} / {connections.length}</p></div>
        <VirtualTable tableId="database-connections" rows={filteredConnections} columns={columns} getRowKey={(connection) => connection.id} empty={<EmptyState title={text.emptyTitle} description={text.emptyDescription} />} />
      </section>
    </main>
  );
}
