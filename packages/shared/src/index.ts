import { z } from "zod";

export const RoleSchema = z.enum(["owner", "operator", "viewer"]);
export type Role = z.infer<typeof RoleSchema>;

export const ApiTokenScopes = [
  "system:read",
  "system:write",
  "audit:read",
  "audit:write",
  "approvals:read",
  "approvals:write",
  "security:read",
  "files:read",
  "files:write",
  "docker:read",
  "docker:write",
  "tasks:read",
  "tasks:write",
  "backups:read",
  "backups:write",
  "alerts:read",
  "alerts:write",
  "hosts:read",
  "hosts:write",
  "apps:read",
  "apps:write",
  "notifications:read",
  "notifications:write",
  "connectors:read",
  "connectors:write",
  "users:write"
] as const;
export const ApiTokenScopeSchema = z.enum(ApiTokenScopes);
export type ApiTokenScope = z.infer<typeof ApiTokenScopeSchema>;

export const ApiTokenStatusSchema = z.enum(["active", "expiring", "expired"]);
export type ApiTokenStatus = z.infer<typeof ApiTokenStatusSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: RoleSchema,
  createdAt: z.string(),
  lastLoginAt: z.string().optional(),
  totpEnabled: z.boolean().default(false),
  tokenScopes: z.array(ApiTokenScopeSchema).optional()
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const LoginRequestSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(8).max(256),
  totpCode: z.string().regex(/^\d{6}$/u).optional()
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.union([
  z.object({ user: AuthUserSchema }),
  z.object({ totpRequired: z.literal(true) })
]);
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const SetupRequestSchema = LoginRequestSchema.extend({
  inviteCode: z.string().max(128).optional()
});
export type SetupRequest = z.infer<typeof SetupRequestSchema>;

export const CreateUserSchema = LoginRequestSchema.extend({
  role: RoleSchema.default("operator")
});
export type CreateUser = z.infer<typeof CreateUserSchema>;

export const UpdateUserRoleSchema = z.object({
  userId: z.string().min(1),
  role: RoleSchema
});
export type UpdateUserRole = z.infer<typeof UpdateUserRoleSchema>;

export const ResetUserPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8).max(256)
});
export type ResetUserPassword = z.infer<typeof ResetUserPasswordSchema>;

export const ChangeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(8).max(256),
  newPassword: z.string().min(8).max(256)
});
export type ChangeOwnPassword = z.infer<typeof ChangeOwnPasswordSchema>;

export const TotpConfirmSchema = z.object({
  code: z.string().regex(/^\d{6}$/u)
});
export type TotpConfirm = z.infer<typeof TotpConfirmSchema>;

export const AuthSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  username: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  current: z.boolean().optional()
});
export type AuthSession = z.infer<typeof AuthSessionSchema>;

export const ApiTokenSchema = z.object({
  id: z.string(),
  name: z.string(),
  userId: z.string(),
  username: z.string(),
  role: RoleSchema,
  scopes: z.array(ApiTokenScopeSchema),
  status: ApiTokenStatusSchema,
  createdAt: z.string(),
  expiresAt: z.string().optional(),
  daysUntilExpiry: z.number().int().optional(),
  lastUsedAt: z.string().optional()
});
export type ApiToken = z.infer<typeof ApiTokenSchema>;

export const CreateApiTokenSchema = z.object({
  name: z.string().min(2).max(80),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  scopes: z.array(ApiTokenScopeSchema).min(1).max(ApiTokenScopes.length).optional()
});
export type CreateApiToken = z.infer<typeof CreateApiTokenSchema>;

export const CreatedApiTokenSchema = z.object({
  token: ApiTokenSchema,
  secret: z.string()
});
export type CreatedApiToken = z.infer<typeof CreatedApiTokenSchema>;

export const RevokeApiTokenSchema = z.object({
  tokenId: z.string().min(1)
});
export type RevokeApiToken = z.infer<typeof RevokeApiTokenSchema>;

export const ApprovalActionSchema = z.enum(["backup.restore", "audit.prune"]);
export type ApprovalAction = z.infer<typeof ApprovalActionSchema>;

