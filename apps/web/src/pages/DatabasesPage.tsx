import { useEffect, useMemo, useState } from "react";
import { Database, RotateCw, Save, Trash2 } from "lucide-react";
import type { DatabaseConnection, DatabaseType } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { EmptyState } from "../components/EmptyState.js";
import { StepWizard, type WizardStep } from "../components/StepWizard.js";
import { StatusPill } from "../components/StatusPill.js";
import { formatDate } from "../utils/format.js";
import { readDefaultWorkspacePreference } from "../utils/preferences.js";

export function DatabasesPage(): JSX.Element {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [workspace] = useState(() => readDefaultWorkspacePreference());
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
  const wizardSteps: WizardStep[] = [
    {
      id: "identity",
      title: "基础信息",
      detail: "先确认连接名称和数据库类型。",
      content: <div className="inline-form wrap"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="连接名称" /><select value={type} onChange={(event) => setType(event.target.value as DatabaseType)}><option value="postgres">PostgreSQL</option><option value="mysql">MySQL</option><option value="mariadb">MariaDB</option></select><button type="button" onClick={() => setFormStep(1)}>下一步</button></div>
    },
    {
      id: "url",
      title: "连接地址",
      detail: "URL 会在后端按配置加密或隐藏密码后展示。",
      content: <div className="inline-form wrap"><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder={type === "postgres" ? "postgres://user:password@host:5432/db" : "mysql://user:password@host:3306/db"} /><button type="button" onClick={() => setFormStep(0)}>上一步</button><button type="button" onClick={() => setFormStep(2)}>下一步</button></div>
    },
    {
      id: "policy",
      title: "备份策略",
      detail: "设置保留周期和计划备份间隔。",
      content: <div className="inline-form wrap"><input value={retentionDays} onChange={(event) => setRetentionDays(event.target.value)} inputMode="numeric" placeholder="保留天数" /><label className="compact-check"><input type="checkbox" checked={scheduleEnabled} onChange={(event) => setScheduleEnabled(event.target.checked)} /> 计划</label><input value={scheduleEveryHours} onChange={(event) => setScheduleEveryHours(event.target.value)} inputMode="numeric" placeholder="间隔小时" /><button type="button" onClick={() => setFormStep(1)}>上一步</button><button type="button" onClick={() => void create()}><Database size={16} /> 添加</button></div>
    }
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
      setResult(response.result.status === "success" ? `备份完成：${response.result.filePath}` : `备份失败：${response.result.error ?? "unknown"}`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "备份失败。");
    }
  }

  async function restoreDrill(connection: DatabaseConnection): Promise<void> {
    try {
      const response = await api.drillDatabaseRestore(connection.id);
      setResult(response.result.status === "success" ? `恢复演练通过：${response.result.backupPath ?? "-"}` : `恢复演练${response.result.status}：${response.result.error ?? response.result.outputTail ?? "-"}`);
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
      <div className="page-heading"><div><h1>数据库</h1><p>多引擎连接登记、受控备份和恢复演练</p></div></div>
      {error ? <div className="form-error">{error}</div> : null}
      {result ? <p className="notice">{result}</p> : null}
      <section className="table-panel">
        <div className="panel-title">新增连接</div>
        <StepWizard steps={wizardSteps} activeStep={formStep} onStepChange={setFormStep} />
      </section>
      <section className="table-panel">
        <div className="panel-title">连接列表</div>
        <div className="list-toolbar"><input value={connectionSearch} onChange={(event) => setConnectionSearch(event.target.value)} placeholder="搜索名称、类型、地址、状态或工作空间" /><p className="muted-text">{filteredConnections.length} / {connections.length}</p></div>
        {filteredConnections.length === 0 ? <EmptyState title="没有匹配的数据库连接" description="新增连接后可执行备份、恢复演练和计划任务。" /> : <table>
          <thead><tr><th>名称</th><th>类型</th><th>状态</th><th>地址</th><th>保留</th><th>计划</th><th>最近备份</th><th>恢复演练</th><th>结果</th><th>操作</th></tr></thead>
          <tbody>{filteredConnections.map((connection) => (
            <tr key={connection.id}>
              <td>{connection.name}</td>
              <td>{connection.type}</td>
              <td><StatusPill status={connection.enabled ? "active" : "inactive"} /></td>
              <td><code className="inline-code">{connection.maskedUrl}</code></td>
              <td>{connection.backupRetentionDays} 天</td>
              <td>{connection.scheduleEnabled ? `${connection.scheduleEveryHours}h / ${connection.nextBackupAt ? formatDate(connection.nextBackupAt) : "待调度"}` : "关闭"}</td>
              <td>{connection.lastBackupAt ? formatDate(connection.lastBackupAt) : "-"}</td>
              <td>{connection.lastRestoreDrillAt ? `${connection.lastRestoreDrillStatus ?? "-"} / ${formatDate(connection.lastRestoreDrillAt)}` : "-"}</td>
              <td>{connection.lastStatus ? <StatusPill status={connection.lastStatus} /> : "-"}</td>
              <td className="row-actions"><button onClick={() => void backup(connection)} title="备份"><Save size={14} /></button><button onClick={() => void restoreDrill(connection)} title="恢复演练"><RotateCw size={14} /></button><button onClick={() => void toggleSchedule(connection)}>{connection.scheduleEnabled ? "停计划" : "计划"}</button><button onClick={() => void toggle(connection)}>{connection.enabled ? "停用" : "启用"}</button><button onClick={() => void remove(connection.id)} title="删除"><Trash2 size={14} /></button></td>
            </tr>
          ))}</tbody>
        </table>}
      </section>
    </main>
  );
}
