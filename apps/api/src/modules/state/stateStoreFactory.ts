import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppConfig } from "../../config/env.js";
import { JsonStore } from "../../lib/jsonStore.js";
import { SqliteStateStore } from "../../lib/sqliteStateStore.js";
import type { StateStore } from "../../lib/stateStore.js";
import { createInitialPanelState, type PanelState } from "./panelState.js";

export async function createPanelStateStore(config: AppConfig): Promise<StateStore<PanelState>> {
  const jsonPath = join(config.dataDir, "state.json");
  if (config.stateStoreDriver === "json") {
    return new JsonStore<PanelState>(jsonPath, createInitialPanelState);
  }
  const seed = await readLegacyJsonState(jsonPath);
  return SqliteStateStore.open<PanelState>(config.stateSqlitePath, createInitialPanelState, seed);
}

async function readLegacyJsonState(jsonPath: string): Promise<PanelState | undefined> {
  try {
    const raw = await readFile(jsonPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (isPanelStateLike(parsed)) {
      return parsed;
    }
    return undefined;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }
    console.error("[state-store] 读取 legacy JSON 状态失败", error);
    throw error;
  }
}

function isPanelStateLike(value: unknown): value is PanelState {
  return typeof value === "object" && value !== null && "users" in value && "sessions" in value && "connectors" in value;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
