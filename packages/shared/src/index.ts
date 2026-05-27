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
  "databases:read",
  "databases:write",
  "platform:read",
  "platform:write",
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

export const ApprovalActionSchema = z.enum(["backup.restore", "audit.prune", "security.remediate", "resource.access"]);
export type ApprovalAction = z.infer<typeof ApprovalActionSchema>;

export const ApprovalStatusSchema = z.enum(["pending", "approved", "rejected", "used", "expired"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalReviewSchema = z.object({
  reviewedBy: z.string(),
  reviewedAt: z.string(),
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().optional()
});
export type ApprovalReview = z.infer<typeof ApprovalReviewSchema>;

export const ApprovalSchema = z.object({
  id: z.string(),
  action: ApprovalActionSchema,
  target: z.string(),
  reason: z.string(),
  status: ApprovalStatusSchema,
  requiredApprovals: z.number().int().min(1).max(5).default(1),
  approvedCount: z.number().int().min(0).default(0),
  reviews: z.array(ApprovalReviewSchema).default([]),
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
  requiredApprovals: z.number().int().min(1).max(5).default(1),
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

export const ConnectorMetricReportSchema = z.object({
  hostId: z.string().min(1).max(120),
  hostName: z.string().min(1).max(120),
  cpuPercent: z.number().min(0).max(100),
  memoryPercent: z.number().min(0).max(100),
  diskUsedPercent: z.number().min(0).max(100).optional()
});
export type ConnectorMetricReport = z.infer<typeof ConnectorMetricReportSchema>;

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
  detail: z.string().optional(),
  previousHash: z.string().optional(),
  chainHash: z.string().optional()
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

export const AuditPageQuerySchema = AuditQuerySchema.extend({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100)
});
export type AuditPageQuery = z.infer<typeof AuditPageQuerySchema>;

export const AuditPageSchema = z.object({
  events: z.array(AuditEventSchema),
  total: z.number().int().nonnegative(),
  nextCursor: z.string().optional()
});
export type AuditPage = z.infer<typeof AuditPageSchema>;

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

export const AuditIntegrityReportSchema = z.object({
  checkedAt: z.string(),
  total: z.number().int().nonnegative(),
  ok: z.boolean(),
  firstBrokenId: z.string().optional(),
  latestHash: z.string().optional(),
  issues: z.array(z.string())
});
export type AuditIntegrityReport = z.infer<typeof AuditIntegrityReportSchema>;

export const AuditExportPackageSchema = z.object({
  generatedAt: z.string(),
  format: z.enum(["jsonl", "csv"]),
  contentSha256: z.string(),
  manifestSha256: z.string(),
  integrity: AuditIntegrityReportSchema,
  eventCount: z.number().int().nonnegative(),
  manifest: z.object({
    product: z.literal("LXPanel"),
    version: z.string(),
    format: z.enum(["jsonl", "csv"]),
    generatedAt: z.string(),
    contentSha256: z.string(),
    latestHash: z.string().optional()
  })
});
export type AuditExportPackage = z.infer<typeof AuditExportPackageSchema>;

export const ComplianceReportSchema = z.object({
  generatedAt: z.string(),
  totalEvents: z.number().int().nonnegative(),
  actions: z.array(z.object({ action: z.string(), count: z.number().int().nonnegative() })),
  denied: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  integrity: AuditIntegrityReportSchema
});
export type ComplianceReport = z.infer<typeof ComplianceReportSchema>;

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

export const AlertSilenceSchema = z.object({
  id: z.string(),
  type: AlertTypeSchema.optional(),
  target: z.string().optional(),
  reason: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  createdAt: z.string(),
  createdBy: z.string()
});
export type AlertSilence = z.infer<typeof AlertSilenceSchema>;

export const CreateAlertSilenceSchema = z.object({
  type: AlertTypeSchema.optional(),
  target: z.string().min(1).max(120).optional(),
  reason: z.string().min(3).max(500),
  minutes: z.number().int().min(5).max(10_080).default(60)
});
export type CreateAlertSilence = z.infer<typeof CreateAlertSilenceSchema>;

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

export const NotificationSecretRotationSchema = z.object({
  previousSecret: z.string().min(8).max(512).optional()
});
export type NotificationSecretRotation = z.infer<typeof NotificationSecretRotationSchema>;

export const NotificationSecretRotationResultSchema = z.object({
  total: z.number().int().nonnegative(),
  rotated: z.number().int().nonnegative(),
  plaintextMigrated: z.number().int().nonnegative(),
  alreadyCurrent: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  issues: z.array(z.string())
});
export type NotificationSecretRotationResult = z.infer<typeof NotificationSecretRotationResultSchema>;

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
  version: z.string().optional(),
  upgradeStatus: z.enum(["current", "upgrade-available", "scheduled", "unsupported", "unknown"]).optional(),
  upgradeTargetVersion: z.string().optional(),
  upgradeChannel: z.string().optional(),
  lastUpgradeCheckAt: z.string().optional(),
  upgradeNotes: z.string().optional(),
  status: z.enum(["online", "stale", "offline"]),
  createdAt: z.string(),
  lastSeenAt: z.string().optional()
});
export type Connector = z.infer<typeof ConnectorSchema>;

export const ConnectorCompatibilitySchema = z.object({
  connectorId: z.string(),
  name: z.string(),
  version: z.string().optional(),
  status: z.enum(["online", "stale", "offline"]),
  compatibility: z.enum(["current", "upgrade-available", "scheduled", "unsupported", "unknown"]),
  upgradeTargetVersion: z.string(),
  rolloutEligible: z.boolean(),
  detail: z.string(),
  lastSeenAt: z.string().optional()
});
export type ConnectorCompatibility = z.infer<typeof ConnectorCompatibilitySchema>;

export const ConnectorVersionPolicySchema = z.object({
  generatedAt: z.string(),
  currentVersion: z.string(),
  minimumSupportedVersion: z.string(),
  recommendedVersion: z.string(),
  latestVersion: z.string(),
  channels: z.array(z.object({ name: z.string(), version: z.string(), rolloutPercent: z.number().int().min(0).max(100), notes: z.string().optional() })),
  connectors: z.array(ConnectorCompatibilitySchema)
});
export type ConnectorVersionPolicy = z.infer<typeof ConnectorVersionPolicySchema>;

export const ConnectorUpgradeRequestSchema = z.object({
  connectorId: z.string().min(1).optional(),
  channel: z.enum(["stable", "candidate"]).default("stable"),
  targetVersion: z.string().min(1).max(64).optional(),
  rolloutPercent: z.number().int().min(1).max(100).default(100)
});
export type ConnectorUpgradeRequest = z.infer<typeof ConnectorUpgradeRequestSchema>;

export const HostStatusSchema = z.enum(["online", "stale", "offline", "unknown"]);
export type HostStatus = z.infer<typeof HostStatusSchema>;

export const HostSchema = z.object({
  id: z.string(),
  workspace: z.string().min(2).max(80).default("default"),
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
  workspace: z.string().min(2).max(80).default("default"),
  name: z.string().min(2).max(80),
  address: z.string().max(200).optional(),
  tags: z.array(z.string().min(1).max(32)).max(16).default([]),
  connectorId: z.string().min(1).optional(),
  notes: z.string().max(500).optional()
});
export type CreateHost = z.infer<typeof CreateHostSchema>;

export const UpdateHostSchema = z.object({
  hostId: z.string().min(1),
  workspace: z.string().min(2).max(80).optional(),
  name: z.string().min(2).max(80).optional(),
  address: z.string().max(200).optional(),
  tags: z.array(z.string().min(1).max(32)).max(16).optional(),
  connectorId: z.string().min(1).optional(),
  notes: z.string().max(500).optional()
});
export type UpdateHost = z.infer<typeof UpdateHostSchema>;

export const HostGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  tags: z.array(z.string()),
  hostIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string()
});
export type HostGroup = z.infer<typeof HostGroupSchema>;

