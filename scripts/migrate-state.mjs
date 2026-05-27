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
  importedAppTemplates: [],
  resourceApprovalPolicies: [],
  workspaces: [{ id: "default", name: "默认工作空间", createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(), updatedBy: "system" }],
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

for (const connection of state.databaseConnections ?? []) {
  connection.workspace ??= "default";
  connection.backupRetentionDays ??= 30;
  connection.scheduleEnabled ??= false;
  connection.scheduleEveryHours ??= 24;
}

for (const session of state.terminalSessions ?? []) {
  session.outputCursor ??= 0;
  session.streamUrl ??= `/api/platform/terminal-sessions/ws?sessionId=${encodeURIComponent(session.id)}`;
}

for (const repository of state.templateRepositories ?? []) {
  repository.importedTemplateIds ??= [];
}

for (const policy of state.resourceApprovalPolicies ?? []) {
  policy.workspace ??= "default";
}

if (state.license) {
  state.license.verificationStatus ??= state.license.offlineToken ? "unverified" : "unverified";
}

for (const target of state.remoteBackupTargets ?? []) {
  target.type ??= "filesystem";
  target.secretConfigured ??= Boolean(target.secretAccessKey || target.encryptedSecretAccessKey);
}

await mkdir(dirname(target), { recursive: true });
if (existsSync(target)) {
  await copyFile(target, `${target}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`);
}
await writeFile(target, `${JSON.stringify(state, null, 2)}\n`, "utf8");
console.log(`migrated ${source} -> ${target}`);
