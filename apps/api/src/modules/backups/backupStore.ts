import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BackupSchedule, BackupSnapshot, UpdateBackupSchedule } from "@lxpanel/shared";
import { randomToken } from "../../lib/crypto.js";
import type { JsonStore } from "../../lib/jsonStore.js";
import type { BackupRecord, BackupScheduleRecord, PanelState } from "../state/panelState.js";

const maxBackups = 100;

export class BackupStore {
  constructor(private readonly store: JsonStore<PanelState>, private readonly dataDir: string) {}

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

  async createBackup(actor: string): Promise<BackupSnapshot> {
    const state = await this.store.read();
    const id = randomToken(10);
    const createdAt = new Date().toISOString();
    const fileName = `lxpanel-state-${createdAt.replace(/[:.]/gu, "-")}-${id}.json`;
    const backupDir = join(this.dataDir, "backups");
    const filePath = join(backupDir, fileName);
    await mkdir(backupDir, { recursive: true });
    await writeFile(filePath, JSON.stringify({ kind: "lxpanel-state", createdAt, state }, null, 2), "utf8");
    const info = await stat(filePath);
    const record: BackupRecord = {
      id,
      fileName,
      path: filePath,
      sizeBytes: info.size,
      createdAt,
      createdBy: actor,
      kind: "state"
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
}

function toBackup(record: BackupRecord): BackupSnapshot {
  return { ...record };
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
