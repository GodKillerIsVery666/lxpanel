import { createHash } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BackupSchedule, BackupSnapshot, BackupVerification, UpdateBackupSchedule } from "@lxpanel/shared";
import { randomToken } from "../../lib/crypto.js";
import type { StateStore } from "../../lib/stateStore.js";
import { createInitialPanelState, type BackupRecord, type BackupScheduleRecord, type PanelState } from "../state/panelState.js";

const maxBackups = 100;

export class BackupStore {
  constructor(private readonly store: StateStore<PanelState>, private readonly dataDir: string) {}

  async listBackups(): Promise<BackupSnapshot[]> {
    const state = await this.store.read();
    return (state.backups ?? []).slice().reverse().map(toBackup);
  }

  async getSchedule(): Promise<BackupSchedule> {
    const state = await this.store.read();
    return toSchedule(state.backupSchedule);
  }

  async updateSchedule(input: UpdateBackupSchedule, actor: string): Promise<BackupSchedule> {
    return this.store.update((state) => {
      const now = new Date();
      const current = toSchedule(state.backupSchedule);
      const everyHours = input.everyHours ?? current.everyHours;
      if (input.enabled && !everyHours) {
        throw new Error("启用计划时必须设置间隔。");
      }
      const schedule: BackupScheduleRecord = {
        ...toScheduleRecord(current),
        enabled: input.enabled,
        everyHours,
        updatedAt: now.toISOString(),
        updatedBy: actor,
        ...(input.enabled ? { nextRunAt: nextRunAt(now, everyHours) } : {})
      };
      if (!input.enabled) {
        delete schedule.nextRunAt;
      }
      return { data: { ...state, backupSchedule: schedule }, result: toSchedule(schedule) };
    });
  }

  async countBackups(): Promise<number> {
    const state = await this.store.read();
    return (state.backups ?? []).length;
  }

  async readBackupFile(backupId: string): Promise<{ backup: BackupSnapshot; content: string }> {
    const backup = await this.findBackup(backupId);
    const content = await readFile(backup.path, "utf8");
    return { backup, content };
  }

  async verifyBackup(backupId: string): Promise<BackupVerification> {
    const backup = await this.findBackup(backupId);
    const issues: string[] = [];
    let content = "";
    let sha256 = "";
    let sizeBytes = 0;
    let formatOk = false;
    let stateKeys: string[] = [];
    try {
      content = await readFile(backup.path, "utf8");
      const info = await stat(backup.path);
      sizeBytes = info.size;
      sha256 = createHash("sha256").update(content).digest("hex");
      stateKeys = Object.keys(parseBackupEnvelope(content)).sort();
      parseBackupState(content);
      formatOk = true;
    } catch (error) {
      issues.push(error instanceof Error ? error.message : "备份文件无法读取或解析。");
    }
    const sizeOk = sizeBytes === backup.sizeBytes;
    const checksumOk = Boolean(backup.sha256) && sha256 === backup.sha256;
    if (!sizeOk) {
      issues.push("备份文件大小与记录不一致。");
    }
    if (!backup.sha256) {
      issues.push("备份记录缺少 SHA-256 校验值。");
    } else if (!checksumOk) {
      issues.push("备份文件 SHA-256 与记录不一致。");
    }
    return {
      backupId: backup.id,
      fileName: backup.fileName,
      checkedAt: new Date().toISOString(),
      ok: issues.length === 0,
      sha256,
      ...(backup.sha256 ? { expectedSha256: backup.sha256 } : {}),
      sizeBytes,
      expectedSizeBytes: backup.sizeBytes,
      sizeOk,
      checksumOk,
      formatOk,
      stateKeys,
      issues
    };
  }

  async restoreBackup(backupId: string, actor: string): Promise<{ restored: BackupSnapshot; preRestore: BackupSnapshot }> {
    const { backup, content } = await this.readBackupFile(backupId);
    const restoredState = parseBackupState(content);
    const preRestore = await this.createBackup(actor);
    await this.store.write({
      ...restoredState,
      sessions: [],
      backups: [...(restoredState.backups ?? []), toBackupRecord(preRestore)].slice(-maxBackups),
      backupSchedule: restoredState.backupSchedule ?? { enabled: false, everyHours: 24 }
    });
    return { restored: backup, preRestore };
  }