export const CreateHostGroupSchema = z.object({
  name: z.string().min(2).max(80),
  tags: z.array(z.string().min(1).max(32)).max(16).default([]),
  hostIds: z.array(z.string().min(1)).max(200).default([])
});
export type CreateHostGroup = z.infer<typeof CreateHostGroupSchema>;

export const HostBatchCommandSchema = z.object({
  hostIds: z.array(z.string().min(1)).min(1).max(100),
  command: z.string().min(1).max(180).regex(/^[A-Za-z0-9_.:/\-]+$/u),
  args: z.array(z.string().max(240)).max(24).default([]),
  workspace: z.string().min(2).max(80).default("default"),
  approvalId: z.string().min(1).optional()
});
export type HostBatchCommand = z.infer<typeof HostBatchCommandSchema>;

export const HostSshSessionRequestSchema = z.object({
  hostId: z.string().min(1),
  username: z.string().min(1).max(80).optional()
});
export type HostSshSessionRequest = z.infer<typeof HostSshSessionRequestSchema>;

export const CreateConnectorSchema = z.object({
  name: z.string().min(2).max(64),
  description: z.string().max(200).optional(),
  capabilities: z.array(z.string().min(1).max(64)).max(16).default([])
});
export type CreateConnector = z.infer<typeof CreateConnectorSchema>;

export const ConnectorHeartbeatSchema = z.object({
  capabilities: z.array(z.string()).default([]),
  version: z.string().max(64).optional(),
  metrics: ConnectorMetricReportSchema.optional()
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
  signaturePayload: z.string().optional(),
  signature: z.string().optional(),
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
  stderrTail: z.string().max(12_000).default(""),
  signature: z.string().max(256).optional()
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
  source: z.string().optional(),
  signature: z.string().optional(),
  verified: z.boolean().default(true),
  healthCheck: z.string().optional(),
  variables: z.array(AppTemplateVariableSchema)
});
export type AppTemplate = z.infer<typeof AppTemplateSchema>;

export const TemplateRepositoryIndexTemplateSchema = AppTemplateSchema.extend({
  compose: z.string().min(1).max(40_000)
});
export type TemplateRepositoryIndexTemplate = z.infer<typeof TemplateRepositoryIndexTemplateSchema>;

export const TemplateRepositoryIndexSchema = z.object({
  version: z.string().min(1).max(40),
  generatedAt: z.string().optional(),
  templates: z.array(TemplateRepositoryIndexTemplateSchema).max(500),
  signature: z.string().max(4000).optional(),
  publicKeyId: z.string().max(120).optional()
});
export type TemplateRepositoryIndex = z.infer<typeof TemplateRepositoryIndexSchema>;

export const ImportedAppTemplateSchema = TemplateRepositoryIndexTemplateSchema.extend({
  repositoryId: z.string(),
  importedAt: z.string(),
  indexSha256: z.string().optional()
});
export type ImportedAppTemplate = z.infer<typeof ImportedAppTemplateSchema>;

export const AppDeploymentStatusSchema = z.enum(["created", "running", "stopped", "failed"]);
export type AppDeploymentStatus = z.infer<typeof AppDeploymentStatusSchema>;

export const AppDeploymentSchema = z.object({
  id: z.string(),
  workspace: z.string().default("default"),
  name: z.string(),
  templateId: z.string(),
  templateName: z.string(),
  status: AppDeploymentStatusSchema,
  version: z.number().int().min(1).default(1),
  revisionCount: z.number().int().min(0).default(0),
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
  workspace: z.string().min(2).max(80).default("default"),
  templateId: z.string().min(1),
  name: z.string().min(2).max(80).regex(/^[A-Za-z0-9_.-]+$/u),
  variables: z.record(z.string(), z.string().max(240)).default({}),
  autoStart: z.boolean().default(false),
  approvalId: z.string().min(1).optional()
});
export type CreateAppDeployment = z.infer<typeof CreateAppDeploymentSchema>;

export const AppDeploymentActionSchema = z.object({
  deploymentId: z.string().min(1),
  action: z.enum(["up", "down", "restart"]),
  workspace: z.string().min(2).max(80).default("default"),
  approvalId: z.string().min(1).optional()
});
export type AppDeploymentAction = z.infer<typeof AppDeploymentActionSchema>;

