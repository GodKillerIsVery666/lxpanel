import { useEffect, useState } from "react";
import { Database, Save, Trash2 } from "lucide-react";
import type { DatabaseConnection } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { StatusPill } from "../components/StatusPill.js";
import { formatDate } from "../utils/format.js";

export function DatabasesPage(): JSX.Element {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function load(): Promise<void> {
    try {
      const response = await api.databaseConnections();
      setConnections(response.connections);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败。");
    }
  }

  async function create(): Promise<void> {
    try {
      await api.createDatabaseConnection({ name, type: "postgres", url, enabled: true });
      setName("");
      setUrl("");
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

  async function backup(connection: DatabaseConnection): Promise<void> {
    try {
      const response = await api.backupDatabaseConnection(connection.id);
      setResult(response.result.status === "success" ? `备份完成：${response.result.filePath}` : `备份失败：${response.result.error ?? "unknown"}`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "备份失败。");
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
      <div className="page-heading"><div><h1>数据库</h1><p>PostgreSQL 连接登记和受控备份入口</p></div></div>
      {error ? <div className="form-error">{error}</div> : null}
      {result ? <p className="notice">{result}</p> : null}
      <section className="table-panel">
        <div className="panel-title">新增连接</div>
        <div className="inline-form wrap">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="连接名称" />
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="postgres://user:password@host:5432/db" />
          <button type="button" onClick={() => void create()}><Database size={16} /> 添加</button>
        </div>
      </section>
      <section className="table-panel">
        <div className="panel-title">连接列表</div>
        <table>
          <thead><tr><th>名称</th><th>类型</th><th>状态</th><th>地址</th><th>最近备份</th><th>结果</th><th>操作</th></tr></thead>
          <tbody>{connections.map((connection) => (
            <tr key={connection.id}>
              <td>{connection.name}</td>
              <td>{connection.type}</td>
              <td><StatusPill status={connection.enabled ? "active" : "inactive"} /></td>
              <td><code className="inline-code">{connection.maskedUrl}</code></td>
              <td>{connection.lastBackupAt ? formatDate(connection.lastBackupAt) : "-"}</td>
              <td>{connection.lastStatus ? <StatusPill status={connection.lastStatus} /> : "-"}</td>
              <td className="row-actions"><button onClick={() => void backup(connection)} title="备份"><Save size={14} /></button><button onClick={() => void toggle(connection)}>{connection.enabled ? "停用" : "启用"}</button><button onClick={() => void remove(connection.id)} title="删除"><Trash2 size={14} /></button></td>
            </tr>
          ))}</tbody>
        </table>
      </section>
    </main>
  );
}
