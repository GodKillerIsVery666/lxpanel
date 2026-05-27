import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JsonStore } from "../src/lib/jsonStore.js";
import { DatabaseStore, type DatabaseDumpRunner, type DatabaseRestoreDrillRunner } from "../src/modules/databases/databaseStore.js";
import { createInitialPanelState, type PanelState } from "../src/modules/state/panelState.js";

describe("数据库管理", () => {
  it("加密保存连接 URL，只向前端返回脱敏地址", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-db-"));
    const stateStore = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const databaseStore = new DatabaseStore(stateStore, root, "session-secret");

    const connection = await databaseStore.createConnection({ name: "prod", type: "postgres", url: "postgres://admin:secret@127.0.0.1:5432/app", enabled: true, backupRetentionDays: 30 }, "owner");
    const state = await stateStore.read();

    expect(connection.maskedUrl).toContain("admin:***");
    expect(connection.maskedUrl).not.toContain("secret");
    expect(state.databaseConnections[0]?.encryptedUrl).toMatch(/^dbenc:v1:/u);
    expect(state.databaseConnections[0]?.url).toBeUndefined();
  });

  it("使用 pg_dump 运行器生成数据库备份并记录结果", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-db-backup-"));
    const stateStore = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const runner: DatabaseDumpRunner = async (_type, url, filePath) => {
      await writeFile(filePath, `dump from ${url}`, "utf8");
      return { stdout: "dump ok", stderr: "" };
    };
    const databaseStore = new DatabaseStore(stateStore, root, "session-secret", runner);
    const connection = await databaseStore.createConnection({ name: "prod", type: "postgres", url: "postgres://admin:secret@127.0.0.1:5432/app", enabled: true, backupRetentionDays: 30 }, "owner");

    const result = await databaseStore.backupConnection(connection.id, "owner");
    const content = await readFile(result.filePath, "utf8");
    const list = await databaseStore.listConnections();

    expect(result.status).toBe("success");
    expect(result.outputTail).toContain("dump ok");
    expect(content).toContain("postgres://admin:secret@127.0.0.1:5432/app");
    expect(list[0]?.lastStatus).toBe("success");
  });

  it("支持 MySQL 连接备份和恢复演练", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-db-mysql-"));
    const stateStore = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const runner: DatabaseDumpRunner = async (type, url, filePath) => {
      await writeFile(filePath, `-- ${type} dump\nCREATE TABLE app(id int);\n-- ${url}`, "utf8");
      return { stdout: "mysql dump ok", stderr: "" };
    };
    const drillRunner: DatabaseRestoreDrillRunner = async (type, _url, filePath) => {
      const content = await readFile(filePath, "utf8");
      return { stdout: `${type} drill ${content.includes("CREATE TABLE") ? "ok" : "bad"}`, stderr: "" };
    };
    const databaseStore = new DatabaseStore(stateStore, root, "session-secret", runner, drillRunner);
    const connection = await databaseStore.createConnection({ name: "mysql-prod", type: "mysql", url: "mysql://admin:secret@127.0.0.1:3306/app", enabled: true, backupRetentionDays: 7 }, "owner");

    const backup = await databaseStore.backupConnection(connection.id, "owner");
    const drill = await databaseStore.runRestoreDrill(connection.id, "owner");
    const list = await databaseStore.listConnections();

    expect(backup.status).toBe("success");
    expect(drill.status).toBe("success");
    expect(drill.outputTail).toContain("mysql drill ok");
    expect(list[0]?.backupRetentionDays).toBe(7);
    expect(list[0]?.lastRestoreDrillStatus).toBe("success");
  });

  it("运行到期的数据库计划备份并推进下次时间", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-db-schedule-"));
    const stateStore = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const runner: DatabaseDumpRunner = async (_type, url, filePath) => {
      await writeFile(filePath, `scheduled ${url}`, "utf8");
      return { stdout: "scheduled ok", stderr: "" };
    };
    const databaseStore = new DatabaseStore(stateStore, root, "session-secret", runner);
    const connection = await databaseStore.createConnection({ name: "scheduled", type: "postgres", url: "postgres://admin:secret@127.0.0.1:5432/app", enabled: true, backupRetentionDays: 14, scheduleEnabled: true, scheduleEveryHours: 6 }, "owner");
    await stateStore.update((state) => ({
      data: { ...state, databaseConnections: (state.databaseConnections ?? []).map((item) => item.id === connection.id ? { ...item, nextBackupAt: "2026-05-22T08:00:00.000Z" } : item) },
      result: undefined
    }));

    const results = await databaseStore.runDueScheduledBackups(new Date("2026-05-22T09:00:00.000Z"));
    const list = await databaseStore.listConnections();

    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("success");
    expect(list[0]?.lastScheduledBackupAt).toBe("2026-05-22T09:00:00.000Z");
    expect(list[0]?.nextBackupAt).toBe("2026-05-22T15:00:00.000Z");
  });
});
