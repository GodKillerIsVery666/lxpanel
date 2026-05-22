import { readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JsonStore } from "../src/lib/jsonStore.js";
import { BackupStore } from "../src/modules/backups/backupStore.js";
import { createInitialPanelState, type PanelState } from "../src/modules/state/panelState.js";

describe("备份快照", () => {
  it("创建本地状态备份并记录元数据", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-backup-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    await store.write({ ...createInitialPanelState(), users: [{ id: "u1", username: "admin", role: "owner", passwordHash: "hash", createdAt: new Date().toISOString() }] });
    const backupStore = new BackupStore(store, root);

    const backup = await backupStore.createBackup("admin");
    const content = await readFile(backup.path, "utf8");

    expect(backup.fileName).toContain("lxpanel-state");
    expect(content).toContain("admin");
    await expect(backupStore.listBackups()).resolves.toHaveLength(1);
  });
});