export const UpdateAppDeploymentSchema = z.object({
  deploymentId: z.string().min(1),
  variables: z.record(z.string(), z.string().max(240)).default({}),
  autoRestart: z.boolean().default(false),
  workspace: z.string().min(2).max(80).default("default"),
  approvalId: z.string().min(1).optional()
});
export type UpdateAppDeployment = z.infer<typeof UpdateAppDeploymentSchema>;

export const RollbackAppDeploymentSchema = z.object({
  deploymentId: z.string().min(1),
  autoRestart: z.boolean().default(false),
  workspace: z.string().min(2).max(80).default("default"),
  approvalId: z.string().min(1).optional()
});
export type RollbackAppDeployment = z.infer<typeof RollbackAppDeploymentSchema>;

export const AppDeploymentHealthSchema = z.object({
  deploymentId: z.string(),
  status: z.enum(["healthy", "unhealthy", "unknown"]),
  checkedAt: z.string(),
  detail: z.string()
});
export type AppDeploymentHealth = z.infer<typeof AppDeploymentHealthSchema>;

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
  sha256: z.string().optional(),
  encryption: z.object({
    algorithm: z.literal("AES-256-GCM"),
    provider: z.enum(["local", "kms"]),
    keyVersion: z.number().int().min(1)
  }).optional()
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

export const RemoteBackupTargetSchema = z.object({
  id: z.string(),
  workspace: z.string().min(2).max(80).default("default"),
  name: z.string(),
  type: z.enum(["filesystem", "s3"]),
  path: z.string(),
  endpoint: z.string().url().optional(),
  bucket: z.string().optional(),
  prefix: z.string().optional(),
  region: z.string().optional(),
  accessKeyId: z.string().optional(),
  secretConfigured: z.boolean().optional(),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string(),
  lastSyncedAt: z.string().optional(),
  lastStatus: z.enum(["success", "failed"]).optional(),
  lastError: z.string().optional()
});
export type RemoteBackupTarget = z.infer<typeof RemoteBackupTargetSchema>;

export const CreateRemoteBackupTargetSchema = z.object({
  workspace: z.string().min(2).max(80).default("default"),
  name: z.string().min(2).max(80),
  type: z.enum(["filesystem", "s3"]).default("filesystem"),
  path: z.string().min(1).max(500),
  endpoint: z.string().url().optional(),
  bucket: z.string().min(1).max(120).optional(),
  prefix: z.string().max(240).optional(),
  region: z.string().min(1).max(80).optional(),
  accessKeyId: z.string().min(1).max(200).optional(),
  secretAccessKey: z.string().min(1).max(500).optional(),
  enabled: z.boolean().default(true)
}).superRefine((value, context) => {
  if (value.type === "s3") {
    for (const key of ["endpoint", "bucket", "accessKeyId", "secretAccessKey"] as const) {
      if (!value[key]) {
        context.addIssue({ code: "custom", path: [key], message: "S3 目标必须填写连接信息。" });
      }
    }
  }
});
export type CreateRemoteBackupTarget = z.infer<typeof CreateRemoteBackupTargetSchema>;

export const UpdateRemoteBackupTargetSchema = z.object({
  targetId: z.string().min(1),
  workspace: z.string().min(2).max(80).optional(),
  name: z.string().min(2).max(80).optional(),
  path: z.string().min(1).max(500).optional(),
  endpoint: z.string().url().optional(),
  bucket: z.string().min(1).max(120).optional(),
  prefix: z.string().max(240).optional(),
  region: z.string().min(1).max(80).optional(),
  accessKeyId: z.string().min(1).max(200).optional(),
  secretAccessKey: z.string().min(1).max(500).optional(),
  enabled: z.boolean().optional()
});
export type UpdateRemoteBackupTarget = z.infer<typeof UpdateRemoteBackupTargetSchema>;

export const RemoteBackupSyncSchema = z.object({
  backupId: z.string().min(1),
  targetId: z.string().min(1).optional()
});
export type RemoteBackupSync = z.infer<typeof RemoteBackupSyncSchema>;

export const RemoteBackupSyncResultSchema = z.object({
  backupId: z.string(),
  targetId: z.string(),
  targetName: z.string(),
  status: z.enum(["success", "failed"]),
  copiedPath: z.string().optional(),
  objectKey: z.string().optional(),
  error: z.string().optional()
});
export type RemoteBackupSyncResult = z.infer<typeof RemoteBackupSyncResultSchema>;

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

export const SecurityHardeningItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  risk: z.enum(["low", "medium", "high"]),
  status: SecurityCheckStatusSchema,
  recommendation: z.string(),
  command: z.string().optional()
});
export type SecurityHardeningItem = z.infer<typeof SecurityHardeningItemSchema>;

export const SecurityHardeningPlanSchema = z.object({
  generatedAt: z.string(),
  items: z.array(SecurityHardeningItemSchema)
});
export type SecurityHardeningPlan = z.infer<typeof SecurityHardeningPlanSchema>;

export const DatabaseTypeSchema = z.enum(["postgres", "mysql", "mariadb"]);
export type DatabaseType = z.infer<typeof DatabaseTypeSchema>;

export const DatabaseConnectionSchema = z.object({
  id: z.string(),
  workspace: z.string().default("default"),
  name: z.string(),
  type: DatabaseTypeSchema,
  maskedUrl: z.string(),
  enabled: z.boolean(),
  backupRetentionDays: z.number().int().min(1).max(3650).default(30),
  scheduleEnabled: z.boolean().default(false),
  scheduleEveryHours: z.number().int().min(1).max(720).default(24),
  nextBackupAt: z.string().optional(),
  lastScheduledBackupAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string(),
  lastBackupAt: z.string().optional(),
  lastStatus: z.enum(["success", "failed"]).optional(),
  lastError: z.string().optional(),
  lastRestoreDrillAt: z.string().optional(),
  lastRestoreDrillStatus: z.enum(["success", "failed", "skipped"]).optional()
});
export type DatabaseConnection = z.infer<typeof DatabaseConnectionSchema>;

