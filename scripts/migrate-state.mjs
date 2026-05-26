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
  hosts: [],
  metricSamples: [],
  notificationChannels: [],
  notificationDeliveries: [],
  appDeployments: [],
  approvals: [],
  remoteBackupTargets: [],
  databaseConnections: [],
  ...parsed
};

for (const approval of state.approvals ?? []) {
  approval.requiredApprovals ??= 1;
  approval.approvedCount ??= approval.status === "approved" ? approval.requiredApprovals : 0;
  approval.reviews ??= approval.reviewedBy ? [{ reviewedBy: approval.reviewedBy, reviewedAt: approval.reviewedAt ?? approval.requestedAt, decision: approval.status === "rejected" ? "rejected" : "approved", ...(approval.reviewComment ? { comment: approval.reviewComment } : {}) }] : [];
}

for (const deployment of state.appDeployments ?? []) {
  deployment.version ??= 1;
  deployment.revisionCount ??= deployment.revisions?.length ?? 0;
  deployment.revisions ??= [];
}

await mkdir(dirname(target), { recursive: true });
if (existsSync(target)) {
  await copyFile(target, `${target}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`);
}
await writeFile(target, `${JSON.stringify(state, null, 2)}\n`, "utf8");
console.log(`migrated ${source} -> ${target}`);
