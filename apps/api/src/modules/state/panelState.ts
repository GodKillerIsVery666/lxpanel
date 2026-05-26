import type { AccessPolicy, AlertEvent, AlertSilence, AlertThreshold, ApiTokenScope, AppDeployment, Approval, DatabaseConnection, Host, HostGroup, MetricSample, NotificationChannel, NotificationDelivery, RemoteBackupTarget, Role, SecurityRemediationRun } from "@lxpanel/shared";

export interface UserRecord {
  id: string;
  username: string;
  role: Role;
  passwordHash: string;
  totpSecret?: string;
  totpEnabled?: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface SessionRecord {
  id?: string;
  idHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface ApiTokenRecord {
  id: string;
  name: string;
  userId: string;
  role: Role;
  scopes?: ApiTokenScope[];
  tokenHash: string;
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
}

export interface ConnectorRecord {
  id: string;
  name: string;
  description?: string;
  capabilities: string[];
  tokenHash: string;
  createdAt: string;
  lastSeenAt?: string;
}

export interface ConnectorCommandRecord {
  id: string;
  connectorId: string;
  command: string;
  args: string[];
  status: "queued" | "running" | "success" | "failed";
  createdAt: string;
  createdBy: string;
  claimedAt?: string;
  finishedAt?: string;
  exitCode?: number;
  stdoutTail?: string;
  stderrTail?: string;
}

export interface TaskRecord {
  id: string;
  name: string;
  command: string;
  args: string[];
  cwd?: string;
  timeoutSeconds: number;
  createdAt: string;
  createdBy: string;
  lastRunAt?: string;
  lastStatus?: "success" | "failed";
  scheduleEnabled?: boolean;
  scheduleEveryMinutes?: number;
  nextRunAt?: string;
  scheduleUpdatedAt?: string;
  scheduleUpdatedBy?: string;
}

export interface TaskRunRecord {
  id: string;
  taskId: string;
  taskName: string;
  actor: string;
  startedAt: string;
  finishedAt: string;
  status: "success" | "failed";
  exitCode?: number;
  stdoutTail: string;
  stderrTail: string;
}

export interface BackupRecord {
  id: string;
  fileName: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
  createdBy: string;
  kind: "state";
  sha256?: string;
}

export interface BackupScheduleRecord {
  enabled: boolean;
  everyHours: number;
  nextRunAt?: string;
  lastRunAt?: string;
  lastStatus?: "success" | "failed";
  updatedAt?: string;
  updatedBy?: string;
}

export type AlertThresholdRecord = AlertThreshold;
export type AlertEventRecord = AlertEvent;
export type AlertSilenceRecord = AlertSilence;
export type HostRecord = Omit<Host, "status" | "connectorName" | "lastSeenAt">;
export type HostGroupRecord = HostGroup;
export type MetricSampleRecord = MetricSample;
export type NotificationChannelRecord = Omit<NotificationChannel, "url"> & { url?: string; encryptedUrl?: string };
export type NotificationDeliveryRecord = NotificationDelivery;
export interface AppDeploymentRevisionRecord {
  version: number;
  composePath: string;
  variables: Record<string, string>;
  createdAt: string;
  createdBy: string;
}

export type AppDeploymentRecord = AppDeployment & { revisions?: AppDeploymentRevisionRecord[] };
export type ApprovalRecord = Approval;
export type RemoteBackupTargetRecord = RemoteBackupTarget & { encryptedSecretAccessKey?: string; secretAccessKey?: string };
export type DatabaseConnectionRecord = Omit<DatabaseConnection, "maskedUrl"> & { encryptedUrl?: string; url?: string; lastBackupPath?: string };
export type AccessPolicyRecord = AccessPolicy;
export type SecurityRemediationRunRecord = SecurityRemediationRun;

export interface PanelState {
  users: UserRecord[];
  sessions: SessionRecord[];
  apiTokens?: ApiTokenRecord[];
  connectors: ConnectorRecord[];
  connectorCommands?: ConnectorCommandRecord[];
  tasks?: TaskRecord[];
  taskRuns?: TaskRunRecord[];
  backups?: BackupRecord[];
  backupSchedule?: BackupScheduleRecord;
  alertThresholds?: AlertThresholdRecord[];
  alertEvents?: AlertEventRecord[];
  alertSilences?: AlertSilenceRecord[];
  hosts?: HostRecord[];
  hostGroups?: HostGroupRecord[];
  metricSamples?: MetricSampleRecord[];
  notificationChannels?: NotificationChannelRecord[];
  notificationDeliveries?: NotificationDeliveryRecord[];
  appDeployments?: AppDeploymentRecord[];
  approvals?: ApprovalRecord[];
  remoteBackupTargets?: RemoteBackupTargetRecord[];
  databaseConnections?: DatabaseConnectionRecord[];
  accessPolicies?: AccessPolicyRecord[];
  securityRemediationRuns?: SecurityRemediationRunRecord[];
}

export function createInitialPanelState(): PanelState {
  return {
    users: [],
    sessions: [],
    apiTokens: [],
    connectors: [],
    connectorCommands: [],
    tasks: [],
    taskRuns: [],
    backups: [],
    backupSchedule: { enabled: false, everyHours: 24 },
    alertThresholds: createDefaultAlertThresholds("system", new Date(0).toISOString()),
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
    securityRemediationRuns: []
  };
}

export function createDefaultAlertThresholds(updatedBy: string, updatedAt: string): AlertThresholdRecord[] {
  return [
    { type: "cpu", warningPercent: 80, criticalPercent: 95, enabled: true, updatedAt, updatedBy },
    { type: "memory", warningPercent: 80, criticalPercent: 95, enabled: true, updatedAt, updatedBy },
    { type: "disk", warningPercent: 85, criticalPercent: 95, enabled: true, updatedAt, updatedBy }
  ];
}