export const CreateDatabaseConnectionSchema = z.object({
  workspace: z.string().min(2).max(80).default("default"),
  name: z.string().min(2).max(80),
  type: DatabaseTypeSchema.default("postgres"),
  url: z.string().url(),
  enabled: z.boolean().default(true),
  backupRetentionDays: z.number().int().min(1).max(3650).default(30),
  scheduleEnabled: z.boolean().default(false),
  scheduleEveryHours: z.number().int().min(1).max(720).default(24)
}).superRefine((value, context) => {
  if (!isSupportedDatabaseUrl(value.type, value.url)) {
    context.addIssue({ code: "custom", path: ["url"], message: "数据库 URL 协议与类型不匹配。" });
  }
});
export type CreateDatabaseConnection = z.infer<typeof CreateDatabaseConnectionSchema>;

export const UpdateDatabaseConnectionSchema = z.object({
  connectionId: z.string().min(1),
  workspace: z.string().min(2).max(80).optional(),
  name: z.string().min(2).max(80).optional(),
  url: z.string().url().optional(),
  backupRetentionDays: z.number().int().min(1).max(3650).optional(),
  scheduleEnabled: z.boolean().optional(),
  scheduleEveryHours: z.number().int().min(1).max(720).optional(),
  enabled: z.boolean().optional()
});
export type UpdateDatabaseConnection = z.infer<typeof UpdateDatabaseConnectionSchema>;

export const DatabaseBackupRequestSchema = z.object({
  connectionId: z.string().min(1),
  workspace: z.string().min(2).max(80).default("default"),
  approvalId: z.string().min(1).optional()
});
export type DatabaseBackupRequest = z.infer<typeof DatabaseBackupRequestSchema>;

export const DatabaseBackupResultSchema = z.object({
  connectionId: z.string(),
  filePath: z.string(),
  status: z.enum(["success", "failed"]),
  outputTail: z.string().optional(),
  error: z.string().optional()
});
export type DatabaseBackupResult = z.infer<typeof DatabaseBackupResultSchema>;

export const DatabaseBackupCleanupResultSchema = z.object({
  checkedAt: z.string(),
  removed: z.number().int().nonnegative(),
  retained: z.number().int().nonnegative(),
  issues: z.array(z.string())
});
export type DatabaseBackupCleanupResult = z.infer<typeof DatabaseBackupCleanupResultSchema>;

export const DatabaseRestoreDrillRequestSchema = z.object({
  connectionId: z.string().min(1)
});
export type DatabaseRestoreDrillRequest = z.infer<typeof DatabaseRestoreDrillRequestSchema>;

export const DatabaseRestoreDrillResultSchema = z.object({
  connectionId: z.string(),
  checkedAt: z.string(),
  status: z.enum(["success", "failed", "skipped"]),
  backupPath: z.string().optional(),
  outputTail: z.string().optional(),
  error: z.string().optional()
});
export type DatabaseRestoreDrillResult = z.infer<typeof DatabaseRestoreDrillResultSchema>;

export const ResourceTypeSchema = z.enum(["host", "app", "fileRoot", "database", "backupTarget", "workspace"]);
export type ResourceType = z.infer<typeof ResourceTypeSchema>;

export const AccessPolicySchema = z.object({
  id: z.string(),
  workspace: z.string(),
  resourceType: ResourceTypeSchema,
  resourceId: z.string(),
  role: RoleSchema,
  permissions: z.array(z.enum(["read", "write", "approve", "admin"])),
  createdAt: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string()
});
export type AccessPolicy = z.infer<typeof AccessPolicySchema>;

export const CreateAccessPolicySchema = z.object({
  workspace: z.string().min(2).max(80),
  resourceType: ResourceTypeSchema,
  resourceId: z.string().min(1).max(240),
  role: RoleSchema,
  permissions: z.array(z.enum(["read", "write", "approve", "admin"])).min(1).max(4)
});
export type CreateAccessPolicy = z.infer<typeof CreateAccessPolicySchema>;

export const AccessEvaluationSchema = z.object({
  workspace: z.string(),
  resourceType: ResourceTypeSchema,
  resourceId: z.string(),
  role: RoleSchema,
  permission: z.enum(["read", "write", "approve", "admin"]),
  allowed: z.boolean(),
  matchedPolicyId: z.string().optional()
});
export type AccessEvaluation = z.infer<typeof AccessEvaluationSchema>;

export const AccessEvaluationRequestSchema = z.object({
  workspace: z.string().min(2).max(80),
  resourceType: ResourceTypeSchema,
  resourceId: z.string().min(1).max(240),
  role: RoleSchema,
  permission: z.enum(["read", "write", "approve", "admin"])
});
export type AccessEvaluationRequest = z.infer<typeof AccessEvaluationRequestSchema>;

export const SecurityRemediationRequestSchema = z.object({
  itemId: z.string().min(1),
  dryRun: z.boolean().default(true),
  approvalId: z.string().min(1).optional()
});
export type SecurityRemediationRequest = z.infer<typeof SecurityRemediationRequestSchema>;

export const SecurityRemediationRunSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  dryRun: z.boolean(),
  status: z.enum(["planned", "success", "failed"]),
  command: z.string().optional(),
  outputTail: z.string().optional(),
  createdAt: z.string(),
  createdBy: z.string()
});
export type SecurityRemediationRun = z.infer<typeof SecurityRemediationRunSchema>;

export const TerminalSessionStatusSchema = z.enum(["opening", "connected", "closed", "failed"]);
export type TerminalSessionStatus = z.infer<typeof TerminalSessionStatusSchema>;

export const TerminalTranscriptLineSchema = z.object({
  time: z.string(),
  direction: z.enum(["input", "output", "system"]),
  line: z.string()
});
export type TerminalTranscriptLine = z.infer<typeof TerminalTranscriptLineSchema>;

