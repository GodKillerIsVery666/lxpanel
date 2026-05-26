import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JsonStore } from "../src/lib/jsonStore.js";
import { DatabaseStore, type DatabaseDumpRunner } from "../src/modules/databases/databaseStore.js";
import { createInitialPanelState, type PanelState } from "../src/modules/state/panelState.js";

describe("数据库管理", () => {
  it("加密保存连接 URL，只向前端返回脱敏地址", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-db-"));
    const stateStore = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const databaseStore = new DatabaseStore(stateStore, root, "session-secret");

    const connection = await databaseStore.createConnection({ name: "prod", type: "postgres", url: "postgres://admin:secret@127.0.0.1:5432/app", enabled: true }, "owner");
    const state = await stateStore.read();

    expect(connection.maskedUrl).toContain("admin:***");
    expect(connection.maskedUrl).not.toContain("secret");
    expect(state.databaseConnections[0]?.encryptedUrl).toMatch(/^dbenc:v1:/u);
    expect(state.databaseConnections[0]?.url).toBeUndefined();
  });

  it("使用 pg_dump 运行器生成数据库备份并记录结果", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-db-backup-"));
    const stateStore = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const runner: DatabaseDumpRunner = async (url, filePath) => {
      await writeFile(filePath, `dump from ${url}`, "utf8");
      return { stdout: "dump ok", stderr: "" };
    };
    const databaseStore = new DatabaseStore(stateStore, root, "session-secret", runner);
    const connection = await databaseStore.createConnection({ name: "prod", type: "postgres", url: "postgres://admin:secret@127.0.0.1:5432/app", enabled: true }, "owner");

    const result = await databaseStore.backupConnection(connection.id, "owner");
    const content = await readFile(result.filePath, "utf8");
    const list = await databaseStore.listConnections();

    expect(result.status).toBe("success");
    expect(result.outputTail).toContain("dump ok");
    expect(content).toContain("postgres://admin:secret@127.0.0.1:5432/app");
    expect(list[0]?.lastStatus).toBe("success");
  });
});