  async createBackup(actor: string): Promise<BackupSnapshot> {
    const state = await this.store.read();
    const id = randomToken(10);
    const createdAt = new Date().toISOString();
    const fileName = `lxpanel-state-${createdAt.replace(/[:.]/gu, "-")}-${id}.json`;
    const backupDir = join(this.dataDir, "backups");
    const filePath = join(backupDir, fileName);
    await mkdir(backupDir, { recursive: true });
    const content = JSON.stringify({ kind: "lxpanel-state", createdAt, state }, null, 2);
    await writeFile(filePath, content, "utf8");
    const info = await stat(filePath);
    const record: BackupRecord = {
      id,
      fileName,
      path: filePath,
      sizeBytes: info.size,
      createdAt,
      createdBy: actor,
      kind: "state",
      sha256: createHash("sha256").update(content).digest("hex")
    };
    const removedPaths = await this.store.update((current) => {
      const backups = [...(current.backups ?? []), record];
      const retained = backups.slice(-maxBackups);
      return {
        data: { ...current, backups: retained },
        result: backups.slice(0, Math.max(0, backups.length - retained.length)).map((backup) => backup.path)
      };
    });
    await Promise.allSettled(removedPaths.map((path) => unlink(path)));
    return toBackup(record);
  }

  async runDueBackup(now = new Date()): Promise<BackupSnapshot | null> {
    const schedule = await this.getSchedule();
    if (!schedule.enabled || !schedule.nextRunAt || new Date(schedule.nextRunAt).getTime() > now.getTime()) {
      return null;
    }
    try {
      const backup = await this.createBackup("scheduler");
      await this.store.update((state) => ({
        data: {
          ...state,
          backupSchedule: {
            ...toScheduleRecord(toSchedule(state.backupSchedule)),
            lastRunAt: backup.createdAt,
            lastStatus: "success",
            nextRunAt: nextRunAt(now, schedule.everyHours)
          }
        },
        result: undefined
      }));
      return backup;
    } catch (error) {
      await this.store.update((state) => ({
        data: {
          ...state,
          backupSchedule: {
            ...toScheduleRecord(toSchedule(state.backupSchedule)),
            lastStatus: "failed",
            nextRunAt: nextRunAt(now, schedule.everyHours)
          }
        },
        result: undefined
      }));
      throw error;
    }
  }

  private async findBackup(backupId: string): Promise<BackupSnapshot> {
    const state = await this.store.read();
    const backup = (state.backups ?? []).find((item) => item.id === backupId);
    if (!backup) {
      throw new Error("备份不存在。");
    }
    return toBackup(backup);
  }
}

function toBackup(record: BackupRecord): BackupSnapshot {
  return { ...record };
}

function toBackupRecord(snapshot: BackupSnapshot): BackupRecord {
  return {
    id: snapshot.id,
    fileName: snapshot.fileName,
    path: snapshot.path,
    sizeBytes: snapshot.sizeBytes,
    createdAt: snapshot.createdAt,
    createdBy: snapshot.createdBy,
    kind: snapshot.kind,
    ...(snapshot.sha256 ? { sha256: snapshot.sha256 } : {})
  };
}

