import { useEffect, useState } from "react";
import { Archive, Clock, PauseCircle, RotateCw } from "lucide-react";
import type { BackupSchedule, BackupSnapshot } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { formatBytes, formatDate } from "../utils/format.js";

export function BackupsPage(): JSX.Element {
  const [backups, setBackups] = useState<BackupSnapshot[]>([]);
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [everyHours, setEveryHours] = useState("24");
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    try {
      const response = await api.backups();
      setBackups(response.backups);
      setSchedule(response.schedule);
      setEveryHours(String(response.schedule.everyHours));
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

  async function updateSchedule(enabled: boolean): Promise<void> {
    try {
      const parsed = Number.parseInt(everyHours, 10);
      const response = await api.updateBackupSchedule({ enabled, everyHours: Number.isInteger(parsed) && parsed > 0 ? parsed : 24 });
      setSchedule(response.schedule);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新计划失败。");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading"><div><h1>备份</h1><p>本地状态快照</p></div><div className="row-actions"><button className="ghost-button" onClick={() => void create()}><Archive size={16} /> 创建</button><button className="icon-button" onClick={() => void load()} title="刷新"><RotateCw size={18} /></button></div></div>
      {error ? <div className="form-error">{error}</div> : null}
      <section className="table-panel">
        <div className="panel-title">自动备份</div>
        <div className="inline-form wrap"><input value={everyHours} onChange={(event) => setEveryHours(event.target.value)} type="number" min={1} max={720} placeholder="间隔小时" /><button type="button" onClick={() => void updateSchedule(true)}><Clock size={16} /> 启用</button><button type="button" onClick={() => void updateSchedule(false)}><PauseCircle size={16} /> 暂停</button></div>
        <p className="muted-text">当前：{schedule?.enabled ? `每 ${schedule.everyHours} 小时，下一次 ${schedule.nextRunAt ? formatDate(schedule.nextRunAt) : "待计算"}` : "未启用"}</p>
      </section>
      <section className="table-panel"><table><thead><tr><th>文件</th><th>大小</th><th>创建者</th><th>时间</th><th>路径</th></tr></thead><tbody>{backups.map((backup) => <tr key={backup.id}><td>{backup.fileName}</td><td>{formatBytes(backup.sizeBytes)}</td><td>{backup.createdBy}</td><td>{formatDate(backup.createdAt)}</td><td><code>{backup.path}</code></td></tr>)}</tbody></table></section>
    </main>
  );
}
