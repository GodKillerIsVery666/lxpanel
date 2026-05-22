import { useEffect, useState } from "react";
import { Archive, RotateCw } from "lucide-react";
import type { BackupSnapshot } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { formatBytes, formatDate } from "../utils/format.js";

export function BackupsPage(): JSX.Element {
  const [backups, setBackups] = useState<BackupSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    try {
      setBackups((await api.backups()).backups);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败。");
    }
  }

  async function create(): Promise<void> {
    try {
      await api.createBackup();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建失败。");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading"><div><h1>备份</h1><p>本地状态快照</p></div><div className="row-actions"><button className="ghost-button" onClick={() => void create()}><Archive size={16} /> 创建</button><button className="icon-button" onClick={() => void load()} title="刷新"><RotateCw size={18} /></button></div></div>
      {error ? <div className="form-error">{error}</div> : null}
      <section className="table-panel"><table><thead><tr><th>文件</th><th>大小</th><th>创建者</th><th>时间</th><th>路径</th></tr></thead><tbody>{backups.map((backup) => <tr key={backup.id}><td>{backup.fileName}</td><td>{formatBytes(backup.sizeBytes)}</td><td>{backup.createdBy}</td><td>{formatDate(backup.createdAt)}</td><td><code>{backup.path}</code></td></tr>)}</tbody></table></section>
    </main>
  );
}
