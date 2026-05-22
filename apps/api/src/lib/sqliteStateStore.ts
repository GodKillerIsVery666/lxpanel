import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { StateStore } from "./stateStore.js";

interface DatabaseLike {
  exec(sql: string): void;
  prepare(sql: string): StatementLike;
  close(): void;
}

interface StatementLike {
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): unknown;
}

interface ValueRow {
  value: string;
}

export class SqliteStateStore<TData extends object> implements StateStore<TData> {
  private constructor(
    private readonly db: DatabaseLike,
    private readonly createInitial: () => TData
  ) {}

  static async open<TData extends object>(filePath: string, createInitial: () => TData, seedData?: TData): Promise<SqliteStateStore<TData>> {
    await mkdir(dirname(filePath), { recursive: true });
    const sqlite = await import("node:sqlite");
    const db = new sqlite.DatabaseSync(filePath) as DatabaseLike;
    const store = new SqliteStateStore(db, createInitial);
    store.initialize(seedData);
    return store;
  }

  read(): Promise<TData> {
    try {
      return Promise.resolve(this.readSync());
    } catch (error) {
      return Promise.reject(normalizeError(error));
    }
  }

  write(data: TData): Promise<void> {
    try {
      this.writeSync(data);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(normalizeError(error));
    }
  }

  async update<TResult>(mutator: (data: TData) => Promise<{ data: TData; result: TResult }> | { data: TData; result: TResult }): Promise<TResult> {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const current = this.readSync();
      const next = await mutator(current);
      this.writeSync(next.data);
      this.db.exec("COMMIT");
      return next.result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }

  private initialize(seedData?: TData): void {
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA synchronous = NORMAL");
    this.db.exec("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)");
    const existing = this.selectState();
    if (!existing) {
      this.writeSync(seedData ?? this.cloneInitial());
    }
  }

  private readSync(): TData {
    const row = this.selectState();
    if (!row) {
      return this.cloneInitial();
    }
    return JSON.parse(row.value) as TData;
  }

  private writeSync(data: TData): void {
    const serialized = `${JSON.stringify(data, null, 2)}\n`;
    this.db.prepare("INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
      .run("state", serialized, new Date().toISOString());
  }

  private selectState(): ValueRow | null {
    const row = this.db.prepare("SELECT value FROM kv WHERE key = ?").get("state");
    if (isValueRow(row)) {
      return row;
    }
    return null;
  }

  private cloneInitial(): TData {
    return JSON.parse(JSON.stringify(this.createInitial())) as TData;
  }
}

function isValueRow(value: unknown): value is ValueRow {
  return typeof value === "object" && value !== null && "value" in value && typeof value.value === "string";
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
