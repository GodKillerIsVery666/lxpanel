import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { copyFile, mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BackupSchedule, BackupSnapshot, BackupVerification, CreateRemoteBackupTarget, RemoteBackupSync, RemoteBackupSyncResult, RemoteBackupTarget, UpdateBackupSchedule, UpdateRemoteBackupTarget } from "@lxpanel/shared";
import { randomToken } from "../../lib/crypto.js";
import type { StateStore } from "../../lib/stateStore.js";
import { createInitialPanelState, type BackupRecord, type BackupScheduleRecord, type PanelState, type RemoteBackupTargetRecord } from "../state/panelState.js";

const maxBackups = 100;
const encryptedSecretPrefix = "rbenc:v1";

export class BackupStore {
  private readonly encryptionKey: Buffer | null;

  constructor(private readonly store: StateStore<PanelState>, private readonly dataDir: string, encryptionSecret = "") {
    this.encryptionKey = encryptionSecret ? createHash("sha256").update(encryptionSecret).digest() : null;
  }

  async listBackups(): Promise<BackupSnapshot[]> {
    const state = await this.store.read();
    return (state.backups ?? []).slice().reverse().map(toBackup);
  }

  async getSchedule(): Promise<BackupSchedule> {
    const state = await this.store.read();
    return toSchedule(state.backupSchedule);
  }

  async updateSchedule(input: UpdateBackupSchedule, actor: string): Promise<BackupSchedule> {
    return this.store.update((state) => {
      const now = new Date();
      const current = toSchedule(state.backupSchedule);
      const everyHours = input.everyHours ?? current.everyHours;
      if (input.enabled && !everyHours) {
        throw new Error("启用计划时必须设置间隔。");
      }
      const schedule: BackupScheduleRecord = {
        ...toScheduleRecord(current),
        enabled: input.enabled,
        everyHours,
        updatedAt: now.toISOString(),
        updatedBy: actor,
        ...(input.enabled ? { nextRunAt: nextRunAt(now, everyHours) } : {})
      };
      if (!input.enabled) {
        delete schedule.nextRunAt;
      }
      return { data: { ...state, backupSchedule: schedule }, result: toSchedule(schedule) };
    });
  }

  async countBackups(): Promise<number> {
    const state = await this.store.read();
    return (state.backups ?? []).length;
  }

  async listRemoteTargets(workspace?: string): Promise<RemoteBackupTarget[]> {
    const state = await this.store.read();
    return (state.remoteBackupTargets ?? []).filter((target) => !workspace || (target.workspace ?? "default") === workspace).slice().reverse().map(toPublicRemoteTarget);
  }

