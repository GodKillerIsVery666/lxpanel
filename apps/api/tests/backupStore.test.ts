import { access, readFile, mkdtemp } from "node:fs/promises";
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
    expect(backup.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(content).toContain("admin");
    await expect(backupStore.listBackups()).resolves.toHaveLength(1);
  });

  it("读取并恢复状态备份，恢复时清理会话", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-backup-restore-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    await store.write({
      ...createInitialPanelState(),
      users: [{ id: "u1", username: "admin", role: "owner", passwordHash: "hash", createdAt: new Date().toISOString() }],
      sessions: [{ id: "s1", idHash: "hash", userId: "u1", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() }]
    });
    const backupStore = new BackupStore(store, root);
    const backup = await backupStore.createBackup("admin");
    await store.update((state) => ({
      data: { ...state, users: [{ id: "u2", username: "changed", role: "owner", passwordHash: "hash", createdAt: new Date().toISOString() }] },
      result: undefined
    }));

    const file = await backupStore.readBackupFile(backup.id);
    const restored = await backupStore.restoreBackup(backup.id, "admin");
    const state = await store.read();

    expect(file.content).toContain("lxpanel-state");
    expect(restored.restored.id).toBe(backup.id);
    expect(restored.preRestore.createdBy).toBe("admin");
    expect(state.users[0]?.username).toBe("admin");
    expect(state.sessions).toHaveLength(0);
  });

  it("按计划生成自动备份并推进下次运行时间", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-backup-schedule-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const backupStore = new BackupStore(store, root);
    await backupStore.updateSchedule({ enabled: true, everyHours: 6 }, "admin");
    await store.update((state) => ({
      data: { ...state, backupSchedule: { ...state.backupSchedule, enabled: true, everyHours: 6, nextRunAt: "2026-05-22T08:00:00.000Z" } },
      result: undefined
    }));

    const backup = await backupStore.runDueBackup(new Date("2026-05-22T09:00:00.000Z"));
    const schedule = await backupStore.getSchedule();

    expect(backup?.createdBy).toBe("scheduler");
    expect(schedule.lastStatus).toBe("success");
    expect(schedule.nextRunAt).toBe("2026-05-22T15:00:00.000Z");
  });

  it("超过保留上限时清理旧备份文件", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-backup-retention-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const backupStore = new BackupStore(store, root);

    const first = await backupStore.createBackup("admin");
    for (let index = 0; index < 100; index += 1) {
      await backupStore.createBackup("admin");
    }

    await expect(backupStore.listBackups()).resolves.toHaveLength(100);
    await expect(access(first.path)).rejects.toThrow();
  });
});
