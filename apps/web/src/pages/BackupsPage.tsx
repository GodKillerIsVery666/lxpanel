import { useEffect, useMemo, useState } from "react";
import { Archive, Clock, Download, PauseCircle, RotateCw, ShieldCheck, Undo2, UploadCloud } from "lucide-react";
import type { BackupSchedule, BackupSnapshot, BackupVerification, RemoteBackupTarget } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { EmptyState } from "../components/EmptyState.js";
import { VirtualTable, type VirtualColumn } from "../components/VirtualTable.js";
import { pageText } from "../i18n/resources.js";
import { formatBytes, formatDate } from "../utils/format.js";
import { readDefaultWorkspacePreference, readLocalePreference } from "../utils/preferences.js";

export function BackupsPage(): JSX.Element {
  const [backups, setBackups] = useState<BackupSnapshot[]>([]);
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [workspace] = useState(() => readDefaultWorkspacePreference());
  const [locale] = useState(() => readLocalePreference());
  const [everyHours, setEveryHours] = useState("24");
  const [restoreApprovalId, setRestoreApprovalId] = useState("");
  const [remoteTargets, setRemoteTargets] = useState<RemoteBackupTarget[]>([]);
  const [remoteType, setRemoteType] = useState<RemoteBackupTarget["type"]>("filesystem");
  const [remoteName, setRemoteName] = useState("");
  const [remotePath, setRemotePath] = useState("");
  const [remoteEndpoint, setRemoteEndpoint] = useState("");
  const [remoteBucket, setRemoteBucket] = useState("");
  const [remotePrefix, setRemotePrefix] = useState("lxpanel");
  const [remoteRegion, setRemoteRegion] = useState("us-east-1");
  const [remoteAccessKey, setRemoteAccessKey] = useState("");
  const [remoteSecretKey, setRemoteSecretKey] = useState("");
  const [remoteResult, setRemoteResult] = useState<string | null>(null);
  const [verification, setVerification] = useState<BackupVerification | null>(null);
  const [backupSearch, setBackupSearch] = useState("");
  const [pendingRestore, setPendingRestore] = useState<BackupSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filteredBackups = useMemo(() => {
    const query = backupSearch.trim().toLowerCase();
    return query ? backups.filter((backup) => [backup.fileName, backup.path, backup.createdBy, backup.sha256 ?? ""].some((value) => value.toLowerCase().includes(query))) : backups;
  }, [backupSearch, backups]);
  const text = pageText[locale].backups;
  const remoteColumns: Array<VirtualColumn<RemoteBackupTarget>> = [
    { id: "name", header: text.columns.name, cell: (target) => target.name, sortValue: (target) => target.name },
    { id: "type", header: text.columns.type, cell: (target) => target.type, sortValue: (target) => target.type },
    { id: "path", header: text.columns.path, cell: (target) => <code className="inline-code">{target.type === "s3" ? `${target.bucket ?? "-"}/${target.prefix ?? ""}` : target.path}</code> },
    { id: "secret", header: text.columns.secret, cell: (target) => target.secretConfigured ? (locale === "en-US" ? "Configured" : "已配置") : "-" },
    { id: "status", header: text.columns.status, cell: (target) => target.lastStatus ?? (target.enabled ? "enabled" : "disabled"), sortValue: (target) => target.lastStatus ?? (target.enabled ? "enabled" : "disabled") },
    { id: "syncedAt", header: text.columns.syncedAt, cell: (target) => target.lastSyncedAt ? formatDate(target.lastSyncedAt) : "-", sortValue: (target) => target.lastSyncedAt }
  ];
  const backupColumns: Array<VirtualColumn<BackupSnapshot>> = [
    { id: "file", header: text.columns.file, cell: (backup) => <>{backup.fileName}<div className="muted-text"><code>{backup.path}</code></div></>, sortValue: (backup) => backup.fileName },
    { id: "size", header: text.columns.size, cell: (backup) => formatBytes(backup.sizeBytes), sortValue: (backup) => backup.sizeBytes },
    { id: "creator", header: text.columns.creator, cell: (backup) => backup.createdBy, sortValue: (backup) => backup.createdBy },
    { id: "time", header: text.columns.time, cell: (backup) => formatDate(backup.createdAt), sortValue: (backup) => backup.createdAt },
    { id: "checksum", header: text.columns.checksum, cell: (backup) => <code>{backup.sha256?.slice(0, 16) ?? "-"}</code> },
    { id: "actions", header: text.columns.actions, className: "row-actions", cell: (backup) => <><button title="verify" onClick={() => void verifyBackup(backup)}><ShieldCheck size={15} /></button><button title="download" onClick={() => void downloadBackup(backup)}><Download size={15} /></button><button title="sync" onClick={() => void syncRemote(backup)}><UploadCloud size={15} /></button><button title="restore" onClick={() => void restoreBackup(backup)}><Undo2 size={15} /></button></> }
  ];

  async function load(): Promise<void> {
    try {
      const [backupResponse, remoteResponse] = await Promise.all([api.backups(), api.remoteBackupTargets(workspace)]);
      setBackups(backupResponse.backups);
      setSchedule(backupResponse.schedule);
      setEveryHours(String(backupResponse.schedule.everyHours));
      setRemoteTargets(remoteResponse.targets);
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

  async function downloadBackup(backup: BackupSnapshot): Promise<void> {
    try {
      const blob = await api.downloadBackup(backup.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = backup.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "下载失败。");
    }
  }

  async function verifyBackup(backup: BackupSnapshot): Promise<void> {
    try {
      const response = await api.verifyBackup(backup.id);
      setVerification(response.verification);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "校验失败。");
    }
  }

  function restoreBackup(backup: BackupSnapshot): void {
    if (!restoreApprovalId) {
      setError("恢复备份需要审批单 ID。");
      return;
    }
    setPendingRestore(backup);
  }

  async function confirmRestore(): Promise<void> {
    if (!pendingRestore) {
      return;
    }
    try {
      await api.restoreBackup(pendingRestore.id, restoreApprovalId);
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "恢复失败。");
      setPendingRestore(null);
    }
  }

  async function createRemoteTarget(): Promise<void> {
    try {
      await api.createRemoteBackupTarget({
        workspace,
        name: remoteName,
        type: remoteType,
        path: remoteType === "filesystem" ? remotePath : `${remoteEndpoint}/${remoteBucket}/${remotePrefix}`,
        enabled: true,
        ...(remoteType === "s3" ? { endpoint: remoteEndpoint, bucket: remoteBucket, prefix: remotePrefix, region: remoteRegion, accessKeyId: remoteAccessKey, secretAccessKey: remoteSecretKey } : {})
      });
      setRemoteType("filesystem");
      setRemoteName("");
      setRemotePath("");
      setRemoteEndpoint("");
      setRemoteBucket("");
      setRemotePrefix("lxpanel");
      setRemoteRegion("us-east-1");
      setRemoteAccessKey("");
      setRemoteSecretKey("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建远程目标失败。");
    }
  }

  async function syncRemote(backup: BackupSnapshot, targetId?: string): Promise<void> {
    try {
      const response = await api.syncRemoteBackup(backup.id, targetId);
      setRemoteResult(response.results.map((result) => `${result.targetName}: ${result.status}`).join("；"));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "同步失败。");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page-stack">
      <ConfirmDialog open={Boolean(pendingRestore)} title={text.confirmTitle} description={pendingRestore ? text.confirmDescription(pendingRestore.fileName) : ""} confirmText={text.confirmText} onConfirm={() => void confirmRestore()} onCancel={() => setPendingRestore(null)} />
      <div className="page-heading"><div><h1>{text.title}</h1><p>{text.subtitle}</p></div><div className="row-actions"><button className="ghost-button" onClick={() => void create()}><Archive size={16} /> {text.create}</button><button className="icon-button" onClick={() => void load()} title={text.refresh}><RotateCw size={18} /></button></div></div>
      {error ? <div className="form-error">{error}</div> : null}
      <section className="table-panel">
        <div className="panel-title">{text.auto}</div>
        <div className="inline-form wrap"><input value={everyHours} onChange={(event) => setEveryHours(event.target.value)} type="number" min={1} max={720} placeholder={text.intervalHours} /><button type="button" onClick={() => void updateSchedule(true)}><Clock size={16} /> {text.enable}</button><button type="button" onClick={() => void updateSchedule(false)}><PauseCircle size={16} /> {text.pause}</button></div>
        <p className="muted-text">{text.current}: {schedule?.enabled ? `${schedule.everyHours}h, ${schedule.nextRunAt ? formatDate(schedule.nextRunAt) : text.nextPending}` : text.disabled}</p>
      </section>
      <section className="table-panel">
        <div className="panel-title">{text.restoreApproval}</div>
        <div className="inline-form wrap"><input value={restoreApprovalId} onChange={(event) => setRestoreApprovalId(event.target.value)} placeholder={text.approvalId} /></div>
      </section>
      <section className="table-panel">
        <div className="panel-title">{text.remoteTargets}</div>
        <div className="inline-form wrap"><input value={remoteName} onChange={(event) => setRemoteName(event.target.value)} placeholder={text.targetName} /><select value={remoteType} onChange={(event) => setRemoteType(event.target.value as RemoteBackupTarget["type"])}><option value="filesystem">{text.filesystem}</option><option value="s3">{text.s3}</option></select>{remoteType === "filesystem" ? <input value={remotePath} onChange={(event) => setRemotePath(event.target.value)} placeholder={text.remotePath} /> : <><input value={remoteEndpoint} onChange={(event) => setRemoteEndpoint(event.target.value)} placeholder="https://s3.example.com" /><input value={remoteBucket} onChange={(event) => setRemoteBucket(event.target.value)} placeholder="bucket" /><input value={remotePrefix} onChange={(event) => setRemotePrefix(event.target.value)} placeholder="prefix" /><input value={remoteRegion} onChange={(event) => setRemoteRegion(event.target.value)} placeholder="region" /><input value={remoteAccessKey} onChange={(event) => setRemoteAccessKey(event.target.value)} placeholder="access key" /><input value={remoteSecretKey} onChange={(event) => setRemoteSecretKey(event.target.value)} placeholder="secret key" type="password" /></>}<button type="button" onClick={() => void createRemoteTarget()}><UploadCloud size={16} /> {text.add}</button></div>
        {remoteResult ? <p className="notice">{remoteResult}</p> : null}
        <VirtualTable tableId="backup-remote-targets" rows={remoteTargets} columns={remoteColumns} getRowKey={(target) => target.id} empty={<EmptyState title={text.emptyRemoteTitle} description={text.emptyRemoteDescription} />} height={320} />
      </section>
      {verification ? <section className="table-panel"><div className="panel-title">{text.verification}</div><p className={verification.ok ? "status-line good" : "status-line bad"}>{verification.ok ? text.passed : text.failed}: {verification.fileName}</p><p className="muted-text">SHA-256: <code>{verification.sha256 || "-"}</code></p><p className="muted-text">{text.stateKeys}: {verification.stateKeys.join(", ") || "-"}</p>{verification.issues.length ? <ul>{verification.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}</section> : null}
      <section className="table-panel"><div className="list-toolbar"><input value={backupSearch} onChange={(event) => setBackupSearch(event.target.value)} placeholder={text.search} /><p className="muted-text">{filteredBackups.length} / {backups.length}</p></div><VirtualTable tableId="backups" rows={filteredBackups} columns={backupColumns} getRowKey={(backup) => backup.id} empty={<EmptyState title={text.emptyTitle} description={text.emptyDescription} action={<button className="ghost-button" type="button" onClick={() => void create()}><Archive size={16} /> {text.create}</button>} />} /></section>
    </main>
  );
}
