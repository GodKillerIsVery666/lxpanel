import { access, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { SqliteStateStore } from "../src/lib/sqliteStateStore.js";
import { createInitialPanelState, type PanelState } from "../src/modules/state/panelState.js";
import { createPanelStateStore } from "../src/modules/state/stateStoreFactory.js";

describe("SQLite 状态存储", () => {
  it("读写并持久化面板状态", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-sqlite-store-"));
    const dbPath = join(root, "state.db");
    const store = await SqliteStateStore.open<PanelState>(dbPath, createInitialPanelState);

    await store.update((state) => ({
      data: {
        ...state,
        users: [{ id: "u1", username: "admin", role: "owner", passwordHash: "hash", createdAt: "2026-05-22T00:00:00.000Z" }]
      },
      result: undefined
    }));
    store.close();

    const reopened = await SqliteStateStore.open<PanelState>(dbPath, createInitialPanelState);
    const state = await reopened.read();

    expect(state.users[0]?.username).toBe("admin");
    reopened.close();
  });

  it("启用 SQLite 时从 legacy JSON 状态导入初始数据", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-sqlite-migrate-"));
    const legacyState: PanelState = {
      ...createInitialPanelState(),
      users: [{ id: "u1", username: "legacy", role: "owner", passwordHash: "hash", createdAt: "2026-05-22T00:00:00.000Z" }]
    };
    await writeFile(join(root, "state.json"), `${JSON.stringify(legacyState, null, 2)}\n`, "utf8");
    const config = loadConfig({
      LXPANEL_DATA_DIR: root,
      LXPANEL_SESSION_SECRET: "test-secret-with-enough-length",
      LXPANEL_STATE_STORE: "sqlite"
    });

    const store = await createPanelStateStore(config);
    const state = await store.read();

    expect(state.users[0]?.username).toBe("legacy");
    await expect(access(join(root, "state.json"))).resolves.toBeUndefined();
    store.close?.();
  });
});
