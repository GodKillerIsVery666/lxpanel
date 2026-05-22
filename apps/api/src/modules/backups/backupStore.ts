import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BackupSnapshot } from "@lxpanel/shared";
import { randomToken } from "../../lib/crypto.js";
import type { JsonStore } from "../../lib/jsonStore.js";
import type { BackupRecord, PanelState } from "../state/panelState.js";

export class BackupStore {
  constructor(private readonly store: JsonStore<PanelState>, private readonly dataDir: string) {}

  async listBackups(): Promise<BackupSnapshot[]> {
    const state = await this.store.read();
    return (state.backups ?? []).slice().reverse().map(toBackup);
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
    await this.store.update((current) => ({
      data: { ...current, backups: [...(current.backups ?? []), record].slice(-100) },
      result: undefined
    }));
    return toBackup(record);
  }
}

function toBackup(record: BackupRecord): BackupSnapshot {
  return { ...record };
}
