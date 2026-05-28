import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const source = resolve(process.argv[2] ?? "data/state.json");
const target = resolve(process.argv[3] ?? source);

if (!existsSync(source)) {
  console.error(`state file not found: ${source}`);
  process.exit(1);
}

const parsed = JSON.parse(readFileSync(source, "utf8"));
const state = {
  users: [],
  sessions: [],
  apiTokens: [],
  connectors: [],
  connectorCommands: [],
  tasks: [],
  taskRuns: [],
  backups: [],
  backupSchedule: { enabled: false, everyHours: 24 },
  alertThresholds: [],
  alertEvents: [],
  alertSilences: [],
  hosts: [],
  hostGroups: [],
  metricSamples: [],
  notificationChannels: [],
  notificationDeliveries: [],
  appDeployments: [],
  approvals: [],
  remoteBackupTargets: [],
  databaseConnections: [],
  accessPolicies: [],
  securityRemediationRuns: [],
  terminalSessions: [],
  templateRepositories: [],
  templateRepositorySnapshots: [],
  importedAppTemplates: [],
  resourceApprovalPolicies: [],
  workspaces: [{ id: "default", name: "默认工作空间", createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(), updatedBy: "system" }],
  connectorReleaseChannels: defaultConnectorReleaseChannels(),
  backupEncryptionPolicy: defaultBackupEncryptionPolicy(),
  auditRetentionPolicies: defaultAuditRetentionPolicies(),
  pluginManifests: [],
  ...parsed
};

if (!(state.workspaces ?? []).some((workspace) => workspace.id === "default")) {
  state.workspaces = [{ id: "default", name: "默认工作空间", createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(), updatedBy: "system" }, ...(state.workspaces ?? [])];
}

for (const approval of state.approvals ?? []) {
  approval.requiredApprovals ??= 1;
  approval.approvedCount ??= approval.status === "approved" ? approval.requiredApprovals : 0;
  approval.reviews ??= approval.reviewedBy ? [{ reviewedBy: approval.reviewedBy, reviewedAt: approval.reviewedAt ?? approval.requestedAt, decision: approval.status === "rejected" ? "rejected" : "approved", ...(approval.reviewComment ? { comment: approval.reviewComment } : {}) }] : [];
}

for (const deployment of state.appDeployments ?? []) {
  deployment.workspace ??= "default";
  deployment.version ??= 1;
  deployment.revisionCount ??= deployment.revisions?.length ?? 0;
  deployment.revisions ??= [];
}

for (const host of state.hosts ?? []) {
  host.workspace ??= "default";
}

for (const connection of state.databaseConnections ?? []) {
  connection.workspace ??= "default";
  connection.backupRetentionDays ??= 30;
  connection.scheduleEnabled ??= false;
  connection.scheduleEveryHours ??= 24;
}

for (const user of state.users ?? []) {
  user.authProvider ??= user.externalSubject ? "oidc" : "local";
}

for (const session of state.terminalSessions ?? []) {
  session.outputCursor ??= 0;
  session.streamUrl ??= `/api/platform/terminal-sessions/ws?sessionId=${encodeURIComponent(session.id)}`;
}

for (const repository of state.templateRepositories ?? []) {
  repository.importedTemplateIds ??= [];
}

state.templateRepositorySnapshots ??= [];

for (const policy of state.resourceApprovalPolicies ?? []) {
  policy.workspace ??= "default";
}

if (state.license) {
  state.license.verificationStatus ??= state.license.offlineToken ? "unverified" : "unverified";
}

for (const target of state.remoteBackupTargets ?? []) {
  target.workspace ??= "default";
  target.type ??= "filesystem";
  target.secretConfigured ??= Boolean(target.secretAccessKey || target.encryptedSecretAccessKey);
}

state.connectorReleaseChannels ??= defaultConnectorReleaseChannels();
state.backupEncryptionPolicy ??= defaultBackupEncryptionPolicy();
state.auditRetentionPolicies ??= defaultAuditRetentionPolicies();
state.pluginManifests ??= [];

await mkdir(dirname(target), { recursive: true });
if (existsSync(target)) {
  await copyFile(target, `${target}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`);
}
await writeFile(target, `${JSON.stringify(state, null, 2)}\n`, "utf8");
console.log(`migrated ${source} -> ${target}`);

function defaultConnectorReleaseChannels() {
  const updatedAt = new Date(0).toISOString();
  return [
    {
      name: "stable",
      version: "node-agent-0.2",
      minimumVersion: "node-agent-0.1",
      rolloutPercent: 100,
      publicKeyId: "lxpanel-connector-release-v1",
      artifacts: [{ id: "connector-node-win-x64", channel: "stable", version: "node-agent-0.2", platform: "win32-x64", url: "release/connectors/lxpanel-connector-node-agent-0.2-win-x64.zip", sha256: "9b1d4f0f5d70e0c4a4f9ec5f0b785e53c8b81ecfe6017f8feef65f2f33678491", signature: "lxpanel-connector-release-v1.signature", createdAt: updatedAt }],
      updatedAt,
      updatedBy: "system"
    },
    {
      name: "candidate",
      version: "node-agent-0.3-rc1",
      minimumVersion: "node-agent-0.1",
      rolloutPercent: 25,
      publicKeyId: "lxpanel-connector-release-v1",
      artifacts: [{ id: "connector-node-win-x64-rc", channel: "candidate", version: "node-agent-0.3-rc1", platform: "win32-x64", url: "release/connectors/lxpanel-connector-node-agent-0.3-rc1-win-x64.zip", sha256: "3ddf8ab09aef7a94a885a7ac2d64e61b8f4a23bd8d9e3b80d655efdf50aa2137", signature: "lxpanel-connector-release-v1.signature", createdAt: updatedAt }],
      updatedAt,
      updatedBy: "system"
    }
  ];
}

function defaultBackupEncryptionPolicy() {
  return { enabled: false, algorithm: "AES-256-GCM", provider: "local", keyRef: "LXPANEL_SESSION_SECRET", keyVersion: 1, rotateEveryDays: 90, nextRotationAt: new Date(90 * 24 * 60 * 60_000).toISOString(), updatedAt: new Date(0).toISOString(), updatedBy: "system" };
}

function defaultAuditRetentionPolicies() {
  const now = new Date(0).toISOString();
  return [{ id: "default-audit-retention", workspace: "default", eventType: "*", retainDays: 180, archiveBeforeDelete: true, legalHold: false, enabled: true, createdAt: now, updatedAt: now, updatedBy: "system" }];
}