export const TerminalSessionSchema = z.object({
  id: z.string(),
  hostId: z.string(),
  hostName: z.string(),
  connectorId: z.string(),
  commandId: z.string(),
  streamUrl: z.string().optional(),
  username: z.string().optional(),
  status: TerminalSessionStatusSchema,
  createdAt: z.string(),
  createdBy: z.string(),
  lastInputAt: z.string().optional(),
  lastOutputAt: z.string().optional(),
  outputCursor: z.number().int().nonnegative().default(0),
  transcriptTail: z.array(TerminalTranscriptLineSchema).default([])
});
export type TerminalSession = z.infer<typeof TerminalSessionSchema>;

export const TerminalReplaySchema = z.object({
  sessionId: z.string(),
  hostName: z.string(),
  generatedAt: z.string(),
  lineCount: z.number().int().nonnegative(),
  redacted: z.boolean(),
  lines: z.array(TerminalTranscriptLineSchema)
});
export type TerminalReplay = z.infer<typeof TerminalReplaySchema>;

export const CreateTerminalSessionSchema = z.object({
  hostId: z.string().min(1),
  username: z.string().min(1).max(80).optional(),
  rows: z.number().int().min(10).max(80).default(24),
  cols: z.number().int().min(40).max(240).default(100)
});
export type CreateTerminalSession = z.infer<typeof CreateTerminalSessionSchema>;

export const TerminalInputSchema = z.object({
  sessionId: z.string().min(1),
  input: z.string().min(1).max(2000)
});
export type TerminalInput = z.infer<typeof TerminalInputSchema>;

export const TerminalOutputSchema = z.object({
  sessionId: z.string().min(1),
  output: z.string().min(1).max(12_000),
  cursor: z.number().int().nonnegative().optional(),
  status: TerminalSessionStatusSchema.optional()
});
export type TerminalOutput = z.infer<typeof TerminalOutputSchema>;

export const TemplateRepositorySchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  trustMode: z.enum(["signed", "internal"]),
  publicKey: z.string().optional(),
  enabled: z.boolean(),
  templateCount: z.number().int().nonnegative().default(0),
  importedTemplateIds: z.array(z.string()).default([]),
  indexSha256: z.string().optional(),
  lastSyncAt: z.string().optional(),
  lastStatus: z.enum(["success", "failed", "pending"]).optional(),
  lastError: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string()
});
export type TemplateRepository = z.infer<typeof TemplateRepositorySchema>;

export const TemplateRepositoryRollbackSchema = z.object({
  repository: TemplateRepositorySchema,
  restoredTemplateIds: z.array(z.string()),
  rolledBackAt: z.string()
});
export type TemplateRepositoryRollback = z.infer<typeof TemplateRepositoryRollbackSchema>;

export const CreateTemplateRepositorySchema = z.object({
  name: z.string().min(2).max(80),
  url: z.string().url(),
  trustMode: z.enum(["signed", "internal"]).default("signed"),
  publicKey: z.string().max(2000).optional(),
  enabled: z.boolean().default(true)
});
export type CreateTemplateRepository = z.infer<typeof CreateTemplateRepositorySchema>;

export const LicenseInfoSchema = z.object({
  plan: z.enum(["community", "team", "enterprise"]),
  licensedTo: z.string(),
  expiresAt: z.string().optional(),
  maxHosts: z.number().int().min(1),
  maxUsers: z.number().int().min(1),
  maxApps: z.number().int().min(1),
  features: z.array(z.string()),
  offlineToken: z.string().optional(),
  publicKey: z.string().optional(),
  machineCode: z.string().optional(),
  issuer: z.string().optional(),
  verificationStatus: z.enum(["verified", "invalid", "unverified"]).default("unverified"),
  verifiedAt: z.string().optional(),
  verificationError: z.string().optional(),
  updatedAt: z.string(),
  updatedBy: z.string()
});
export type LicenseInfo = z.infer<typeof LicenseInfoSchema>;

export const LicenseStatusSchema = z.object({
  license: LicenseInfoSchema,
  usage: z.object({ hosts: z.number().int().nonnegative(), users: z.number().int().nonnegative(), apps: z.number().int().nonnegative() }),
  violations: z.array(z.string())
});
export type LicenseStatus = z.infer<typeof LicenseStatusSchema>;

export const UpdateLicenseSchema = z.object({
  plan: z.enum(["community", "team", "enterprise"]),
  licensedTo: z.string().min(1).max(120),
  expiresAt: z.string().optional(),
  maxHosts: z.number().int().min(1).max(100000),
  maxUsers: z.number().int().min(1).max(100000),
  maxApps: z.number().int().min(1).max(100000),
  features: z.array(z.string().min(1).max(80)).max(50).default([]),
  offlineToken: z.string().max(4000).optional(),
  publicKey: z.string().max(4000).optional()
});
export type UpdateLicense = z.infer<typeof UpdateLicenseSchema>;

export const LicenseVerificationResultSchema = z.object({
  ok: z.boolean(),
  checkedAt: z.string(),
  machineCode: z.string(),
  plan: z.enum(["community", "team", "enterprise"]).optional(),
  licensedTo: z.string().optional(),
  expiresAt: z.string().optional(),
  error: z.string().optional()
});
export type LicenseVerificationResult = z.infer<typeof LicenseVerificationResultSchema>;

export const ResourceApprovalPolicySchema = z.object({
  id: z.string(),
  workspace: z.string().default("default"),
  resourceType: ResourceTypeSchema,
  resourceId: z.string(),
  action: z.string(),
  requiredApprovals: z.number().int().min(1).max(5),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string()
});
export type ResourceApprovalPolicy = z.infer<typeof ResourceApprovalPolicySchema>;

export const CreateResourceApprovalPolicySchema = z.object({
  workspace: z.string().min(2).max(80).default("default"),
  resourceType: ResourceTypeSchema,
  resourceId: z.string().min(1).max(240),
  action: z.string().min(1).max(120),
  requiredApprovals: z.number().int().min(1).max(5).default(1),
  enabled: z.boolean().default(true)
});
export type CreateResourceApprovalPolicy = z.infer<typeof CreateResourceApprovalPolicySchema>;

