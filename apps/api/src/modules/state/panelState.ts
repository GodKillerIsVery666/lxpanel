import type { AccessPolicy, AlertEvent, AlertSilence, AlertThreshold, ApiTokenScope, AppDeployment, Approval, AuditRetentionPolicy, BackupEncryptionPolicy, ConnectorReleaseChannel, DatabaseConnection, FederatedCluster, Host, HostGroup, IdentityProvider, ImportedAppTemplate, LicenseInfo, MetricSample, NotificationChannel, NotificationDelivery, PluginManifest, RemoteBackupTarget, ResourceApprovalPolicy, Role, SecurityRemediationRun, TemplateRepository, TerminalSession, Workspace } from "@lxpanel/shared";

export interface UserRecord {
  id: string;
  username: string;
  role: Role;
  passwordHash: string;
  email?: string;
  displayName?: string;
  authProvider?: "local" | "oidc";
  externalSubject?: string;
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
  version?: string;
  upgradeStatus?: "current" | "upgrade-available" | "scheduled" | "unsupported" | "unknown";
  upgradeTargetVersion?: string;
  upgradeChannel?: string;
  lastUpgradeCheckAt?: string;
  upgradeNotes?: string;
  createdAt: string;
  lastSeenAt?: string;
}

export interface ConnectorCommandRecord {
  id: string;
  connectorId: string;
  command: string;
  args: string[];
  signaturePayload?: string;
  signature?: string;
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
  encryption?: { algorithm: "AES-256-GCM"; provider: "local" | "kms"; keyVersion: number };
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

export type AppDeploymentRecord = Omit<AppDeployment, "workspace"> & { workspace?: string; revisions?: AppDeploymentRevisionRecord[] };
export type ApprovalRecord = Approval;
export type RemoteBackupTargetRecord = RemoteBackupTarget & { encryptedSecretAccessKey?: string; secretAccessKey?: string };
export type DatabaseConnectionRecord = Omit<DatabaseConnection, "maskedUrl" | "workspace"> & { workspace?: string; encryptedUrl?: string; url?: string; lastBackupPath?: string };
export type AccessPolicyRecord = AccessPolicy;
export type SecurityRemediationRunRecord = SecurityRemediationRun;
export type TerminalSessionRecord = TerminalSession;
export type TemplateRepositoryRecord = TemplateRepository;
export type ImportedAppTemplateRecord = ImportedAppTemplate;
export interface TemplateRepositorySnapshotRecord {
  id: string;
  repositoryId: string;
  repositoryName: string;
  templateIds: string[];
  templates: ImportedAppTemplateRecord[];
  indexSha256?: string;
  createdAt: string;
  createdBy: string;
}
export type LicenseInfoRecord = LicenseInfo;
export type ResourceApprovalPolicyRecord = ResourceApprovalPolicy;
export type WorkspaceRecord = Workspace;
export type IdentityProviderRecord = IdentityProvider & { clientSecret?: string };
export type ConnectorReleaseChannelRecord = ConnectorReleaseChannel;
export type BackupEncryptionPolicyRecord = BackupEncryptionPolicy;
export type AuditRetentionPolicyRecord = AuditRetentionPolicy;
export type PluginManifestRecord = PluginManifest;
export type FederatedClusterRecord = FederatedCluster;

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
  terminalSessions?: TerminalSessionRecord[];
  templateRepositories?: TemplateRepositoryRecord[];
  templateRepositorySnapshots?: TemplateRepositorySnapshotRecord[];
  importedAppTemplates?: ImportedAppTemplateRecord[];
  license?: LicenseInfoRecord;
  resourceApprovalPolicies?: ResourceApprovalPolicyRecord[];
  workspaces?: WorkspaceRecord[];
  identityProvider?: IdentityProviderRecord;
  connectorReleaseChannels?: ConnectorReleaseChannelRecord[];
  backupEncryptionPolicy?: BackupEncryptionPolicyRecord;
  auditRetentionPolicies?: AuditRetentionPolicyRecord[];
  pluginManifests?: PluginManifestRecord[];
  jwksCache?: Array<{ uri: string; keys: JwkCachedKey[]; fetchedAt: number }>;
  federatedClusters?: FederatedClusterRecord[];
}