export const ApprovalStatusSchema = z.enum(["pending", "approved", "rejected", "used", "expired"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalSchema = z.object({
  id: z.string(),
  action: ApprovalActionSchema,
  target: z.string(),
  reason: z.string(),
  status: ApprovalStatusSchema,
  requestedBy: z.string(),
  requestedAt: z.string(),
  expiresAt: z.string(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
  reviewComment: z.string().optional(),
  consumedBy: z.string().optional(),
  consumedAt: z.string().optional()
});
export type Approval = z.infer<typeof ApprovalSchema>;

export const ApprovalQuerySchema = z.object({
  status: ApprovalStatusSchema.optional(),
  action: ApprovalActionSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});
export type ApprovalQuery = z.infer<typeof ApprovalQuerySchema>;

export const CreateApprovalSchema = z.object({
  action: ApprovalActionSchema,
  target: z.string().min(1).max(240),
  reason: z.string().min(3).max(1000),
  expiresInMinutes: z.number().int().min(5).max(1440).default(120)
});
export type CreateApproval = z.infer<typeof CreateApprovalSchema>;

export const ApprovalDecisionSchema = z.object({
  approvalId: z.string().min(1),
  comment: z.string().max(1000).optional()
});
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;

export const SystemOverviewSchema = z.object({
  hostname: z.string(),
  platform: z.string(),
  arch: z.string(),
  uptimeSeconds: z.number(),
  loadAverage: z.tuple([z.number(), z.number(), z.number()]),
  cpu: z.object({
    model: z.string(),
    cores: z.number(),
    usagePercent: z.number()
  }),
  memory: z.object({
    totalBytes: z.number(),
    freeBytes: z.number(),
    usedPercent: z.number()
  }),
  networkInterfaces: z.array(z.object({
    name: z.string(),
    address: z.string(),
    family: z.string(),
    internal: z.boolean()
  }))
});
export type SystemOverview = z.infer<typeof SystemOverviewSchema>;

export const MetricSampleSchema = z.object({
  id: z.string(),
  hostId: z.string(),
  hostName: z.string(),
  time: z.string(),
  cpuPercent: z.number(),
  memoryPercent: z.number(),
  diskUsedPercent: z.number().optional()
});
export type MetricSample = z.infer<typeof MetricSampleSchema>;

export const ProcessInfoSchema = z.object({
  pid: z.number(),
  name: z.string(),
  cpuPercent: z.number(),
  memoryMb: z.number(),
  memoryPercent: z.number().optional()
});
export type ProcessInfo = z.infer<typeof ProcessInfoSchema>;

export const ServiceInfoSchema = z.object({
  name: z.string(),
  state: z.string(),
  enabled: z.string().optional(),
  description: z.string().optional()
});
export type ServiceInfo = z.infer<typeof ServiceInfoSchema>;

export const FileEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(["file", "directory", "other"]),
  sizeBytes: z.number(),
  modifiedAt: z.string()
});
export type FileEntry = z.infer<typeof FileEntrySchema>;

export const FileReadRequestSchema = z.object({
  path: z.string().min(1).max(500)
});
export type FileReadRequest = z.infer<typeof FileReadRequestSchema>;

export const FileContentSchema = z.object({
  path: z.string(),
  sizeBytes: z.number(),
  modifiedAt: z.string(),
  content: z.string(),
  truncated: z.boolean()
});
export type FileContent = z.infer<typeof FileContentSchema>;

export const FileWriteRequestSchema = z.object({
  path: z.string().min(1).max(500),
  content: z.string().max(524_288)
});
export type FileWriteRequest = z.infer<typeof FileWriteRequestSchema>;

export const CreateDirectoryRequestSchema = z.object({
  path: z.string().min(1).max(500)
});
export type CreateDirectoryRequest = z.infer<typeof CreateDirectoryRequestSchema>;

export const DeleteFileRequestSchema = z.object({
  path: z.string().min(1).max(500)
});
export type DeleteFileRequest = z.infer<typeof DeleteFileRequestSchema>;

export const LogRootSchema = z.object({
  path: z.string(),
  label: z.string()
});
export type LogRoot = z.infer<typeof LogRootSchema>;

export const LogTailSchema = z.object({
  root: z.string(),
  path: z.string(),
  sizeBytes: z.number(),
  modifiedAt: z.string(),
  lines: z.array(z.string()),
  truncated: z.boolean()
});
export type LogTail = z.infer<typeof LogTailSchema>;

export const AuditEventSchema = z.object({
  id: z.string(),
  time: z.string(),
  actor: z.string(),
  action: z.string(),
  target: z.string(),
  ip: z.string().optional(),
  status: z.enum(["success", "denied", "error"]),
  detail: z.string().optional()
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const AuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(5000).optional(),
  actor: z.string().max(80).optional(),
  action: z.string().max(120).optional(),
  status: z.enum(["success", "denied", "error"]).optional(),
  from: z.string().max(40).optional(),
  to: z.string().max(40).optional()
});
export type AuditQuery = z.infer<typeof AuditQuerySchema>;

export const AuditExportQuerySchema = AuditQuerySchema.extend({
  format: z.enum(["jsonl", "csv"]).default("jsonl")
});
export type AuditExportQuery = z.infer<typeof AuditExportQuerySchema>;

export const AuditRetentionSchema = z.object({
  retainDays: z.coerce.number().int().min(1).max(3650),
  approvalId: z.string().min(1)
});
export type AuditRetention = z.infer<typeof AuditRetentionSchema>;

export const AuditPruneResultSchema = z.object({
  removed: z.number(),
  remaining: z.number()
});
export type AuditPruneResult = z.infer<typeof AuditPruneResultSchema>;

export const AlertTypeSchema = z.enum(["cpu", "memory", "disk"]);
export type AlertType = z.infer<typeof AlertTypeSchema>;

export const AlertLevelSchema = z.enum(["warning", "critical"]);
export type AlertLevel = z.infer<typeof AlertLevelSchema>;

export const AlertThresholdSchema = z.object({
  type: AlertTypeSchema,
  warningPercent: z.number().min(1).max(100),
  criticalPercent: z.number().min(1).max(100),
  enabled: z.boolean(),
  updatedAt: z.string(),
  updatedBy: z.string()
}).superRefine((value, context) => {
  if (value.warningPercent >= value.criticalPercent) {
    context.addIssue({ code: "custom", path: ["warningPercent"], message: "警告阈值必须小于严重阈值。" });
  }
});
export type AlertThreshold = z.infer<typeof AlertThresholdSchema>;

export const UpdateAlertThresholdSchema = z.object({
  type: AlertTypeSchema,
  warningPercent: z.number().min(1).max(100),
  criticalPercent: z.number().min(1).max(100),
  enabled: z.boolean()
}).superRefine((value, context) => {
  if (value.warningPercent >= value.criticalPercent) {
    context.addIssue({ code: "custom", path: ["warningPercent"], message: "警告阈值必须小于严重阈值。" });
  }
});
export type UpdateAlertThreshold = z.infer<typeof UpdateAlertThresholdSchema>;

export const AlertEventSchema = z.object({
  id: z.string(),
  time: z.string(),
  type: AlertTypeSchema,
  level: AlertLevelSchema,
  target: z.string(),
  currentValue: z.number(),
  threshold: z.number(),
  message: z.string(),
  dismissedAt: z.string().optional(),
  dismissedBy: z.string().optional()
});
export type AlertEvent = z.infer<typeof AlertEventSchema>;

export const AlertSummarySchema = z.object({
  activeWarning: z.number(),
  activeCritical: z.number(),
  latest: AlertEventSchema.optional()
});
export type AlertSummary = z.infer<typeof AlertSummarySchema>;

export const DismissAlertSchema = z.object({
  alertId: z.string().min(1)
});
export type DismissAlert = z.infer<typeof DismissAlertSchema>;

export const NotificationChannelTypeSchema = z.enum(["webhook"]);
export type NotificationChannelType = z.infer<typeof NotificationChannelTypeSchema>;

export const NotificationChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: NotificationChannelTypeSchema,
  url: z.string().url(),
  enabled: z.boolean(),
  minLevel: AlertLevelSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string(),
  lastStatus: z.enum(["success", "failed"]).optional(),
  lastError: z.string().optional(),
  lastSentAt: z.string().optional()
});
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

