import { access, readFile, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
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
    const verification = await backupStore.verifyBackup(backup.id);

    expect(backup.fileName).toContain("lxpanel-state");
    expect(backup.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(verification.ok).toBe(true);
    expect(verification.sha256).toBe(backup.sha256);
    expect(content).toContain("admin");
    await expect(backupStore.listBackups()).resolves.toHaveLength(1);
  });

  it("读取并恢复状态备份，恢复时清理会话", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-backup-restore-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    await store.write({
      ...createInitialPanelState(),
      users: [{ id: "u1", username: "admin", role: "owner", passwordHash: "hash", createdAt: new Date().toISOString() }],
      sessions: [{ id: "s1", idHash: "hash", userId: "u1", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() }],
      apiTokens: [{ id: "t1", name: "ci", userId: "u1", role: "owner", scopes: ["system:read"], tokenHash: "hash", createdAt: new Date().toISOString() }],
      hosts: [{ id: "h1", name: "edge", address: "10.0.0.2", tags: ["prod"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      notificationChannels: [{ id: "n1", name: "ops", type: "webhook", url: "https://hooks.example.com/token", enabled: true, minLevel: "warning", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), updatedBy: "admin" }],
      approvals: [{ id: "a1", action: "audit.prune", target: "30d", reason: "cleanup", status: "approved", requestedBy: "admin", requestedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() }]
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
    expect(state.apiTokens?.[0]?.name).toBe("ci");
    expect(state.hosts?.[0]?.name).toBe("edge");
    expect(state.notificationChannels?.[0]?.name).toBe("ops");
    expect(state.approvals?.[0]?.id).toBe("a1");
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

  it("将本地备份同步到文件系统远程目标并写入校验文件", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-backup-remote-"));
    const remoteRoot = await mkdtemp(join(tmpdir(), "lxpanel-backup-target-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const backupStore = new BackupStore(store, root);
    const backup = await backupStore.createBackup("admin");
    const target = await backupStore.createRemoteTarget({ workspace: "default", name: "nas", type: "filesystem", path: remoteRoot, enabled: true }, "admin");

    const result = await backupStore.syncRemote({ backupId: backup.id }, "admin");
    const copied = await readFile(join(remoteRoot, backup.fileName), "utf8");
    const checksum = await readFile(join(remoteRoot, `${backup.fileName}.sha256`), "utf8");
    const targets = await backupStore.listRemoteTargets();

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("success");
    expect(result[0]?.targetId).toBe(target.id);
    expect(copied).toContain("lxpanel-state");
    expect(checksum).toContain(backup.sha256);
    expect(targets[0]?.lastStatus).toBe("success");
  });

  it("将本地备份同步到 S3 兼容对象存储目标", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-backup-s3-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const backupStore = new BackupStore(store, root, "session-secret");
    const backup = await backupStore.createBackup("admin");
    const paths: string[] = [];
    const server = createServer((request, response) => {
      paths.push(request.url ?? "");
      request.resume();
      response.statusCode = 200;
      response.end("ok");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("server listen failed");
    }
    try {
      const target = await backupStore.createRemoteTarget({ workspace: "default", name: "minio", type: "s3", path: "s3://bucket/panel", endpoint: `http://127.0.0.1:${address.port}`, bucket: "bucket", prefix: "panel", region: "us-east-1", accessKeyId: "access", secretAccessKey: "secret", enabled: true }, "admin");
      const state = await store.read();

      const result = await backupStore.syncRemote({ backupId: backup.id, targetId: target.id }, "admin");

      expect(state.remoteBackupTargets?.[0]?.encryptedSecretAccessKey).toMatch(/^rbenc:v1:/u);
      expect(result[0]?.status).toBe("success");
      expect(result[0]?.objectKey).toBe(`panel/${backup.fileName}`);
      expect(paths).toContain(`/bucket/panel/${backup.fileName}`);
      expect(paths).toContain(`/bucket/panel/${backup.fileName}.sha256`);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
