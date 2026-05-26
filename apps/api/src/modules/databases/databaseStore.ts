import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { CreateDatabaseConnection, DatabaseBackupResult, DatabaseConnection, UpdateDatabaseConnection } from "@lxpanel/shared";
import { runCommand, type CommandResult } from "../../lib/command.js";
import { randomToken } from "../../lib/crypto.js";
import type { StateStore } from "../../lib/stateStore.js";
import type { DatabaseConnectionRecord, PanelState } from "../state/panelState.js";

const encryptedUrlPrefix = "dbenc:v1";
const outputLimit = 12_000;

export type DatabaseDumpRunner = (url: string, filePath: string) => Promise<CommandResult>;

const defaultDumpRunner: DatabaseDumpRunner = (url, filePath) => runCommand("pg_dump", ["--dbname", url, "--file", filePath, "--format", "custom"], 120_000);

export class DatabaseStore {
  private readonly encryptionKey: Buffer | null;

  constructor(
    private readonly store: StateStore<PanelState>,
    private readonly dataDir: string,
    encryptionSecret = "",
    private readonly dumpRunner: DatabaseDumpRunner = defaultDumpRunner
  ) {
    this.encryptionKey = encryptionSecret ? createHash("sha256").update(encryptionSecret).digest() : null;
  }

  async listConnections(): Promise<DatabaseConnection[]> {
    const state = await this.store.read();
    return (state.databaseConnections ?? []).slice().reverse().map((connection) => toPublicConnection(connection, this.readUrl(connection)));
  }

  async createConnection(input: CreateDatabaseConnection, actor: string): Promise<DatabaseConnection> {
    const storedUrl = this.toStoredUrl(input.url);
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const connection: DatabaseConnectionRecord = {
        id: randomToken(12),
        name: input.name,
        type: input.type,
        enabled: input.enabled,
        createdAt: now,
        updatedAt: now,
        updatedBy: actor,
        ...storedUrl
      };
      return { data: { ...state, databaseConnections: [...(state.databaseConnections ?? []), connection] }, result: toPublicConnection(connection, input.url) };
    });
  }

  async updateConnection(input: UpdateDatabaseConnection, actor: string): Promise<DatabaseConnection> {
    return this.store.update((state) => {
      const connections = state.databaseConnections ?? [];
      const existing = connections.find((connection) => connection.id === input.connectionId);
      if (!existing) {
        throw new Error("数据库连接不存在。");
      }
      let updated: DatabaseConnectionRecord = {
        ...existing,
        ...(input.name ? { name: input.name } : {}),
        ...(typeof input.enabled === "boolean" ? { enabled: input.enabled } : {}),
        updatedAt: new Date().toISOString(),
        updatedBy: actor
      };
      if (input.url) {
        updated = withStoredUrl(updated, this.toStoredUrl(input.url));
      }
      return {
        data: { ...state, databaseConnections: connections.map((connection) => connection.id === input.connectionId ? updated : connection) },
        result: toPublicConnection(updated, input.url ?? this.readUrl(existing))
      };
    });
  }

  async deleteConnection(connectionId: string): Promise<boolean> {
    return this.store.update((state) => {
      const connections = state.databaseConnections ?? [];
      const next = connections.filter((connection) => connection.id !== connectionId);
      return { data: { ...state, databaseConnections: next }, result: next.length !== connections.length };
    });
  }

  async backupConnection(connectionId: string, actor: string): Promise<DatabaseBackupResult> {
    const state = await this.store.read();
    const connection = (state.databaseConnections ?? []).find((item) => item.id === connectionId);
    if (!connection) {
      throw new Error("数据库连接不存在。");
    }
    if (!connection.enabled) {
      throw new Error("数据库连接已停用。");
    }
    const backupDir = join(this.dataDir, "database-backups");
    await mkdir(backupDir, { recursive: true });
    const filePath = join(backupDir, `${sanitizeName(connection.name)}-${new Date().toISOString().replace(/[:.]/gu, "-")}.dump`);
    let result: DatabaseBackupResult;
    try {
      const output = await this.dumpRunner(this.readUrl(connection), filePath);
      result = { connectionId, filePath, status: "success", outputTail: tailOutput(`${output.stdout}\n${output.stderr}`.trim()) };
    } catch (error) {
      result = { connectionId, filePath, status: "failed", error: error instanceof Error ? error.message : String(error) };
    }
    await this.markBackupResult(connectionId, result, actor);
    return result;
  }

  private async markBackupResult(connectionId: string, result: DatabaseBackupResult, actor: string): Promise<void> {
    await this.store.update((state) => ({
      data: {
        ...state,
        databaseConnections: (state.databaseConnections ?? []).map((connection) => connection.id === connectionId ? toUpdatedConnection(connection, result, actor) : connection)
      },
      result: undefined
    }));
  }

  private toStoredUrl(value: string): Pick<DatabaseConnectionRecord, "url" | "encryptedUrl"> {
    return this.encryptionKey ? { encryptedUrl: encryptSecret(value, this.encryptionKey) } : { url: value };
  }

  private readUrl(connection: DatabaseConnectionRecord): string {
    if (connection.encryptedUrl) {
      if (!this.encryptionKey) {
        throw new Error("数据库连接已加密，但当前未配置解密密钥。");
      }
      return decryptSecret(connection.encryptedUrl, this.encryptionKey);
    }
    if (connection.url) {
      return connection.url;
    }
    throw new Error("数据库连接缺少 URL。");
  }
}

function toUpdatedConnection(connection: DatabaseConnectionRecord, result: DatabaseBackupResult, actor: string): DatabaseConnectionRecord {
  const updated: DatabaseConnectionRecord = {
    ...connection,
    lastBackupAt: new Date().toISOString(),
    lastStatus: result.status,
    updatedAt: new Date().toISOString(),
    updatedBy: actor
  };
  if (result.error) {
    updated.lastError = result.error;
  } else {
    delete updated.lastError;
  }
  return updated;
}

function toPublicConnection(connection: DatabaseConnectionRecord, url: string): DatabaseConnection {
  return {
    id: connection.id,
    name: connection.name,
    type: connection.type,
    maskedUrl: maskDatabaseUrl(url),
    enabled: connection.enabled,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
    updatedBy: connection.updatedBy,
    ...(connection.lastBackupAt ? { lastBackupAt: connection.lastBackupAt } : {}),
    ...(connection.lastStatus ? { lastStatus: connection.lastStatus } : {}),
    ...(connection.lastError ? { lastError: connection.lastError } : {})
  };
}

function withStoredUrl(connection: DatabaseConnectionRecord, storedUrl: Pick<DatabaseConnectionRecord, "url" | "encryptedUrl">): DatabaseConnectionRecord {
  const next = { ...connection, ...storedUrl };
  if (storedUrl.encryptedUrl) {
    delete next.url;
  }
  if (storedUrl.url) {
    delete next.encryptedUrl;
  }
  return next;
}

function encryptSecret(value: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${encryptedUrlPrefix}:${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

function decryptSecret(value: string, key: Buffer): string {
  const [prefix, version, ivText, tagText, ciphertextText] = value.split(":");
  if (`${prefix}:${version}` !== encryptedUrlPrefix || !ivText || !tagText || !ciphertextText) {
    throw new Error("数据库连接加密 URL 格式不正确。");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8");
}

function maskDatabaseUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.password) {
      url.password = "***";
    }
    return url.toString();
  } catch {
    return "postgres://...";
  }
}

function sanitizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_.-]/gu, "-").slice(0, 48) || "database";
}

function tailOutput(value: string): string {
  return value.length > outputLimit ? value.slice(-outputLimit) : value;
}