export const CreateNotificationChannelSchema = z.object({
  name: z.string().min(2).max(80),
  type: NotificationChannelTypeSchema.default("webhook"),
  url: z.string().url().refine((value) => value.startsWith("http://") || value.startsWith("https://"), "仅支持 HTTP/HTTPS Webhook。"),
  enabled: z.boolean().default(true),
  minLevel: AlertLevelSchema.default("warning")
});
export type CreateNotificationChannel = z.infer<typeof CreateNotificationChannelSchema>;

export const UpdateNotificationChannelSchema = z.object({
  channelId: z.string().min(1),
  name: z.string().min(2).max(80).optional(),
  url: z.string().url().refine((value) => value.startsWith("http://") || value.startsWith("https://"), "仅支持 HTTP/HTTPS Webhook。").optional(),
  enabled: z.boolean().optional(),
  minLevel: AlertLevelSchema.optional()
});
export type UpdateNotificationChannel = z.infer<typeof UpdateNotificationChannelSchema>;

export const NotificationTestSchema = z.object({
  channelId: z.string().min(1)
});
export type NotificationTest = z.infer<typeof NotificationTestSchema>;

export const NotificationDeliverySchema = z.object({
  id: z.string(),
  channelId: z.string(),
  channelName: z.string(),
  alertId: z.string(),
  level: AlertLevelSchema,
  target: z.string(),
  status: z.enum(["success", "failed", "skipped"]),
  time: z.string(),
  error: z.string().optional()
});
export type NotificationDelivery = z.infer<typeof NotificationDeliverySchema>;