export interface JwkCachedKey {
  kid?: string;
  kty: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
  x?: string;
  y?: string;
  crv?: string;
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
    securityRemediationRuns: [],
    terminalSessions: [],
    templateRepositories: [],
    templateRepositorySnapshots: [],
    importedAppTemplates: [],
    resourceApprovalPolicies: [],
    workspaces: [{ id: "default", name: "默认工作空间", createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(), updatedBy: "system" }],
    connectorReleaseChannels: createDefaultConnectorReleaseChannels(),
    backupEncryptionPolicy: createDefaultBackupEncryptionPolicy(),
    auditRetentionPolicies: createDefaultAuditRetentionPolicies(),
    pluginManifests: []
  };
}

export function createDefaultAlertThresholds(updatedBy: string, updatedAt: string): AlertThresholdRecord[] {
  return [
    { type: "cpu", warningPercent: 80, criticalPercent: 95, enabled: true, updatedAt, updatedBy },
    { type: "memory", warningPercent: 80, criticalPercent: 95, enabled: true, updatedAt, updatedBy },
    { type: "disk", warningPercent: 85, criticalPercent: 95, enabled: true, updatedAt, updatedBy }
  ];
}

export function createDefaultConnectorReleaseChannels(): ConnectorReleaseChannelRecord[] {
  const updatedAt = new Date(0).toISOString();
  return [
    {
      name: "stable",
      version: "node-agent-0.2",
      minimumVersion: "node-agent-0.1",
      rolloutPercent: 100,
      publicKeyId: "lxpanel-connector-release-v1",
      artifacts: [
        {
          id: "connector-node-win-x64",
          channel: "stable",
          version: "node-agent-0.2",
          platform: "win32-x64",
          url: "release/connectors/lxpanel-connector-node-agent-0.2-win-x64.zip",
          sha256: "9b1d4f0f5d70e0c4a4f9ec5f0b785e53c8b81ecfe6017f8feef65f2f33678491",
          signature: "lxpanel-connector-release-v1.signature",
          createdAt: updatedAt
        }
      ],
      updatedAt,
      updatedBy: "system"
    },
    {
      name: "candidate",
      version: "node-agent-0.3-rc1",
      minimumVersion: "node-agent-0.1",
      rolloutPercent: 25,
      publicKeyId: "lxpanel-connector-release-v1",
      artifacts: [
        {
          id: "connector-node-win-x64-rc",
          channel: "candidate",
          version: "node-agent-0.3-rc1",
          platform: "win32-x64",
          url: "release/connectors/lxpanel-connector-node-agent-0.3-rc1-win-x64.zip",
          sha256: "3ddf8ab09aef7a94a885a7ac2d64e61b8f4a23bd8d9e3b80d655efdf50aa2137",
          signature: "lxpanel-connector-release-v1.signature",
          createdAt: updatedAt
        }
      ],
      updatedAt,
      updatedBy: "system"
    }
  ];
}

export function createDefaultBackupEncryptionPolicy(): BackupEncryptionPolicyRecord {
  return { enabled: false, algorithm: "AES-256-GCM", provider: "local", keyRef: "LXPANEL_SESSION_SECRET", keyVersion: 1, rotateEveryDays: 90, nextRotationAt: new Date(90 * 24 * 60 * 60_000).toISOString(), updatedAt: new Date(0).toISOString(), updatedBy: "system" };
}

export function createDefaultAuditRetentionPolicies(): AuditRetentionPolicyRecord[] {
  const now = new Date(0).toISOString();
  return [{ id: "default-audit-retention", workspace: "default", eventType: "*", retainDays: 180, archiveBeforeDelete: true, legalHold: false, enabled: true, createdAt: now, updatedAt: now, updatedBy: "system" }];
}