function parseBackupState(content: string): PanelState {
  const state = parseBackupEnvelope(content);
  const initial = createInitialPanelState();
  return {
    ...initial,
    users: readArrayOrDefault<PanelState["users"]>(state.users, initial.users),
    sessions: [],
    apiTokens: readArrayOrDefault<NonNullable<PanelState["apiTokens"]>>(state.apiTokens, initial.apiTokens ?? []),
    connectors: readArrayOrDefault<PanelState["connectors"]>(state.connectors, initial.connectors),
    connectorCommands: readArrayOrDefault<NonNullable<PanelState["connectorCommands"]>>(state.connectorCommands, initial.connectorCommands ?? []),
    tasks: readArrayOrDefault<NonNullable<PanelState["tasks"]>>(state.tasks, initial.tasks ?? []),
    taskRuns: readArrayOrDefault<NonNullable<PanelState["taskRuns"]>>(state.taskRuns, initial.taskRuns ?? []),
    backups: readArrayOrDefault<NonNullable<PanelState["backups"]>>(state.backups, initial.backups ?? []),
    backupSchedule: readBackupSchedule(state.backupSchedule) ?? initial.backupSchedule ?? { enabled: false, everyHours: 24 },
    alertThresholds: readArrayOrDefault<NonNullable<PanelState["alertThresholds"]>>(state.alertThresholds, initial.alertThresholds ?? []),
    alertEvents: readArrayOrDefault<NonNullable<PanelState["alertEvents"]>>(state.alertEvents, initial.alertEvents ?? []),
    hosts: readArrayOrDefault<NonNullable<PanelState["hosts"]>>(state.hosts, initial.hosts ?? []),
    metricSamples: readArrayOrDefault<NonNullable<PanelState["metricSamples"]>>(state.metricSamples, initial.metricSamples ?? []),
    notificationChannels: readArrayOrDefault<NonNullable<PanelState["notificationChannels"]>>(state.notificationChannels, initial.notificationChannels ?? []),
    notificationDeliveries: readArrayOrDefault<NonNullable<PanelState["notificationDeliveries"]>>(state.notificationDeliveries, initial.notificationDeliveries ?? []),
    appDeployments: readArrayOrDefault<NonNullable<PanelState["appDeployments"]>>(state.appDeployments, initial.appDeployments ?? []),
    approvals: readArrayOrDefault<NonNullable<PanelState["approvals"]>>(state.approvals, initial.approvals ?? [])
  };
}

function parseBackupEnvelope(content: string): Record<string, unknown> {
  const parsed = JSON.parse(content) as unknown;
  if (!isRecord(parsed) || parsed.kind !== "lxpanel-state" || !isRecord(parsed.state)) {
    throw new Error("备份文件格式不正确。");
  }
  return parsed.state;
}

function readArrayOrDefault<TValue extends unknown[]>(value: unknown, fallback: TValue): TValue {
  return (Array.isArray(value) ? value : fallback) as TValue;
}

function readBackupSchedule(value: unknown): BackupScheduleRecord | undefined {
  if (!isRecord(value) || typeof value.enabled !== "boolean" || typeof value.everyHours !== "number") {
    return undefined;
  }
  return {
    enabled: value.enabled,
    everyHours: value.everyHours,
    ...(typeof value.nextRunAt === "string" ? { nextRunAt: value.nextRunAt } : {}),
    ...(typeof value.lastRunAt === "string" ? { lastRunAt: value.lastRunAt } : {}),
    ...(value.lastStatus === "success" || value.lastStatus === "failed" ? { lastStatus: value.lastStatus } : {}),
    ...(typeof value.updatedAt === "string" ? { updatedAt: value.updatedAt } : {}),
    ...(typeof value.updatedBy === "string" ? { updatedBy: value.updatedBy } : {})
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toSchedule(record?: BackupScheduleRecord): BackupSchedule {
  return {
    enabled: record?.enabled ?? false,
    everyHours: record?.everyHours ?? 24,
    ...(record?.nextRunAt ? { nextRunAt: record.nextRunAt } : {}),
    ...(record?.lastRunAt ? { lastRunAt: record.lastRunAt } : {}),
    ...(record?.lastStatus ? { lastStatus: record.lastStatus } : {}),
    ...(record?.updatedAt ? { updatedAt: record.updatedAt } : {}),
    ...(record?.updatedBy ? { updatedBy: record.updatedBy } : {})
  };
}

function toScheduleRecord(schedule: BackupSchedule): BackupScheduleRecord {
  return {
    enabled: schedule.enabled,
    everyHours: schedule.everyHours,
    ...(schedule.nextRunAt ? { nextRunAt: schedule.nextRunAt } : {}),
    ...(schedule.lastRunAt ? { lastRunAt: schedule.lastRunAt } : {}),
    ...(schedule.lastStatus ? { lastStatus: schedule.lastStatus } : {}),
    ...(schedule.updatedAt ? { updatedAt: schedule.updatedAt } : {}),
    ...(schedule.updatedBy ? { updatedBy: schedule.updatedBy } : {})
  };
}

function nextRunAt(from: Date, everyHours: number): string {
  return new Date(from.getTime() + everyHours * 60 * 60_000).toISOString();
}