export const ResourceApprovalCheckSchema = z.object({
  workspace: z.string().min(2).max(80).default("default"),
  resourceType: ResourceTypeSchema,
  resourceId: z.string().min(1).max(240),
  action: z.string().min(1).max(120),
  approvalId: z.string().min(1).optional()
});
export type ResourceApprovalCheck = z.infer<typeof ResourceApprovalCheckSchema>;

export const ResourceApprovalPrecheckSchema = z.object({
  required: z.boolean(),
  target: z.string(),
  requiredApprovals: z.number().int().min(0).max(5),
  policy: ResourceApprovalPolicySchema.optional()
});
export type ResourceApprovalPrecheck = z.infer<typeof ResourceApprovalPrecheckSchema>;

export const IdentityProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.literal("oidc"),
  issuerUrl: z.string().url(),
  authorizationEndpoint: z.string().url(),
  tokenEndpoint: z.string().url().optional(),
  jwksUri: z.string().url().optional(),
  clientId: z.string(),
  clientSecretConfigured: z.boolean().default(false),
  scopes: z.array(z.string()).default(["openid", "profile", "email"]),
  claimMappings: z.object({
    subject: z.string().default("sub"),
    email: z.string().default("email"),
    name: z.string().default("name"),
    groups: z.string().default("groups")
  }),
  requireMfa: z.boolean().default(true),
  breakGlassLocalLogin: z.boolean().default(true),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string()
});
export type IdentityProvider = z.infer<typeof IdentityProviderSchema>;

export const UpdateIdentityProviderSchema = z.object({
  name: z.string().min(2).max(80),
  issuerUrl: z.string().url(),
  authorizationEndpoint: z.string().url(),
  tokenEndpoint: z.string().url().optional(),
  jwksUri: z.string().url().optional(),
  clientId: z.string().min(1).max(200),
  clientSecret: z.string().min(1).max(1000).optional(),
  scopes: z.array(z.string().min(1).max(80)).min(1).max(12).default(["openid", "profile", "email"]),
  claimMappings: z.object({
    subject: z.string().min(1).max(80).default("sub"),
    email: z.string().min(1).max(80).default("email"),
    name: z.string().min(1).max(80).default("name"),
    groups: z.string().min(1).max(80).default("groups")
  }).default({ subject: "sub", email: "email", name: "name", groups: "groups" }),
  requireMfa: z.boolean().default(true),
  breakGlassLocalLogin: z.boolean().default(true),
  enabled: z.boolean().default(true)
});
export type UpdateIdentityProvider = z.infer<typeof UpdateIdentityProviderSchema>;

export const SsoReadinessSchema = z.object({
  configured: z.boolean(),
  enabled: z.boolean(),
  provider: IdentityProviderSchema.optional(),
  authorizationUrl: z.string().optional(),
  callbackPath: z.string(),
  localBreakGlassAvailable: z.boolean(),
  checks: z.array(z.object({ id: z.string(), title: z.string(), ready: z.boolean(), detail: z.string() }))
});
export type SsoReadiness = z.infer<typeof SsoReadinessSchema>;

export const ConnectorReleaseArtifactSchema = z.object({
  id: z.string(),
  channel: z.enum(["stable", "candidate"]),
  version: z.string(),
  platform: z.string(),
  url: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  signature: z.string().min(1).optional(),
  createdAt: z.string()
});
export type ConnectorReleaseArtifact = z.infer<typeof ConnectorReleaseArtifactSchema>;

export const ConnectorReleaseChannelSchema = z.object({
  name: z.enum(["stable", "candidate"]),
  version: z.string(),
  minimumVersion: z.string(),
  rolloutPercent: z.number().int().min(1).max(100),
  publicKeyId: z.string().optional(),
  artifacts: z.array(ConnectorReleaseArtifactSchema),
  updatedAt: z.string(),
  updatedBy: z.string()
});
export type ConnectorReleaseChannel = z.infer<typeof ConnectorReleaseChannelSchema>;

export const UpdateConnectorReleaseChannelSchema = z.object({
  name: z.enum(["stable", "candidate"]),
  version: z.string().min(1).max(80),
  minimumVersion: z.string().min(1).max(80),
  rolloutPercent: z.number().int().min(1).max(100),
  publicKeyId: z.string().max(120).optional(),
  artifacts: z.array(ConnectorReleaseArtifactSchema.omit({ channel: true }).extend({ channel: z.enum(["stable", "candidate"]).optional() })).min(1).max(12)
});
export type UpdateConnectorReleaseChannel = z.infer<typeof UpdateConnectorReleaseChannelSchema>;

export const ConnectorReleaseManifestSchema = z.object({
  generatedAt: z.string(),
  manifestSha256: z.string(),
  channels: z.array(ConnectorReleaseChannelSchema),
  verification: z.object({
    allArtifactsHaveSha256: z.boolean(),
    allArtifactsHaveSignature: z.boolean(),
    publicKeyIds: z.array(z.string()),
    installCommand: z.string()
  })
});
export type ConnectorReleaseManifest = z.infer<typeof ConnectorReleaseManifestSchema>;

export const BackupEncryptionPolicySchema = z.object({
  enabled: z.boolean(),
  algorithm: z.literal("AES-256-GCM"),
  provider: z.enum(["local", "kms"]),
  keyRef: z.string(),
  keyVersion: z.number().int().min(1),
  rotateEveryDays: z.number().int().min(1).max(730),
  nextRotationAt: z.string().optional(),
  lastRotatedAt: z.string().optional(),
  updatedAt: z.string(),
  updatedBy: z.string()
});
export type BackupEncryptionPolicy = z.infer<typeof BackupEncryptionPolicySchema>;

export const UpdateBackupEncryptionPolicySchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(["local", "kms"]).default("local"),
  keyRef: z.string().min(1).max(200).default("LXPANEL_SESSION_SECRET"),
  rotateEveryDays: z.number().int().min(1).max(730).default(90)
});
export type UpdateBackupEncryptionPolicy = z.infer<typeof UpdateBackupEncryptionPolicySchema>;