  async createRemoteTarget(input: CreateRemoteBackupTarget, actor: string): Promise<RemoteBackupTarget> {
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const target: RemoteBackupTargetRecord = {
        id: randomToken(12),
        workspace: input.workspace,
        name: input.name,
        type: input.type,
        path: input.path,
        ...(input.endpoint ? { endpoint: input.endpoint } : {}),
        ...(input.bucket ? { bucket: input.bucket } : {}),
        ...(input.prefix ? { prefix: input.prefix } : {}),
        ...(input.region ? { region: input.region } : {}),
        ...(input.accessKeyId ? { accessKeyId: input.accessKeyId } : {}),
        ...(input.secretAccessKey ? this.toStoredRemoteSecret(input.secretAccessKey) : {}),
        ...(input.secretAccessKey ? { secretConfigured: true } : {}),
        enabled: input.enabled,
        createdAt: now,
        updatedAt: now,
        updatedBy: actor
      };
      return { data: { ...state, remoteBackupTargets: [...(state.remoteBackupTargets ?? []), target] }, result: toPublicRemoteTarget(target) };
    });
  }

  async updateRemoteTarget(input: UpdateRemoteBackupTarget, actor: string): Promise<RemoteBackupTarget> {
    return this.store.update((state) => {
      const targets = state.remoteBackupTargets ?? [];
      const target = targets.find((item) => item.id === input.targetId);
      if (!target) {
        throw new Error("远程备份目标不存在。");
      }
      const updated: RemoteBackupTargetRecord = {
        ...target,
        ...(input.workspace ? { workspace: input.workspace } : {}),
        ...(input.name ? { name: input.name } : {}),
        ...(input.path ? { path: input.path } : {}),
        ...(input.endpoint ? { endpoint: input.endpoint } : {}),
        ...(input.bucket ? { bucket: input.bucket } : {}),
        ...(input.prefix !== undefined ? { prefix: input.prefix } : {}),
        ...(input.region ? { region: input.region } : {}),
        ...(input.accessKeyId ? { accessKeyId: input.accessKeyId } : {}),
        ...(input.secretAccessKey ? this.toStoredRemoteSecret(input.secretAccessKey) : {}),
        ...(input.secretAccessKey ? { secretConfigured: true } : {}),
        ...(typeof input.enabled === "boolean" ? { enabled: input.enabled } : {}),
        updatedAt: new Date().toISOString(),
        updatedBy: actor
      };
      return { data: { ...state, remoteBackupTargets: targets.map((item) => item.id === input.targetId ? updated : item) }, result: toPublicRemoteTarget(updated) };
    });
  }

  async syncRemote(input: RemoteBackupSync, actor: string): Promise<RemoteBackupSyncResult[]> {
    const backup = await this.findBackup(input.backupId);
    const state = await this.store.read();
    const targets = (state.remoteBackupTargets ?? []).filter((target) => target.enabled && (!input.targetId || target.id === input.targetId));
    if (targets.length === 0) {
      throw new Error("没有可用的远程备份目标。");
    }
    const results: RemoteBackupSyncResult[] = [];
    for (const target of targets) {
      const result = await this.copyBackupToTarget(backup, target);
      results.push(result);
      await this.markRemoteTarget(target.id, result, actor);
    }
    return results;
  }

  async readBackupFile(backupId: string): Promise<{ backup: BackupSnapshot; content: string }> {
    const backup = await this.findBackup(backupId);
    const content = await readFile(backup.path, "utf8");
    return { backup, content };
  }

  async verifyBackup(backupId: string): Promise<BackupVerification> {
    const backup = await this.findBackup(backupId);
    const issues: string[] = [];
    let content = "";
    let sha256 = "";
    let sizeBytes = 0;
    let formatOk = false;
    let stateKeys: string[] = [];
    try {
      content = await readFile(backup.path, "utf8");
      const info = await stat(backup.path);
      sizeBytes = info.size;
      sha256 = createHash("sha256").update(content).digest("hex");
      stateKeys = Object.keys(parseBackupEnvelope(content)).sort();
      parseBackupState(content);
      formatOk = true;
    } catch (error) {
      issues.push(error instanceof Error ? error.message : "备份文件无法读取或解析。");
    }
    const sizeOk = sizeBytes === backup.sizeBytes;
    const checksumOk = Boolean(backup.sha256) && sha256 === backup.sha256;
    if (!sizeOk) {
      issues.push("备份文件大小与记录不一致。");
    }
    if (!backup.sha256) {
      issues.push("备份记录缺少 SHA-256 校验值。");
    } else if (!checksumOk) {
      issues.push("备份文件 SHA-256 与记录不一致。");
    }
    return {
      backupId: backup.id,
      fileName: backup.fileName,
      checkedAt: new Date().toISOString(),
      ok: issues.length === 0,
      sha256,
      ...(backup.sha256 ? { expectedSha256: backup.sha256 } : {}),
      sizeBytes,
      expectedSizeBytes: backup.sizeBytes,
      sizeOk,
      checksumOk,
      formatOk,
      stateKeys,
      issues
    };
  }

  async restoreBackup(backupId: string, actor: string): Promise<{ restored: BackupSnapshot; preRestore: BackupSnapshot }> {
    const { backup, content } = await this.readBackupFile(backupId);
    const restoredState = parseBackupState(content);
    const preRestore = await this.createBackup(actor);
    await this.store.write({
      ...restoredState,
      sessions: [],
      backups: [...(restoredState.backups ?? []), toBackupRecord(preRestore)].slice(-maxBackups),
      backupSchedule: restoredState.backupSchedule ?? { enabled: false, everyHours: 24 }
    });
    return { restored: backup, preRestore };
  }

  async createBackup(actor: string): Promise<BackupSnapshot> {
    const state = await this.store.read();
    const id = randomToken(10);
    const createdAt = new Date().toISOString();
    const fileName = `lxpanel-state-${createdAt.replace(/[:.]/gu, "-")}-${id}.json`;
    const backupDir = join(this.dataDir, "backups");
    const filePath = join(backupDir, fileName);
    await mkdir(backupDir, { recursive: true });
    const content = JSON.stringify({ kind: "lxpanel-state", createdAt, state }, null, 2);
    await writeFile(filePath, content, "utf8");
    const info = await stat(filePath);
    const record: BackupRecord = {
      id,
      fileName,
      path: filePath,
      sizeBytes: info.size,
      createdAt,
      createdBy: actor,
      kind: "state",
      sha256: createHash("sha256").update(content).digest("hex")
    };
    const removedPaths = await this.store.update((current) => {
      const backups = [...(current.backups ?? []), record];
      const retained = backups.slice(-maxBackups);
      return {
        data: { ...current, backups: retained },
        result: backups.slice(0, Math.max(0, backups.length - retained.length)).map((backup) => backup.path)
      };
    });
    await Promise.allSettled(removedPaths.map((path) => unlink(path)));
    return toBackup(record);
  }

  async runDueBackup(now = new Date()): Promise<BackupSnapshot | null> {
    const schedule = await this.getSchedule();
    if (!schedule.enabled || !schedule.nextRunAt || new Date(schedule.nextRunAt).getTime() > now.getTime()) {
      return null;
    }
    try {
      const backup = await this.createBackup("scheduler");
      await this.store.update((state) => ({
        data: {
          ...state,
          backupSchedule: {
            ...toScheduleRecord(toSchedule(state.backupSchedule)),
            lastRunAt: backup.createdAt,
            lastStatus: "success",
            nextRunAt: nextRunAt(now, schedule.everyHours)
          }
        },
        result: undefined
      }));
      return backup;
    } catch (error) {
      await this.store.update((state) => ({
        data: {
          ...state,
          backupSchedule: {
            ...toScheduleRecord(toSchedule(state.backupSchedule)),
            lastStatus: "failed",
            nextRunAt: nextRunAt(now, schedule.everyHours)
          }
        },
        result: undefined
      }));
      throw error;
    }
  }

  private async findBackup(backupId: string): Promise<BackupSnapshot> {
    const state = await this.store.read();
    const backup = (state.backups ?? []).find((item) => item.id === backupId);
    if (!backup) {
      throw new Error("备份不存在。");
    }
    return toBackup(backup);
  }

  private async copyBackupToTarget(backup: BackupSnapshot, target: RemoteBackupTargetRecord): Promise<RemoteBackupSyncResult> {
    if (target.type === "s3") {
      return this.putBackupToS3(backup, target);
    }
    const copiedPath = join(target.path, backup.fileName);
    try {
      await mkdir(target.path, { recursive: true });
      await copyFile(backup.path, copiedPath);
      if (backup.sha256) {
        await writeFile(`${copiedPath}.sha256`, `${backup.sha256}  ${backup.fileName}\n`, "utf8");
      }
      return { backupId: backup.id, targetId: target.id, targetName: target.name, status: "success", copiedPath };
    } catch (error) {
      return { backupId: backup.id, targetId: target.id, targetName: target.name, status: "failed", error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async putBackupToS3(backup: BackupSnapshot, target: RemoteBackupTargetRecord): Promise<RemoteBackupSyncResult> {
    try {
      if (!target.endpoint || !target.bucket || !target.accessKeyId) {
        throw new Error("S3 目标缺少 endpoint、bucket 或 accessKeyId。");
      }
      const secretAccessKey = this.readRemoteSecret(target);
      const content = await readFile(backup.path);
      const objectKey = buildObjectKey(target.prefix, backup.fileName);
      await putS3Object({ endpoint: target.endpoint, bucket: target.bucket, key: objectKey, region: target.region ?? "us-east-1", accessKeyId: target.accessKeyId, secretAccessKey, body: content });
      if (backup.sha256) {
        await putS3Object({ endpoint: target.endpoint, bucket: target.bucket, key: `${objectKey}.sha256`, region: target.region ?? "us-east-1", accessKeyId: target.accessKeyId, secretAccessKey, body: Buffer.from(`${backup.sha256}  ${backup.fileName}\n`, "utf8") });
      }
      return { backupId: backup.id, targetId: target.id, targetName: target.name, status: "success", copiedPath: `${target.endpoint}/${target.bucket}/${objectKey}`, objectKey };
    } catch (error) {
      return { backupId: backup.id, targetId: target.id, targetName: target.name, status: "failed", error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async markRemoteTarget(targetId: string, result: RemoteBackupSyncResult, actor: string): Promise<void> {
    await this.store.update((state) => ({
      data: {
        ...state,
        remoteBackupTargets: (state.remoteBackupTargets ?? []).map((target) => target.id === targetId ? toUpdatedRemoteTarget(target, result, actor) : target)
      },
      result: undefined
    }));
  }

  private toStoredRemoteSecret(value: string): Pick<RemoteBackupTargetRecord, "secretAccessKey" | "encryptedSecretAccessKey"> {
    return this.encryptionKey ? { encryptedSecretAccessKey: encryptSecret(value, this.encryptionKey) } : { secretAccessKey: value };
  }

  private readRemoteSecret(target: RemoteBackupTargetRecord): string {
    if (target.encryptedSecretAccessKey) {
      if (!this.encryptionKey) {
        throw new Error("远程备份目标密钥已加密，但当前未配置解密密钥。");
      }
      return decryptSecret(target.encryptedSecretAccessKey, this.encryptionKey);
    }
    if (target.secretAccessKey) {
      return target.secretAccessKey;
    }
    throw new Error("远程备份目标缺少访问密钥。");
  }
}

async function putS3Object(input: { endpoint: string; bucket: string; key: string; region: string; accessKeyId: string; secretAccessKey: string; body: Buffer }): Promise<void> {
  const url = new URL(`${trimEndSlash(input.endpoint)}/${encodePath(input.bucket)}/${encodeKey(input.key)}`);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/gu, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(input.body);
  const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["PUT", url.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${input.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(Buffer.from(canonicalRequest, "utf8"))].join("\n");
  const signature = hmac(signingKey(input.secretAccessKey, dateStamp, input.region), stringToSign, "hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetch(url, { method: "PUT", body: new Uint8Array(input.body), headers: { authorization, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate } });
  if (!response.ok) {
    throw new Error(`S3 PUT 失败: ${response.status} ${response.statusText}`);
  }
}

function signingKey(secret: string, dateStamp: string, region: string): Buffer {
  const dateKey = hmac(Buffer.from(`AWS4${secret}`, "utf8"), dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, "s3");
  return hmac(serviceKey, "aws4_request");
}

function hmac(key: Buffer, value: string): Buffer;
function hmac(key: Buffer, value: string, encoding: "hex"): string;
function hmac(key: Buffer, value: string, encoding?: "hex"): Buffer | string {
  const digest = createHmac("sha256", key).update(value, "utf8");
  return encoding ? digest.digest(encoding) : digest.digest();
}

function sha256Hex(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function buildObjectKey(prefix: string | undefined, fileName: string): string {
  return `${prefix?.replace(/^\/+|\/+$/gu, "") ?? "lxpanel"}/${fileName}`;
}

function trimEndSlash(value: string): string {
  return value.replace(/\/+$/u, "");
}

function encodePath(value: string): string {
  return encodeURIComponent(value).replace(/%2F/giu, "/");
}

function encodeKey(value: string): string {
  return value.split("/").map(encodeURIComponent).join("/");
}

function encryptSecret(value: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${encryptedSecretPrefix}:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${ciphertext.toString("base64url")}`;
}

function decryptSecret(value: string, key: Buffer): string {
  const [prefix, version, ivText, tagText, ciphertextText] = value.split(":");
  if (`${prefix}:${version}` !== encryptedSecretPrefix || !ivText || !tagText || !ciphertextText) {
    throw new Error("远程备份密钥格式不正确。");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8");
}

function toPublicRemoteTarget(target: RemoteBackupTargetRecord): RemoteBackupTarget {
  return {
    id: target.id,
    workspace: target.workspace ?? "default",
    name: target.name,
    type: target.type,
    path: target.path,
    ...(target.endpoint ? { endpoint: target.endpoint } : {}),
    ...(target.bucket ? { bucket: target.bucket } : {}),
    ...(target.prefix ? { prefix: target.prefix } : {}),
    ...(target.region ? { region: target.region } : {}),
    ...(target.accessKeyId ? { accessKeyId: target.accessKeyId } : {}),
    ...(target.secretAccessKey || target.encryptedSecretAccessKey || target.secretConfigured ? { secretConfigured: true } : {}),
    enabled: target.enabled,
    createdAt: target.createdAt,
    updatedAt: target.updatedAt,
    updatedBy: target.updatedBy,
    ...(target.lastSyncedAt ? { lastSyncedAt: target.lastSyncedAt } : {}),
    ...(target.lastStatus ? { lastStatus: target.lastStatus } : {}),
    ...(target.lastError ? { lastError: target.lastError } : {})
  };
}

function toUpdatedRemoteTarget(target: RemoteBackupTargetRecord, result: RemoteBackupSyncResult, actor: string): RemoteBackupTargetRecord {
  const updated: RemoteBackupTargetRecord = {
    ...target,
    lastSyncedAt: new Date().toISOString(),
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

function toBackup(record: BackupRecord): BackupSnapshot {
  return { ...record };
}

function toBackupRecord(snapshot: BackupSnapshot): BackupRecord {
  return {
    id: snapshot.id,
    fileName: snapshot.fileName,
    path: snapshot.path,
    sizeBytes: snapshot.sizeBytes,
    createdAt: snapshot.createdAt,
    createdBy: snapshot.createdBy,
    kind: snapshot.kind,
    ...(snapshot.sha256 ? { sha256: snapshot.sha256 } : {})
  };
}

function parseBackupState(content: string): PanelState {
  const state = parseBackupEnvelope(content);
  const initial = createInitialPanelState();
  return {
    ...initial,
    users: readArrayOrDefault<PanelState["users"]>(state.users, initial.users),
    sessions: [],
    apiTokens: readArrayOrDefault<NonNullable<PanelState["apiTokens"]>>(state.apiTokens, initial.apiTokens ?? []),
    connectors: readArrayOrDefault<PanelState["connectors"]>(state.connectors, initial.connectors),
    connectorCommands: readArrayOrDefault<NonNullable<PanelState["connectorCommands"]>>(state.connectorCommands, initial.connectorCommands ?? []),
    tasks: readArrayOrDefault<NonNullable<PanelState["tasks"]>>(state.tasks, initial.tasks ?? []),
    taskRuns: readArrayOrDefault<NonNullable<PanelState["taskRuns"]>>(state.taskRuns, initial.taskRuns ?? []),
    backups: readArrayOrDefault<NonNullable<PanelState["backups"]>>(state.backups, initial.backups ?? []),
    backupSchedule: readBackupSchedule(state.backupSchedule) ?? initial.backupSchedule ?? { enabled: false, everyHours: 24 },
    alertThresholds: readArrayOrDefault<NonNullable<PanelState["alertThresholds"]>>(state.alertThresholds, initial.alertThresholds ?? []),
    alertEvents: readArrayOrDefault<NonNullable<PanelState["alertEvents"]>>(state.alertEvents, initial.alertEvents ?? []),
    alertSilences: readArrayOrDefault<NonNullable<PanelState["alertSilences"]>>(state.alertSilences, initial.alertSilences ?? []),
    hosts: readArrayOrDefault<NonNullable<PanelState["hosts"]>>(state.hosts, initial.hosts ?? []),
    hostGroups: readArrayOrDefault<NonNullable<PanelState["hostGroups"]>>(state.hostGroups, initial.hostGroups ?? []),
    metricSamples: readArrayOrDefault<NonNullable<PanelState["metricSamples"]>>(state.metricSamples, initial.metricSamples ?? []),
    notificationChannels: readArrayOrDefault<NonNullable<PanelState["notificationChannels"]>>(state.notificationChannels, initial.notificationChannels ?? []),
    notificationDeliveries: readArrayOrDefault<NonNullable<PanelState["notificationDeliveries"]>>(state.notificationDeliveries, initial.notificationDeliveries ?? []),
    appDeployments: readArrayOrDefault<NonNullable<PanelState["appDeployments"]>>(state.appDeployments, initial.appDeployments ?? []),
    approvals: readArrayOrDefault<NonNullable<PanelState["approvals"]>>(state.approvals, initial.approvals ?? []),
    remoteBackupTargets: readArrayOrDefault<NonNullable<PanelState["remoteBackupTargets"]>>(state.remoteBackupTargets, initial.remoteBackupTargets ?? []),
    databaseConnections: readArrayOrDefault<NonNullable<PanelState["databaseConnections"]>>(state.databaseConnections, initial.databaseConnections ?? []),
    accessPolicies: readArrayOrDefault<NonNullable<PanelState["accessPolicies"]>>(state.accessPolicies, initial.accessPolicies ?? []),
    securityRemediationRuns: readArrayOrDefault<NonNullable<PanelState["securityRemediationRuns"]>>(state.securityRemediationRuns, initial.securityRemediationRuns ?? [])
  };
}

function parseBackupEnvelope(content: string): Record<string, unknown> {
  const parsed = JSON.parse(content) as unknown;
  if (!isRecord(parsed) || parsed.kind !== "lxpanel-state" || !isRecord(parsed.state)) {
    throw new Error("备份文件格式不正确。");
  }
  return parsed.state;
}

function readArrayOrDefault<TValue extends unknown[]>(value: unknown, fallback: TValue): TValue {
  return (Array.isArray(value) ? value : fallback) as TValue;
}

function readBackupSchedule(value: unknown): BackupScheduleRecord | undefined {
  if (!isRecord(value) || typeof value.enabled !== "boolean" || typeof value.everyHours !== "number") {
    return undefined;
  }
  return {
    enabled: value.enabled,
    everyHours: value.everyHours,
    ...(typeof value.nextRunAt === "string" ? { nextRunAt: value.nextRunAt } : {}),
    ...(typeof value.lastRunAt === "string" ? { lastRunAt: value.lastRunAt } : {}),
    ...(value.lastStatus === "success" || value.lastStatus === "failed" ? { lastStatus: value.lastStatus } : {}),
    ...(typeof value.updatedAt === "string" ? { updatedAt: value.updatedAt } : {}),
    ...(typeof value.updatedBy === "string" ? { updatedBy: value.updatedBy } : {})
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toSchedule(record?: BackupScheduleRecord): BackupSchedule {
  return {
    enabled: record?.enabled ?? false,
    everyHours: record?.everyHours ?? 24,
    ...(record?.nextRunAt ? { nextRunAt: record.nextRunAt } : {}),
    ...(record?.lastRunAt ? { lastRunAt: record.lastRunAt } : {}),
    ...(record?.lastStatus ? { lastStatus: record.lastStatus } : {}),
    ...(record?.updatedAt ? { updatedAt: record.updatedAt } : {}),
    ...(record?.updatedBy ? { updatedBy: record.updatedBy } : {})
  };
}

function toScheduleRecord(schedule: BackupSchedule): BackupScheduleRecord {
  return {
    enabled: schedule.enabled,
    everyHours: schedule.everyHours,
    ...(schedule.nextRunAt ? { nextRunAt: schedule.nextRunAt } : {}),
    ...(schedule.lastRunAt ? { lastRunAt: schedule.lastRunAt } : {}),
    ...(schedule.lastStatus ? { lastStatus: schedule.lastStatus } : {}),
    ...(schedule.updatedAt ? { updatedAt: schedule.updatedAt } : {}),
    ...(schedule.updatedBy ? { updatedBy: schedule.updatedBy } : {})
  };
}

function nextRunAt(from: Date, everyHours: number): string {
  return new Date(from.getTime() + everyHours * 60 * 60_000).toISOString();
}