export const ConnectorSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  capabilities: z.array(z.string()),
  status: z.enum(["online", "stale", "offline"]),
  createdAt: z.string(),
  lastSeenAt: z.string().optional()
});
export type Connector = z.infer<typeof ConnectorSchema>;

export const HostStatusSchema = z.enum(["online", "stale", "offline", "unknown"]);
export type HostStatus = z.infer<typeof HostStatusSchema>;

export const HostSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().optional(),
  tags: z.array(z.string()),
  status: HostStatusSchema,
  connectorId: z.string().optional(),
  connectorName: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastSeenAt: z.string().optional()
});
export type Host = z.infer<typeof HostSchema>;

export const CreateHostSchema = z.object({
  name: z.string().min(2).max(80),
  address: z.string().max(200).optional(),
  tags: z.array(z.string().min(1).max(32)).max(16).default([]),
  connectorId: z.string().min(1).optional(),
  notes: z.string().max(500).optional()
});
export type CreateHost = z.infer<typeof CreateHostSchema>;

export const UpdateHostSchema = z.object({
  hostId: z.string().min(1),
  name: z.string().min(2).max(80).optional(),
  address: z.string().max(200).optional(),
  tags: z.array(z.string().min(1).max(32)).max(16).optional(),
  connectorId: z.string().min(1).optional(),
  notes: z.string().max(500).optional()
});
export type UpdateHost = z.infer<typeof UpdateHostSchema>;

export const CreateConnectorSchema = z.object({
  name: z.string().min(2).max(64),
  description: z.string().max(200).optional(),
  capabilities: z.array(z.string().min(1).max(64)).max(16).default([])
});
export type CreateConnector = z.infer<typeof CreateConnectorSchema>;

export const ConnectorHeartbeatSchema = z.object({
  capabilities: z.array(z.string()).default([]),
  version: z.string().max(64).optional()
});
export type ConnectorHeartbeat = z.infer<typeof ConnectorHeartbeatSchema>;

export const ConnectorCommandStatusSchema = z.enum(["queued", "running", "success", "failed"]);
export type ConnectorCommandStatus = z.infer<typeof ConnectorCommandStatusSchema>;

export const ConnectorCommandSchema = z.object({
  id: z.string(),
  connectorId: z.string(),
  connectorName: z.string().optional(),
  command: z.string(),
  args: z.array(z.string()),
  status: ConnectorCommandStatusSchema,
  createdAt: z.string(),
  createdBy: z.string(),
  claimedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  exitCode: z.number().optional(),
  stdoutTail: z.string().optional(),
  stderrTail: z.string().optional()
});
export type ConnectorCommand = z.infer<typeof ConnectorCommandSchema>;

export const CreateConnectorCommandSchema = z.object({
  connectorId: z.string().min(1),
  command: z.string().min(1).max(180).regex(/^[A-Za-z0-9_.:/\\-]+$/u),
  args: z.array(z.string().max(240)).max(24).default([])
});
export type CreateConnectorCommand = z.infer<typeof CreateConnectorCommandSchema>;

export const ConnectorCommandResultSchema = z.object({
  commandId: z.string().min(1),
  status: z.enum(["success", "failed"]),
  exitCode: z.number().int().optional(),
  stdoutTail: z.string().max(12_000).default(""),
  stderrTail: z.string().max(12_000).default("")
});
export type ConnectorCommandResult = z.infer<typeof ConnectorCommandResultSchema>;