export const BackupKeyRotationPlanSchema = z.object({
  generatedAt: z.string(),
  currentKeyVersion: z.number().int().min(1),
  nextKeyVersion: z.number().int().min(2),
  due: z.boolean(),
  steps: z.array(z.object({ id: z.string(), title: z.string(), detail: z.string(), requiresApproval: z.boolean() }))
});
export type BackupKeyRotationPlan = z.infer<typeof BackupKeyRotationPlanSchema>;

export const AuditRetentionPolicySchema = z.object({
  id: z.string(),
  workspace: z.string().default("default"),
  eventType: z.string().default("*"),
  retainDays: z.number().int().min(1).max(3650),
  archiveBeforeDelete: z.boolean(),
  legalHold: z.boolean(),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string()
});
export type AuditRetentionPolicy = z.infer<typeof AuditRetentionPolicySchema>;

export const CreateAuditRetentionPolicySchema = z.object({
  workspace: z.string().min(2).max(80).default("default"),
  eventType: z.string().min(1).max(120).default("*"),
  retainDays: z.number().int().min(1).max(3650),
  archiveBeforeDelete: z.boolean().default(true),
  legalHold: z.boolean().default(false),
  enabled: z.boolean().default(true)
});
export type CreateAuditRetentionPolicy = z.infer<typeof CreateAuditRetentionPolicySchema>;

export const AuditRetentionEvaluationRequestSchema = z.object({
  workspace: z.string().min(2).max(80).default("default"),
  eventType: z.string().min(1).max(120).default("*"),
  eventCount: z.number().int().nonnegative().default(0)
});
export type AuditRetentionEvaluationRequest = z.infer<typeof AuditRetentionEvaluationRequestSchema>;

export const AuditRetentionEvaluationSchema = z.object({
  generatedAt: z.string(),
  workspace: z.string(),
  eventType: z.string(),
  retainDays: z.number().int().min(1).max(3650),
  archiveBeforeDelete: z.boolean(),
  legalHold: z.boolean(),
  pruneEligibleBefore: z.string(),
  matchedPolicy: AuditRetentionPolicySchema.optional(),
  estimatedEligibleEvents: z.number().int().nonnegative()
});
export type AuditRetentionEvaluation = z.infer<typeof AuditRetentionEvaluationSchema>;

export const PluginManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  entryPoint: z.string(),
  permissions: z.array(ApiTokenScopeSchema),
  signature: z.string().optional(),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string()
});
export type PluginManifest = z.infer<typeof PluginManifestSchema>;

export const RegisterPluginManifestSchema = z.object({
  id: z.string().min(2).max(80).regex(/^[A-Za-z0-9_.-]+$/u),
  name: z.string().min(2).max(80),
  version: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
  entryPoint: z.string().min(1).max(240),
  permissions: z.array(ApiTokenScopeSchema).min(1).max(20),
  signature: z.string().max(4000).optional(),
  enabled: z.boolean().default(false)
});
export type RegisterPluginManifest = z.infer<typeof RegisterPluginManifestSchema>;

export const PluginPermissionEvaluationRequestSchema = z.object({
  pluginId: z.string().min(1),
  requestedScopes: z.array(ApiTokenScopeSchema).min(1).max(20)
});
export type PluginPermissionEvaluationRequest = z.infer<typeof PluginPermissionEvaluationRequestSchema>;

export const PluginPermissionEvaluationSchema = z.object({
  pluginId: z.string(),
  allowed: z.boolean(),
  grantedScopes: z.array(ApiTokenScopeSchema),
  deniedScopes: z.array(ApiTokenScopeSchema),
  requiresSignature: z.boolean(),
  requiresApproval: z.boolean(),
  detail: z.string()
});
export type PluginPermissionEvaluation = z.infer<typeof PluginPermissionEvaluationSchema>;

export const HighAvailabilityPlanSchema = z.object({
  generatedAt: z.string(),
  mode: z.enum(["single-node", "active-passive", "active-active"]),
  topology: z.array(z.object({ role: z.string(), count: z.number().int().min(1), detail: z.string() })),
  checks: z.array(z.object({ id: z.string(), title: z.string(), ready: z.boolean(), detail: z.string() })),
  rolloutSteps: z.array(z.object({ id: z.string(), title: z.string(), detail: z.string() })),
  failoverRunbook: z.array(z.object({ id: z.string(), title: z.string(), command: z.string().optional(), detail: z.string() })),
  estimatedRecoveryMinutes: z.number().int().min(1)
});
export type HighAvailabilityPlan = z.infer<typeof HighAvailabilityPlanSchema>;

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string()
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const CreateWorkspaceSchema = z.object({
  id: z.string().min(2).max(80).regex(/^[A-Za-z0-9_.-]+$/u),
  name: z.string().min(2).max(80),
  description: z.string().max(300).optional()
});
export type CreateWorkspace = z.infer<typeof CreateWorkspaceSchema>;

export const WorkspaceOverviewSchema = z.object({
  generatedAt: z.string(),
  workspaces: z.array(WorkspaceSchema),
  counts: z.array(z.object({ workspace: z.string(), policies: z.number().int().nonnegative(), approvalPolicies: z.number().int().nonnegative(), hosts: z.number().int().nonnegative().default(0), apps: z.number().int().nonnegative(), databases: z.number().int().nonnegative(), remoteBackupTargets: z.number().int().nonnegative().default(0) }))
});
export type WorkspaceOverview = z.infer<typeof WorkspaceOverviewSchema>;

