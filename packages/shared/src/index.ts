import { z } from "zod";

export const RoleSchema = z.enum(["owner", "operator", "viewer"]);
export type Role = z.infer<typeof RoleSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: RoleSchema,
  createdAt: z.string(),
  lastLoginAt: z.string().optional(),
  totpEnabled: z.boolean().default(false)
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

export const BackupRestoreResponseSchema = z.object({
  restored: BackupSnapshotSchema,
  preRestore: BackupSnapshotSchema
});
export type BackupRestoreResponse = z.infer<typeof BackupRestoreResponseSchema>;

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
  recommendations: z.array(z.string())
});
export type SecurityPosture = z.infer<typeof SecurityPostureSchema>;