export const DockerStatusSchema = z.object({
  available: z.boolean(),
  composeAvailable: z.boolean(),
  version: z.string().optional(),
  error: z.string().optional()
});
export type DockerStatus = z.infer<typeof DockerStatusSchema>;

export const DockerContainerSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string(),
  command: z.string().optional(),
  createdAt: z.string().optional(),
  status: z.string(),
  state: z.string(),
  ports: z.string().optional()
});
export type DockerContainer = z.infer<typeof DockerContainerSchema>;

export const DockerImageSchema = z.object({
  id: z.string(),
  repository: z.string(),
  tag: z.string(),
  createdSince: z.string().optional(),
  size: z.string()
});
export type DockerImage = z.infer<typeof DockerImageSchema>;

export const DockerContainerActionSchema = z.object({
  id: z.string().min(1).max(128).regex(/^[A-Za-z0-9_.:/@-]+$/u),
  action: z.enum(["start", "stop", "restart"])
});
export type DockerContainerAction = z.infer<typeof DockerContainerActionSchema>;

export const AppTemplateVariableSchema = z.object({
  key: z.string(),
  label: z.string(),
  defaultValue: z.string(),
  required: z.boolean().default(true)
});
export type AppTemplateVariable = z.infer<typeof AppTemplateVariableSchema>;

export const AppTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string(),
  image: z.string(),
  variables: z.array(AppTemplateVariableSchema)
});
export type AppTemplate = z.infer<typeof AppTemplateSchema>;

export const AppDeploymentStatusSchema = z.enum(["created", "running", "stopped", "failed"]);
export type AppDeploymentStatus = z.infer<typeof AppDeploymentStatusSchema>;

export const AppDeploymentSchema = z.object({
  id: z.string(),
  name: z.string(),
  templateId: z.string(),
  templateName: z.string(),
  status: AppDeploymentStatusSchema,
  composePath: z.string(),
  variables: z.record(z.string(), z.string()),
  createdAt: z.string(),
  createdBy: z.string(),
  lastActionAt: z.string().optional(),
  lastActionBy: z.string().optional(),
  lastOutputTail: z.string().optional()
});
export type AppDeployment = z.infer<typeof AppDeploymentSchema>;

export const CreateAppDeploymentSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().min(2).max(80).regex(/^[A-Za-z0-9_.-]+$/u),
  variables: z.record(z.string(), z.string().max(240)).default({}),
  autoStart: z.boolean().default(false)
});
export type CreateAppDeployment = z.infer<typeof CreateAppDeploymentSchema>;

export const AppDeploymentActionSchema = z.object({
  deploymentId: z.string().min(1),
  action: z.enum(["up", "down", "restart"])
});
export type AppDeploymentAction = z.infer<typeof AppDeploymentActionSchema>;

export const CreateTaskSchema = z.object({
  name: z.string().min(2).max(80),
  command: z.string().min(1).max(180).regex(/^[A-Za-z0-9_.:/\\-]+$/u),
  args: z.array(z.string().max(240)).max(24).default([]),
  cwd: z.string().max(260).optional(),
  timeoutSeconds: z.number().int().min(1).max(600).default(60),
  scheduleEnabled: z.boolean().optional(),
  scheduleEveryMinutes: z.number().int().min(1).max(10_080).optional()
}).superRefine((value, context) => {
  if (value.scheduleEnabled && !value.scheduleEveryMinutes) {
    context.addIssue({ code: "custom", path: ["scheduleEveryMinutes"], message: "启用计划时必须设置间隔。" });
  }
});
export type CreateTask = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskScheduleSchema = z.object({
  taskId: z.string().min(1),
  enabled: z.boolean(),
  everyMinutes: z.number().int().min(1).max(10_080).optional()
}).superRefine((value, context) => {
  if (value.enabled && !value.everyMinutes) {
    context.addIssue({ code: "custom", path: ["everyMinutes"], message: "启用计划时必须设置间隔。" });
  }
});
export type UpdateTaskSchedule = z.infer<typeof UpdateTaskScheduleSchema>;

