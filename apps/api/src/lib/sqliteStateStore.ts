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
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): unknown;
}

interface ValueRow {
  value: string;
}

interface ArchiveRow {
  id: number;
  bucket: string;
  record_id: string;
  event_time: string;
  payload: string;
  archived_at: string;
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

  archiveRecords(bucket: string, records: Array<{ id: string; time: string; payload: unknown }>): Promise<number> {
    try {
      this.db.exec("BEGIN IMMEDIATE");
      const statement = this.db.prepare("INSERT INTO state_archive (bucket, record_id, event_time, payload, archived_at) VALUES (?, ?, ?, ?, ?)");
      const archivedAt = new Date().toISOString();
      for (const record of records) {
        statement.run(bucket, record.id, record.time, JSON.stringify(record.payload), archivedAt);
      }
      this.db.exec("COMMIT");
      return Promise.resolve(records.length);
    } catch (error) {
      this.db.exec("ROLLBACK");
      return Promise.reject(normalizeError(error));
    }
  }

  queryArchiveRecords(input: { bucket?: string; limit?: number }): Promise<Array<{ id: number; bucket: string; recordId: string; eventTime: string; payload: unknown; archivedAt: string }>> {
    try {
      const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
      const statement = input.bucket
        ? this.db.prepare("SELECT id, bucket, record_id, event_time, payload, archived_at FROM state_archive WHERE bucket = ? ORDER BY event_time DESC, id DESC LIMIT ?")
        : this.db.prepare("SELECT id, bucket, record_id, event_time, payload, archived_at FROM state_archive ORDER BY event_time DESC, id DESC LIMIT ?");
      const rawRows = input.bucket ? statement.all(input.bucket, limit) : statement.all(limit);
      const rows = rawRows.filter(isArchiveRow);
      return Promise.resolve(rows.map((row) => ({
        id: row.id,
        bucket: row.bucket,
        recordId: row.record_id,
        eventTime: row.event_time,
        archivedAt: row.archived_at,
        payload: parsePayload(row.payload)
      })));
    } catch (error) {
      return Promise.reject(normalizeError(error));
    }
  }

  close(): void {
    this.db.close();
  }

  private initialize(seedData?: TData): void {
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA synchronous = NORMAL");
    this.db.exec("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)");
    this.db.exec("CREATE TABLE IF NOT EXISTS state_archive (id INTEGER PRIMARY KEY AUTOINCREMENT, bucket TEXT NOT NULL, record_id TEXT NOT NULL, event_time TEXT NOT NULL, payload TEXT NOT NULL, archived_at TEXT NOT NULL)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_state_archive_bucket_time ON state_archive(bucket, event_time)");
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

function isArchiveRow(value: unknown): value is ArchiveRow {
  return typeof value === "object" && value !== null
    && "id" in value && typeof value.id === "number"
    && "bucket" in value && typeof value.bucket === "string"
    && "record_id" in value && typeof value.record_id === "string"
    && "event_time" in value && typeof value.event_time === "string"
    && "payload" in value && typeof value.payload === "string"
    && "archived_at" in value && typeof value.archived_at === "string";
}

function parsePayload(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