export const TenantReportSchema = z.object({
  generatedAt: z.string(),
  workspace: z.string(),
  range: z.object({ from: z.string().optional(), to: z.string().optional() }),
  counts: z.object({ hosts: z.number().int().nonnegative(), apps: z.number().int().nonnegative(), databases: z.number().int().nonnegative(), remoteBackupTargets: z.number().int().nonnegative(), approvals: z.number().int().nonnegative(), auditEvents: z.number().int().nonnegative(), errors: z.number().int().nonnegative(), denied: z.number().int().nonnegative() }),
  resources: z.array(z.object({ type: z.string(), count: z.number().int().nonnegative() })),
  topActions: z.array(z.object({ action: z.string(), count: z.number().int().nonnegative() })),
  approvalSla: z.object({ reviewed: z.number().int().nonnegative(), averageMinutes: z.number().nonnegative().optional(), pending: z.number().int().nonnegative() }),
  sha256: z.string()
});
export type TenantReport = z.infer<typeof TenantReportSchema>;

export const ConnectorUpgradePlanSchema = z.object({
  generatedAt: z.string(),
  channel: z.string(),
  targetVersion: z.string(),
  rolloutPercent: z.number().int().min(1).max(100),
  selected: z.array(ConnectorCompatibilitySchema),
  skipped: z.array(ConnectorCompatibilitySchema),
  commands: z.array(ConnectorCommandSchema)
});
export type ConnectorUpgradePlan = z.infer<typeof ConnectorUpgradePlanSchema>;

export const StateArchiveRequestSchema = z.object({
  dryRun: z.boolean().default(true),
  keepMetricSamples: z.number().int().min(100).max(5000).default(720),
  keepAlertEvents: z.number().int().min(50).max(5000).default(500)
});
export type StateArchiveRequest = z.infer<typeof StateArchiveRequestSchema>;

export const StateArchiveResultSchema = z.object({
  dryRun: z.boolean(),
  beforeBytes: z.number().int().nonnegative(),
  afterBytes: z.number().int().nonnegative(),
  removedMetricSamples: z.number().int().nonnegative(),
  removedAlertEvents: z.number().int().nonnegative(),
  removedNotificationDeliveries: z.number().int().nonnegative(),
  archivedRecords: z.number().int().nonnegative().default(0),
  archiveDriver: z.enum(["json-trim", "sqlite-table"]).default("json-trim"),
  generatedAt: z.string()
});
export type StateArchiveResult = z.infer<typeof StateArchiveResultSchema>;

export const StateArchiveRecordSchema = z.object({
  id: z.number().int().positive(),
  bucket: z.string(),
  recordId: z.string(),
  eventTime: z.string(),
  archivedAt: z.string(),
  payload: z.unknown()
});
export type StateArchiveRecord = z.infer<typeof StateArchiveRecordSchema>;

export const StateArchivePageSchema = z.object({
  generatedAt: z.string(),
  bucket: z.string().optional(),
  records: z.array(StateArchiveRecordSchema),
  archiveDriver: z.enum(["json-trim", "sqlite-table"]).default("json-trim")
});
export type StateArchivePage = z.infer<typeof StateArchivePageSchema>;

export const DiagnosticsBundleSchema = z.object({
  generatedAt: z.string(),
  version: z.string(),
  hostname: z.string(),
  stateBytes: z.number().int().nonnegative(),
  checks: z.array(z.object({ id: z.string(), title: z.string(), status: z.enum(["ok", "warn", "error"]), detail: z.string() })),
  openApiPaths: z.number().int().nonnegative(),
  frontendChecks: z.number().int().nonnegative(),
  sha256: z.string()
});
export type DiagnosticsBundle = z.infer<typeof DiagnosticsBundleSchema>;

export const InstallerGuideSchema = z.object({
  generatedAt: z.string(),
  steps: z.array(z.object({ id: z.string(), title: z.string(), command: z.string().optional(), detail: z.string() })),
  diagnostics: z.array(z.object({ id: z.string(), title: z.string(), ready: z.boolean(), detail: z.string() }))
});
export type InstallerGuide = z.infer<typeof InstallerGuideSchema>;

export const SdkExampleSchema = z.object({
  id: z.string(),
  language: z.enum(["curl", "powershell", "node"]),
  title: z.string(),
  requiredScopes: z.array(ApiTokenScopeSchema),
  snippet: z.string()
});
export type SdkExample = z.infer<typeof SdkExampleSchema>;

export const FrontendQualityReportSchema = z.object({
  generatedAt: z.string(),
  locale: z.enum(["zh-CN", "en-US"]),
  checks: z.array(z.object({ id: z.string(), title: z.string(), ready: z.boolean(), detail: z.string() }))
});
export type FrontendQualityReport = z.infer<typeof FrontendQualityReportSchema>;

export const CapacityPlanSchema = z.object({
  generatedAt: z.string(),
  stateBytes: z.number().int().nonnegative(),
  metricSamples: z.number().int().nonnegative(),
  hosts: z.number().int().nonnegative(),
  recommendations: z.array(z.string())
});
export type CapacityPlan = z.infer<typeof CapacityPlanSchema>;

export const UpgradePlanSchema = z.object({
  generatedAt: z.string(),
  currentVersion: z.string(),
  steps: z.array(z.object({ id: z.string(), title: z.string(), status: z.enum(["ready", "warn"]), detail: z.string() }))
});
export type UpgradePlan = z.infer<typeof UpgradePlanSchema>;

export const DeliveryChecklistSchema = z.object({
  generatedAt: z.string(),
  items: z.array(z.object({ id: z.string(), title: z.string(), ready: z.boolean(), detail: z.string() }))
});
export type DeliveryChecklist = z.infer<typeof DeliveryChecklistSchema>;

export const OpenApiSummarySchema = z.object({
  generatedAt: z.string(),
  paths: z.array(z.object({ method: z.string(), path: z.string(), scope: z.string().optional() })),
  webhookEvents: z.array(z.string())
});
export type OpenApiSummary = z.infer<typeof OpenApiSummarySchema>;

export const OpenApiDocumentSchema = z.record(z.string(), z.unknown());
export type OpenApiDocument = z.infer<typeof OpenApiDocumentSchema>;

function isSupportedDatabaseUrl(type: z.infer<typeof DatabaseTypeSchema>, value: string): boolean {
  if (type === "postgres") {
    return value.startsWith("postgres://") || value.startsWith("postgresql://");
  }
  return value.startsWith("mysql://") || value.startsWith("mariadb://");
}