export const PanelTaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()),
  cwd: z.string().optional(),
  timeoutSeconds: z.number(),
  createdAt: z.string(),
  createdBy: z.string(),
  lastRunAt: z.string().optional(),
  lastStatus: z.enum(["success", "failed"]).optional(),
  scheduleEnabled: z.boolean().optional(),
  scheduleEveryMinutes: z.number().optional(),
  nextRunAt: z.string().optional(),
  scheduleUpdatedAt: z.string().optional(),
  scheduleUpdatedBy: z.string().optional()
});
export type PanelTask = z.infer<typeof PanelTaskSchema>;

export const TaskRunSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  taskName: z.string(),
  actor: z.string(),
  startedAt: z.string(),
  finishedAt: z.string(),
  status: z.enum(["success", "failed"]),
  exitCode: z.number().optional(),
  stdoutTail: z.string(),
  stderrTail: z.string()
});
export type TaskRun = z.infer<typeof TaskRunSchema>;

export const TaskRunRequestSchema = z.object({
  taskId: z.string().min(1)
});
export type TaskRunRequest = z.infer<typeof TaskRunRequestSchema>;

export const BackupSnapshotSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  path: z.string(),
  sizeBytes: z.number(),
  createdAt: z.string(),
  createdBy: z.string(),
  kind: z.enum(["state"]),
  sha256: z.string().optional()
});
export type BackupSnapshot = z.infer<typeof BackupSnapshotSchema>;

export const BackupRequestSchema = z.object({
  backupId: z.string().min(1)
});
export type BackupRequest = z.infer<typeof BackupRequestSchema>;

export const BackupRestoreRequestSchema = BackupRequestSchema.extend({
  confirmation: z.literal("RESTORE"),
  approvalId: z.string().min(1)
});
export type BackupRestoreRequest = z.infer<typeof BackupRestoreRequestSchema>;

export const BackupRestoreResponseSchema = z.object({
  restored: BackupSnapshotSchema,
  preRestore: BackupSnapshotSchema
});
export type BackupRestoreResponse = z.infer<typeof BackupRestoreResponseSchema>;

export const BackupVerificationSchema = z.object({
  backupId: z.string(),
  fileName: z.string(),
  checkedAt: z.string(),
  ok: z.boolean(),
  sha256: z.string(),
  expectedSha256: z.string().optional(),
  sizeBytes: z.number(),
  expectedSizeBytes: z.number(),
  sizeOk: z.boolean(),
  checksumOk: z.boolean(),
  formatOk: z.boolean(),
  stateKeys: z.array(z.string()),
  issues: z.array(z.string())
});
export type BackupVerification = z.infer<typeof BackupVerificationSchema>;

export const BackupScheduleSchema = z.object({
  enabled: z.boolean(),
  everyHours: z.number().int().min(1).max(720),
  nextRunAt: z.string().optional(),
  lastRunAt: z.string().optional(),
  lastStatus: z.enum(["success", "failed"]).optional(),
  updatedAt: z.string().optional(),
  updatedBy: z.string().optional()
});
export type BackupSchedule = z.infer<typeof BackupScheduleSchema>;

export const UpdateBackupScheduleSchema = z.object({
  enabled: z.boolean(),
  everyHours: z.number().int().min(1).max(720).optional()
}).superRefine((value, context) => {
  if (value.enabled && !value.everyHours) {
    context.addIssue({ code: "custom", path: ["everyHours"], message: "启用计划时必须设置间隔。" });
  }
});
export type UpdateBackupSchedule = z.infer<typeof UpdateBackupScheduleSchema>;

export const SecurityCheckStatusSchema = z.enum(["secure", "warn", "critical", "info"]);
export type SecurityCheckStatus = z.infer<typeof SecurityCheckStatusSchema>;

export const SecurityCheckSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: SecurityCheckStatusSchema,
  detail: z.string()
});
export type SecurityCheck = z.infer<typeof SecurityCheckSchema>;

export const SecurityPostureSchema = z.object({
  setupRequired: z.boolean(),
  cookieSecure: z.boolean(),
  ipAllowlistEnabled: z.boolean(),
  ipAllowlist: z.array(z.string()),
  managedRoots: z.array(z.string()),
  logRoots: z.array(z.string()),
  connectorCount: z.number(),
  userCount: z.number(),
  taskCount: z.number(),
  backupCount: z.number(),
  checks: z.array(SecurityCheckSchema),
  recommendations: z.array(z.string())
});
export type SecurityPosture = z.infer<typeof SecurityPostureSchema>;
