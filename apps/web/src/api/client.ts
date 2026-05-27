import { z } from "zod";
import {
  AuditEventSchema,
  AuditExportQuerySchema,
  AuditExportPackageSchema,
  AuditPageQuerySchema,
  AuditPageSchema,
  AuditIntegrityReportSchema,
  AuditPruneResultSchema,
  AuditQuerySchema,
  AuditRetentionEvaluationSchema,
  AuditRetentionPolicySchema,
  AuditRetentionSchema,
  AlertEventSchema,
  AlertSilenceSchema,
  AlertSummarySchema,
  AlertThresholdSchema,
  AccessEvaluationRequestSchema,
  AccessEvaluationSchema,
  AccessPolicySchema,
  AppDeploymentHealthSchema,
  AppDeploymentActionSchema,
  AppDeploymentSchema,
  AppTemplateSchema,
  CapacityPlanSchema,
  ApiTokenSchema,
  ApprovalDecisionSchema,
  ApprovalQuerySchema,
  ApprovalSchema,
  BackupScheduleSchema,
  BackupRequestSchema,
  BackupRestoreRequestSchema,
  BackupRestoreResponseSchema,
  BackupEncryptionPolicySchema,
  BackupKeyRotationPlanSchema,
  BackupVerificationSchema,
  ComplianceReportSchema,
  CreateRemoteBackupTargetSchema,
  AuthSessionSchema,
  ConnectorCommandSchema,
  ConnectorReleaseChannelSchema,
  ConnectorReleaseManifestSchema,
  ConnectorUpgradePlanSchema,
  ConnectorUpgradeRequestSchema,
  ConnectorVersionPolicySchema,
  AuthUserSchema,
  BackupSnapshotSchema,
  ChangeOwnPasswordSchema,
  ConnectorSchema,
  CreateApiTokenSchema,
  CreateApprovalSchema,
  CreateAccessPolicySchema,
  CreateResourceApprovalPolicySchema,
  CreateTemplateRepositorySchema,
  CreateTerminalSessionSchema,
  CreateWorkspaceSchema,
  CreateAlertSilenceSchema,
  CreateDatabaseConnectionSchema,
  CreateDirectoryRequestSchema,
  CreateHostGroupSchema,
  CreateHostSchema,
  CreateAppDeploymentSchema,
  CreateConnectorCommandSchema,
  CreateNotificationChannelSchema,
  CreateTaskSchema,
  CreateUserSchema,
  CreatedApiTokenSchema,
  DatabaseBackupRequestSchema,
  DatabaseBackupCleanupResultSchema,
  DatabaseBackupResultSchema,
  DatabaseConnectionSchema,
  DatabaseRestoreDrillRequestSchema,
  DatabaseRestoreDrillResultSchema,
  DeliveryChecklistSchema,
  DiagnosticsBundleSchema,
  DismissAlertSchema,
  DeleteFileRequestSchema,
  CreateConnectorSchema,
  DockerContainerActionSchema,
  DockerContainerSchema,
  DockerImageSchema,
  DockerStatusSchema,
  FileEntrySchema,
  FileContentSchema,
  FileReadRequestSchema,
  FileWriteRequestSchema,
  HostSchema,
  HighAvailabilityPlanSchema,
  HostBatchCommandSchema,
  HostGroupSchema,
  HostSshSessionRequestSchema,
  FrontendQualityReportSchema,
  InstallerGuideSchema,
  IdentityProviderSchema,
  LicenseStatusSchema,
  LicenseVerificationResultSchema,
  LogRootSchema,
  LogTailSchema,
  LoginResponseSchema,
  LoginRequestSchema,
  MetricSampleSchema,
  NotificationChannelSchema,
  NotificationDeliverySchema,
  NotificationSecretRotationResultSchema,
  NotificationSecretRotationSchema,
  OpenApiSummarySchema,
  OpenApiDocumentSchema,
  NotificationTestSchema,
  PluginManifestSchema,
  PluginPermissionEvaluationSchema,
  ProcessInfoSchema,
  RevokeApiTokenSchema,
  ResourceApprovalPolicySchema,
  ResourceApprovalCheckSchema,
  ResourceApprovalPrecheckSchema,
  RollbackAppDeploymentSchema,
  SecurityHardeningPlanSchema,
  SdkExampleSchema,
  SecurityRemediationRequestSchema,
  SecurityRemediationRunSchema,
  SecurityPostureSchema,
  ServiceInfoSchema,
  SetupRequestSchema,
  SsoReadinessSchema,
  StateArchiveRequestSchema,
  StateArchivePageSchema,
  StateArchiveResultSchema,
  SystemOverviewSchema,
  TaskRunRequestSchema,
  TaskRunSchema,
  TerminalOutputSchema,
  TerminalReplaySchema,
  TenantReportSchema,
  TemplateRepositorySchema,
  TemplateRepositoryRollbackSchema,
  TerminalInputSchema,
  TerminalSessionSchema,
  TotpConfirmSchema,
  PanelTaskSchema,
  ResetUserPasswordSchema,
  RemoteBackupSyncResultSchema,
  RemoteBackupSyncSchema,
  RemoteBackupTargetSchema,
  UpdateHostSchema,
  UpdateAppDeploymentSchema,
  UpdateDatabaseConnectionSchema,
  UpdateNotificationChannelSchema,
  UpdateRemoteBackupTargetSchema,
  UpdateBackupScheduleSchema,
  UpdateLicenseSchema,
  UpdateAlertThresholdSchema,
  UpdateTaskScheduleSchema,
  UpdateUserRoleSchema,
  UpgradePlanSchema,
  WorkspaceOverviewSchema,
  WorkspaceSchema,
  type AuthUser,
  type AccessEvaluationRequest,
  type ApprovalQuery,
  type AuditPageQuery,
  type AuditQuery,
  type AppDeploymentAction,
  type ChangeOwnPassword,
  type CreateApiToken,
  type CreateAccessPolicy,
  type CreateResourceApprovalPolicy,
  type CreateTemplateRepository,
  type CreateTerminalSession,
  type CreateWorkspace,
  type CreateAlertSilence,
  type CreateApproval,
  type CreateAppDeployment,
  type CreateConnector,
  type CreateConnectorCommand,
  type ConnectorUpgradeRequest,
  type CreateDatabaseConnection,
  type CreateHostGroup,
  type CreateHost,
  type CreateNotificationChannel,
  type CreateRemoteBackupTarget,
  type NotificationSecretRotation,
  type TerminalInput,
  type TerminalOutput,
  type RollbackAppDeployment,
  type CreateTask,
  type CreateUser,
  type UpdateAlertThreshold,
  type UpdateAppDeployment,
  type UpdateDatabaseConnection,
  type UpdateHost,
  type UpdateNotificationChannel,
  type UpdateRemoteBackupTarget,
  type DockerContainerAction,
  type LoginRequest,
  type ResetUserPassword,
  type SetupRequest,
  type UpdateBackupSchedule,
  type UpdateLicense,
  type UpdateTaskSchedule
} from "@lxpanel/shared";

const apiBase = typeof import.meta.env.VITE_API_BASE === "string" ? import.meta.env.VITE_API_BASE : "";

const AuthResponseSchema = z.object({ user: AuthUserSchema });
const TotpSetupResponseSchema = z.object({ secret: z.string(), uri: z.string() });
const SessionsResponseSchema = z.object({ sessions: z.array(AuthSessionSchema) });
const ApiTokensResponseSchema = z.object({ tokens: z.array(ApiTokenSchema) });
const ApprovalsResponseSchema = z.object({ approvals: z.array(ApprovalSchema) });
const ApprovalResponseSchema = z.object({ approval: ApprovalSchema });
const UsersResponseSchema = z.object({ users: z.array(AuthUserSchema) });
const AuthStatusSchema = z.object({ setupRequired: z.boolean(), user: AuthUserSchema.nullable() });
const OverviewResponseSchema = z.object({ overview: SystemOverviewSchema });
const ProcessesResponseSchema = z.object({ processes: z.array(ProcessInfoSchema) });
const ServicesResponseSchema = z.object({ services: z.array(ServiceInfoSchema) });
const FilesResponseSchema = z.object({ root: z.string(), path: z.string(), entries: z.array(FileEntrySchema) });
const FileContentResponseSchema = z.object({ file: FileContentSchema });
const LogRootsResponseSchema = z.object({ roots: z.array(LogRootSchema) });
const LogTailResponseSchema = z.object({ tail: LogTailSchema });
const AuditResponseSchema = z.object({ events: z.array(AuditEventSchema) });
const AuditPageResponseSchema = z.object({ page: AuditPageSchema });
const AuditExportPackageResponseSchema = z.object({ package: AuditExportPackageSchema });
const AuditPruneResponseSchema = z.object({ result: AuditPruneResultSchema });
const AuditIntegrityResponseSchema = z.object({ report: AuditIntegrityReportSchema });
const ComplianceResponseSchema = z.object({ report: ComplianceReportSchema });
const AlertsResponseSchema = z.object({ events: z.array(AlertEventSchema), summary: AlertSummarySchema });
const AlertThresholdsResponseSchema = z.object({ thresholds: z.array(AlertThresholdSchema) });
const AlertSilencesResponseSchema = z.object({ silences: z.array(AlertSilenceSchema) });
const AlertSilenceResponseSchema = z.object({ silence: AlertSilenceSchema });
const AlertDismissResponseSchema = z.object({ event: AlertEventSchema });
const SecurityResponseSchema = z.object({ posture: SecurityPostureSchema });
const SecurityHardeningResponseSchema = z.object({ plan: SecurityHardeningPlanSchema });
const HostsResponseSchema = z.object({ hosts: z.array(HostSchema) });
const HostResponseSchema = z.object({ host: HostSchema });
const MonitoringSamplesResponseSchema = z.object({ samples: z.array(MetricSampleSchema) });
const MonitoringLatestResponseSchema = z.object({ sample: MetricSampleSchema.optional() });
const NotificationsResponseSchema = z.object({ channels: z.array(NotificationChannelSchema), deliveries: z.array(NotificationDeliverySchema) });
const NotificationChannelResponseSchema = z.object({ channel: NotificationChannelSchema });
const NotificationDeliveryResponseSchema = z.object({ delivery: NotificationDeliverySchema });
const NotificationSecretRotationResponseSchema = z.object({ result: NotificationSecretRotationResultSchema });
const AppTemplatesResponseSchema = z.object({ templates: z.array(AppTemplateSchema) });
const AppDeploymentsResponseSchema = z.object({ deployments: z.array(AppDeploymentSchema) });
const AppDeploymentResponseSchema = z.object({ deployment: AppDeploymentSchema });
const AppDeploymentHealthResponseSchema = z.object({ health: AppDeploymentHealthSchema });
const DatabaseConnectionsResponseSchema = z.object({ connections: z.array(DatabaseConnectionSchema) });
const DatabaseConnectionResponseSchema = z.object({ connection: DatabaseConnectionSchema });
const DatabaseBackupResponseSchema = z.object({ result: DatabaseBackupResultSchema });
const DatabaseBackupCleanupResponseSchema = z.object({ result: DatabaseBackupCleanupResultSchema });
const DatabaseRestoreDrillResponseSchema = z.object({ result: DatabaseRestoreDrillResultSchema });
const HostGroupsResponseSchema = z.object({ groups: z.array(HostGroupSchema) });
const HostGroupResponseSchema = z.object({ group: HostGroupSchema });
const ConnectorsResponseSchema = z.object({ connectors: z.array(ConnectorSchema) });
const ConnectorCommandsResponseSchema = z.object({ commands: z.array(ConnectorCommandSchema) });
const CreatedConnectorResponseSchema = z.object({ connector: ConnectorSchema, token: z.string() });
const ConnectorCommandResponseSchema = z.object({ command: ConnectorCommandSchema });
const ConnectorCommandsOnlyResponseSchema = z.object({ commands: z.array(ConnectorCommandSchema) });
const ConnectorVersionPolicyResponseSchema = z.object({ policy: ConnectorVersionPolicySchema });
const ConnectorUpgradePlanResponseSchema = z.object({ plan: ConnectorUpgradePlanSchema });
const IdentityProviderResponseSchema = z.object({ provider: IdentityProviderSchema.nullable() });
const SsoReadinessResponseSchema = z.object({ readiness: SsoReadinessSchema });
const ConnectorReleaseChannelsResponseSchema = z.object({ channels: z.array(ConnectorReleaseChannelSchema) });
const ConnectorReleaseManifestResponseSchema = z.object({ manifest: ConnectorReleaseManifestSchema });
const BackupEncryptionPolicyResponseSchema = z.object({ policy: BackupEncryptionPolicySchema });
const BackupKeyRotationPlanResponseSchema = z.object({ plan: BackupKeyRotationPlanSchema });
const AuditRetentionPoliciesResponseSchema = z.object({ policies: z.array(AuditRetentionPolicySchema) });
const AuditRetentionEvaluationResponseSchema = z.object({ evaluation: AuditRetentionEvaluationSchema });
const PluginManifestsResponseSchema = z.object({ plugins: z.array(PluginManifestSchema) });
const PluginPermissionEvaluationResponseSchema = z.object({ evaluation: PluginPermissionEvaluationSchema });
const HighAvailabilityPlanResponseSchema = z.object({ plan: HighAvailabilityPlanSchema });
const DockerStatusResponseSchema = z.object({ status: DockerStatusSchema });
const DockerContainersResponseSchema = z.object({ containers: z.array(DockerContainerSchema) });
const DockerImagesResponseSchema = z.object({ images: z.array(DockerImageSchema) });
const TasksResponseSchema = z.object({ tasks: z.array(PanelTaskSchema), runs: z.array(TaskRunSchema) });
const TaskResponseSchema = z.object({ task: PanelTaskSchema });
const TaskRunResponseSchema = z.object({ run: TaskRunSchema });
const BackupsResponseSchema = z.object({ backups: z.array(BackupSnapshotSchema), schedule: BackupScheduleSchema });
const BackupResponseSchema = z.object({ backup: BackupSnapshotSchema });
const BackupScheduleResponseSchema = z.object({ schedule: BackupScheduleSchema });
const BackupVerificationResponseSchema = z.object({ verification: BackupVerificationSchema });
const RemoteBackupTargetsResponseSchema = z.object({ targets: z.array(RemoteBackupTargetSchema) });
const RemoteBackupTargetResponseSchema = z.object({ target: RemoteBackupTargetSchema });
const RemoteBackupSyncResponseSchema = z.object({ results: z.array(RemoteBackupSyncResultSchema) });
const AccessPoliciesResponseSchema = z.object({ policies: z.array(AccessPolicySchema) });
const AccessPolicyResponseSchema = z.object({ policy: AccessPolicySchema });
const AccessEvaluationResponseSchema = z.object({ evaluation: AccessEvaluationSchema });
const RemediationRunsResponseSchema = z.object({ runs: z.array(SecurityRemediationRunSchema) });
const RemediationRunResponseSchema = z.object({ run: SecurityRemediationRunSchema });
const CapacityPlanResponseSchema = z.object({ plan: CapacityPlanSchema });
const UpgradePlanResponseSchema = z.object({ plan: UpgradePlanSchema });
const DeliveryChecklistResponseSchema = z.object({ checklist: DeliveryChecklistSchema });
const OpenApiSummaryResponseSchema = z.object({ summary: OpenApiSummarySchema });
const OpenApiDocumentResponseSchema = OpenApiDocumentSchema;
const TerminalSessionsResponseSchema = z.object({ sessions: z.array(TerminalSessionSchema) });
const TerminalSessionResponseSchema = z.object({ session: TerminalSessionSchema });
const TerminalSessionCommandResponseSchema = z.object({ session: TerminalSessionSchema, command: ConnectorCommandSchema });
const TerminalReplayResponseSchema = z.object({ replay: TerminalReplaySchema });
const TemplateRepositoriesResponseSchema = z.object({ repositories: z.array(TemplateRepositorySchema) });
const TemplateRepositoryResponseSchema = z.object({ repository: TemplateRepositorySchema });
const TemplateRepositoryRollbackResponseSchema = z.object({ rollback: TemplateRepositoryRollbackSchema });
const LicenseStatusResponseSchema = z.object({ status: LicenseStatusSchema });
const LicenseVerificationResponseSchema = z.object({ result: LicenseVerificationResultSchema });
const ResourceApprovalPoliciesResponseSchema = z.object({ policies: z.array(ResourceApprovalPolicySchema) });
const ResourceApprovalPolicyResponseSchema = z.object({ policy: ResourceApprovalPolicySchema });
const ResourceApprovalPrecheckResponseSchema = z.object({ precheck: ResourceApprovalPrecheckSchema });
const WorkspaceOverviewResponseSchema = z.object({ overview: WorkspaceOverviewSchema });
const WorkspaceResponseSchema = z.object({ workspace: WorkspaceSchema });
const TenantReportResponseSchema = z.object({ report: TenantReportSchema });
const StateArchiveResponseSchema = z.object({ result: StateArchiveResultSchema });
const StateArchivePageResponseSchema = z.object({ page: StateArchivePageSchema });
const InstallerGuideResponseSchema = z.object({ guide: InstallerGuideSchema });
const SdkExamplesResponseSchema = z.object({ examples: z.array(SdkExampleSchema) });
const FrontendQualityResponseSchema = z.object({ report: FrontendQualityReportSchema });
const DiagnosticsBundleResponseSchema = z.object({ bundle: DiagnosticsBundleSchema });
const OkResponseSchema = z.object({ ok: z.boolean() });

export type AuthStatus = z.infer<typeof AuthStatusSchema>;
export type FileListResponse = z.infer<typeof FilesResponseSchema>;
export type CreatedConnectorResponse = z.infer<typeof CreatedConnectorResponseSchema>;

export const api = {
  authStatus: () => request("/api/auth/status", AuthStatusSchema),
  setup: (input: SetupRequest) => request("/api/auth/setup", AuthResponseSchema, "POST", SetupRequestSchema.parse(input)),
  login: (input: LoginRequest) => request("/api/auth/login", LoginResponseSchema, "POST", LoginRequestSchema.parse(input)),
  logout: () => request("/api/auth/logout", OkResponseSchema, "POST"),
  sessions: () => request("/api/auth/sessions", SessionsResponseSchema),
  revokeSession: (sessionId: string) => request(`/api/auth/sessions?sessionId=${encodeURIComponent(sessionId)}`, OkResponseSchema, "DELETE"),
  apiTokens: () => request("/api/auth/tokens", ApiTokensResponseSchema),
  createApiToken: (input: CreateApiToken) => request("/api/auth/tokens", CreatedApiTokenSchema, "POST", CreateApiTokenSchema.parse(input)),
  revokeApiToken: (tokenId: string) => request(`/api/auth/tokens?tokenId=${encodeURIComponent(RevokeApiTokenSchema.parse({ tokenId }).tokenId)}`, OkResponseSchema, "DELETE"),
  approvals: (query: ApprovalQuery = {}) => request(`/api/approvals${toQuery(ApprovalQuerySchema.parse(query))}`, ApprovalsResponseSchema),
  createApproval: (input: CreateApproval) => request("/api/approvals", ApprovalResponseSchema, "POST", CreateApprovalSchema.parse(input)),
  approveApproval: (approvalId: string, comment?: string) => request("/api/approvals/approve", ApprovalResponseSchema, "POST", ApprovalDecisionSchema.parse({ approvalId, comment })),
  rejectApproval: (approvalId: string, comment?: string) => request("/api/approvals/reject", ApprovalResponseSchema, "POST", ApprovalDecisionSchema.parse({ approvalId, comment })),
  setupTotp: () => request("/api/auth/totp/setup", TotpSetupResponseSchema, "POST"),
  confirmTotp: (code: string) => request("/api/auth/totp/confirm", AuthResponseSchema, "POST", TotpConfirmSchema.parse({ code })),
  disableTotp: (code: string) => request("/api/auth/totp/disable", AuthResponseSchema, "POST", TotpConfirmSchema.parse({ code })),
  users: () => request("/api/users", UsersResponseSchema),
  createUser: (input: CreateUser) => request("/api/users", AuthResponseSchema, "POST", CreateUserSchema.parse(input)),
  updateUserRole: (userId: string, role: AuthUser["role"]) => request("/api/users/role", AuthResponseSchema, "PATCH", UpdateUserRoleSchema.parse({ userId, role })),
  resetUserPassword: (input: ResetUserPassword) => request("/api/users/password", OkResponseSchema, "POST", ResetUserPasswordSchema.parse(input)),
  changeOwnPassword: (input: ChangeOwnPassword) => request("/api/users/me/password", OkResponseSchema, "POST", ChangeOwnPasswordSchema.parse(input)),
  deleteUser: (userId: string) => request(`/api/users?userId=${encodeURIComponent(userId)}`, OkResponseSchema, "DELETE"),
  overview: () => request("/api/system/overview", OverviewResponseSchema),
  processes: () => request("/api/system/processes", ProcessesResponseSchema),
  services: () => request("/api/system/services", ServicesResponseSchema),
  serviceAction: (name: string, action: "start" | "stop" | "restart") => request("/api/system/services/action", OkResponseSchema, "POST", { name, action }),
  files: (path?: string) => request(`/api/files${path ? `?path=${encodeURIComponent(path)}` : ""}`, FilesResponseSchema),
  readFile: (path: string) => request(`/api/files/content?path=${encodeURIComponent(FileReadRequestSchema.parse({ path }).path)}`, FileContentResponseSchema),
  writeFile: (path: string, content: string) => request("/api/files/content", FileContentResponseSchema, "PUT", FileWriteRequestSchema.parse({ path, content })),
  createDirectory: (path: string) => request("/api/files/directories", OkResponseSchema, "POST", CreateDirectoryRequestSchema.parse({ path })),
  deleteFile: (path: string) => request(`/api/files?path=${encodeURIComponent(DeleteFileRequestSchema.parse({ path }).path)}`, OkResponseSchema, "DELETE"),
  logRoots: () => request("/api/logs/roots", LogRootsResponseSchema),
  logFiles: (path?: string) => request(`/api/logs/files${path ? `?path=${encodeURIComponent(path)}` : ""}`, FilesResponseSchema),
  logTail: (path: string, lines = 300) => request(`/api/logs/tail?path=${encodeURIComponent(path)}&lines=${lines}`, LogTailResponseSchema),
  dockerStatus: () => request("/api/docker/status", DockerStatusResponseSchema),
  dockerContainers: () => request("/api/docker/containers", DockerContainersResponseSchema),
  dockerImages: () => request("/api/docker/images", DockerImagesResponseSchema),
  dockerAction: (input: DockerContainerAction) => request("/api/docker/containers/action", OkResponseSchema, "POST", DockerContainerActionSchema.parse(input)),
  tasks: () => request("/api/tasks", TasksResponseSchema),
  createTask: (input: CreateTask) => request("/api/tasks", TaskResponseSchema, "POST", CreateTaskSchema.parse(input)),
  runTask: (taskId: string) => request("/api/tasks/run", TaskRunResponseSchema, "POST", TaskRunRequestSchema.parse({ taskId })),
  updateTaskSchedule: (input: UpdateTaskSchedule) => request("/api/tasks/schedule", TaskResponseSchema, "PATCH", UpdateTaskScheduleSchema.parse(input)),
  deleteTask: (taskId: string) => request(`/api/tasks?taskId=${encodeURIComponent(taskId)}`, OkResponseSchema, "DELETE"),
  backups: () => request("/api/backups", BackupsResponseSchema),
  createBackup: () => request("/api/backups", BackupResponseSchema, "POST"),
  verifyBackup: (backupId: string) => request("/api/backups/verify", BackupVerificationResponseSchema, "POST", BackupRequestSchema.parse({ backupId })),
  downloadBackup: (backupId: string) => download(`/api/backups/download?backupId=${encodeURIComponent(BackupRequestSchema.parse({ backupId }).backupId)}`),
  restoreBackup: (backupId: string, approvalId: string) => request("/api/backups/restore", BackupRestoreResponseSchema, "POST", BackupRestoreRequestSchema.parse({ backupId, approvalId, confirmation: "RESTORE" })),
  updateBackupSchedule: (input: UpdateBackupSchedule) => request("/api/backups/schedule", BackupScheduleResponseSchema, "PATCH", UpdateBackupScheduleSchema.parse(input)),
  remoteBackupTargets: (workspace?: string) => request(`/api/backups/remote-targets${workspace ? `?workspace=${encodeURIComponent(workspace)}` : ""}`, RemoteBackupTargetsResponseSchema),
  createRemoteBackupTarget: (input: CreateRemoteBackupTarget) => request("/api/backups/remote-targets", RemoteBackupTargetResponseSchema, "POST", CreateRemoteBackupTargetSchema.parse(input)),
  updateRemoteBackupTarget: (input: UpdateRemoteBackupTarget) => request("/api/backups/remote-targets", RemoteBackupTargetResponseSchema, "PATCH", UpdateRemoteBackupTargetSchema.parse(input)),
  syncRemoteBackup: (backupId: string, targetId?: string) => request("/api/backups/remote-sync", RemoteBackupSyncResponseSchema, "POST", RemoteBackupSyncSchema.parse({ backupId, targetId })),
  audit: (query: AuditQuery = {}) => request(`/api/audit${toQuery(AuditQuerySchema.parse(query))}`, AuditResponseSchema),
  exportAudit: (format: "jsonl" | "csv", query: AuditQuery = {}) => download(`/api/audit/export${toQuery(AuditExportQuerySchema.parse({ ...query, format }))}`),
  downloadAuditBundle: (format: "jsonl" | "csv", query: AuditQuery = {}) => download(`/api/audit/export-bundle${toQuery(AuditExportQuerySchema.parse({ ...query, format }))}`),
  pruneAudit: (retainDays: number, approvalId: string) => {
    const input = AuditRetentionSchema.parse({ retainDays, approvalId });
    return request(`/api/audit?retainDays=${encodeURIComponent(String(input.retainDays))}&approvalId=${encodeURIComponent(input.approvalId)}`, AuditPruneResponseSchema, "DELETE");
  },
  auditPage: (query: Partial<AuditPageQuery> = {}) => request(`/api/audit/page${toQuery(AuditPageQuerySchema.parse(query))}`, AuditPageResponseSchema),
  exportAuditPackage: (format: "jsonl" | "csv", query: AuditQuery = {}) => request(`/api/audit/export-package${toQuery(AuditExportQuerySchema.parse({ ...query, format }))}`, AuditExportPackageResponseSchema),
  auditIntegrity: () => request("/api/audit/integrity", AuditIntegrityResponseSchema),
  complianceReport: () => request("/api/audit/compliance", ComplianceResponseSchema),
  alerts: () => request("/api/alerts", AlertsResponseSchema),
  alertThresholds: () => request("/api/alerts/thresholds", AlertThresholdsResponseSchema),
  alertSilences: () => request("/api/alerts/silences", AlertSilencesResponseSchema),
  createAlertSilence: (input: CreateAlertSilence) => request("/api/alerts/silences", AlertSilenceResponseSchema, "POST", CreateAlertSilenceSchema.parse(input)),
  updateAlertThreshold: (input: UpdateAlertThreshold) => request("/api/alerts/thresholds", AlertThresholdsResponseSchema, "PATCH", UpdateAlertThresholdSchema.parse(input)),
  checkAlerts: () => request("/api/alerts/check", AlertsResponseSchema, "POST"),
  dismissAlert: (alertId: string) => request("/api/alerts/dismiss", AlertDismissResponseSchema, "POST", DismissAlertSchema.parse({ alertId })),
  security: () => request("/api/security/posture", SecurityResponseSchema),
  securityHardeningPlan: () => request("/api/security/hardening-plan", SecurityHardeningResponseSchema),
  hosts: (workspace?: string) => request(`/api/hosts${workspace ? `?workspace=${encodeURIComponent(workspace)}` : ""}`, HostsResponseSchema),
  hostGroups: () => request("/api/hosts/groups", HostGroupsResponseSchema),
  createHostGroup: (input: CreateHostGroup) => request("/api/hosts/groups", HostGroupResponseSchema, "POST", CreateHostGroupSchema.parse(input)),
  createHostBatchCommand: (input: z.infer<typeof HostBatchCommandSchema>) => request("/api/hosts/batch-command", ConnectorCommandsOnlyResponseSchema, "POST", HostBatchCommandSchema.parse(input)),
  createHostSshSession: (input: z.infer<typeof HostSshSessionRequestSchema>) => request("/api/hosts/ssh-session", ConnectorCommandResponseSchema, "POST", HostSshSessionRequestSchema.parse(input)),
  createHost: (input: CreateHost) => request("/api/hosts", HostResponseSchema, "POST", CreateHostSchema.parse(input)),
  updateHost: (input: UpdateHost) => request("/api/hosts", HostResponseSchema, "PATCH", UpdateHostSchema.parse(input)),
  deleteHost: (hostId: string) => request(`/api/hosts?hostId=${encodeURIComponent(hostId)}`, OkResponseSchema, "DELETE"),
  monitoringSamples: (hostId = "local", limit = 288) => request(`/api/monitoring/samples?hostId=${encodeURIComponent(hostId)}&limit=${limit}`, MonitoringSamplesResponseSchema),
  monitoringLatest: (hostId = "local") => request(`/api/monitoring/latest?hostId=${encodeURIComponent(hostId)}`, MonitoringLatestResponseSchema),
  monitoringPrometheus: () => download("/api/monitoring/prometheus"),
  notifications: () => request("/api/notifications", NotificationsResponseSchema),
  createNotificationChannel: (input: CreateNotificationChannel) => request("/api/notifications", NotificationChannelResponseSchema, "POST", CreateNotificationChannelSchema.parse(input)),
  updateNotificationChannel: (input: UpdateNotificationChannel) => request("/api/notifications", NotificationChannelResponseSchema, "PATCH", UpdateNotificationChannelSchema.parse(input)),
  deleteNotificationChannel: (channelId: string) => request(`/api/notifications?channelId=${encodeURIComponent(channelId)}`, OkResponseSchema, "DELETE"),
  testNotificationChannel: (channelId: string) => request("/api/notifications/test", NotificationDeliveryResponseSchema, "POST", NotificationTestSchema.parse({ channelId })),
  rotateNotificationSecret: (input: NotificationSecretRotation) => request("/api/notifications/rotate-secret", NotificationSecretRotationResponseSchema, "POST", NotificationSecretRotationSchema.parse(input)),
  appTemplates: () => request("/api/apps/templates", AppTemplatesResponseSchema),
  appDeployments: (workspace?: string) => request(`/api/apps/deployments${workspace ? `?workspace=${encodeURIComponent(workspace)}` : ""}`, AppDeploymentsResponseSchema),
  appDeploymentHealth: (deploymentId: string) => request(`/api/apps/deployments/health?deploymentId=${encodeURIComponent(deploymentId)}`, AppDeploymentHealthResponseSchema),
  createAppDeployment: (input: CreateAppDeployment) => request("/api/apps/deployments", AppDeploymentResponseSchema, "POST", CreateAppDeploymentSchema.parse(input)),
  runAppDeploymentAction: (input: AppDeploymentAction) => request("/api/apps/deployments/action", AppDeploymentResponseSchema, "POST", AppDeploymentActionSchema.parse(input)),
  updateAppDeployment: (input: UpdateAppDeployment) => request("/api/apps/deployments", AppDeploymentResponseSchema, "PATCH", UpdateAppDeploymentSchema.parse(input)),
  rollbackAppDeployment: (input: RollbackAppDeployment) => request("/api/apps/deployments/rollback", AppDeploymentResponseSchema, "POST", RollbackAppDeploymentSchema.parse(input)),
  databaseConnections: (workspace?: string) => request(`/api/databases${workspace ? `?workspace=${encodeURIComponent(workspace)}` : ""}`, DatabaseConnectionsResponseSchema),
  createDatabaseConnection: (input: CreateDatabaseConnection) => request("/api/databases", DatabaseConnectionResponseSchema, "POST", CreateDatabaseConnectionSchema.parse(input)),
  updateDatabaseConnection: (input: UpdateDatabaseConnection) => request("/api/databases", DatabaseConnectionResponseSchema, "PATCH", UpdateDatabaseConnectionSchema.parse(input)),
  deleteDatabaseConnection: (connectionId: string) => request(`/api/databases?connectionId=${encodeURIComponent(connectionId)}`, OkResponseSchema, "DELETE"),
  backupDatabaseConnection: (connectionId: string) => request("/api/databases/backup", DatabaseBackupResponseSchema, "POST", DatabaseBackupRequestSchema.parse({ connectionId })),
  cleanupDatabaseBackups: () => request("/api/databases/cleanup", DatabaseBackupCleanupResponseSchema, "POST"),
  drillDatabaseRestore: (connectionId: string) => request("/api/databases/restore-drill", DatabaseRestoreDrillResponseSchema, "POST", DatabaseRestoreDrillRequestSchema.parse({ connectionId })),
  connectors: () => request("/api/connectors", ConnectorsResponseSchema),
  connectorCommands: (connectorId?: string) => request(`/api/connectors/commands${connectorId ? `?connectorId=${encodeURIComponent(connectorId)}` : ""}`, ConnectorCommandsResponseSchema),
  createConnectorCommand: (input: CreateConnectorCommand) => request("/api/connectors/commands", ConnectorCommandResponseSchema, "POST", CreateConnectorCommandSchema.parse(input)),
  createConnector: (input: CreateConnector) => request("/api/connectors", CreatedConnectorResponseSchema, "POST", CreateConnectorSchema.parse(input)),
  accessPolicies: () => request("/api/platform/access-policies", AccessPoliciesResponseSchema),
  createAccessPolicy: (input: CreateAccessPolicy) => request("/api/platform/access-policies", AccessPolicyResponseSchema, "POST", CreateAccessPolicySchema.parse(input)),
  evaluateAccess: (input: AccessEvaluationRequest) => request("/api/platform/access-evaluate", AccessEvaluationResponseSchema, "POST", AccessEvaluationRequestSchema.parse(input)),
  terminalSessions: () => request("/api/platform/terminal-sessions", TerminalSessionsResponseSchema),
  createTerminalSession: (input: CreateTerminalSession) => request("/api/platform/terminal-sessions", TerminalSessionCommandResponseSchema, "POST", CreateTerminalSessionSchema.parse(input)),
  sendTerminalInput: (input: TerminalInput) => request("/api/platform/terminal-sessions/input", TerminalSessionCommandResponseSchema, "POST", TerminalInputSchema.parse(input)),
  sendTerminalOutput: (input: TerminalOutput) => request("/api/platform/terminal-sessions/output", TerminalSessionResponseSchema, "POST", TerminalOutputSchema.parse(input)),
  closeTerminalSession: (sessionId: string) => request("/api/platform/terminal-sessions/close", TerminalSessionCommandResponseSchema, "POST", { sessionId }),
  terminalReplay: (sessionId: string) => request(`/api/platform/terminal-sessions/replay?sessionId=${encodeURIComponent(sessionId)}`, TerminalReplayResponseSchema),
  terminalWebSocketUrl: (sessionId: string) => `${apiBase}/api/platform/terminal-sessions/ws?sessionId=${encodeURIComponent(sessionId)}`,
  templateRepositories: () => request("/api/platform/template-repositories", TemplateRepositoriesResponseSchema),
  createTemplateRepository: (input: CreateTemplateRepository) => request("/api/platform/template-repositories", TemplateRepositoryResponseSchema, "POST", CreateTemplateRepositorySchema.parse(input)),
  syncTemplateRepository: (repositoryId: string) => request("/api/platform/template-repositories/sync", TemplateRepositoryResponseSchema, "POST", { repositoryId }),
  rollbackTemplateRepository: (repositoryId: string) => request("/api/platform/template-repositories/rollback", TemplateRepositoryRollbackResponseSchema, "POST", { repositoryId }),
  workspaces: () => request("/api/platform/workspaces", WorkspaceOverviewResponseSchema),
  createWorkspace: (input: CreateWorkspace) => request("/api/platform/workspaces", WorkspaceResponseSchema, "POST", CreateWorkspaceSchema.parse(input)),
  tenantReport: (workspace = "default") => request(`/api/platform/tenant-report?workspace=${encodeURIComponent(workspace)}`, TenantReportResponseSchema),
  connectorVersionPolicy: () => request("/api/platform/connectors/version-policy", ConnectorVersionPolicyResponseSchema),
  scheduleConnectorUpgrade: (input: ConnectorUpgradeRequest) => request("/api/platform/connectors/upgrade", ConnectorUpgradePlanResponseSchema, "POST", ConnectorUpgradeRequestSchema.parse(input)),
  identityProvider: () => request("/api/platform/identity-provider", IdentityProviderResponseSchema),
  ssoReadiness: () => request("/api/platform/sso-readiness", SsoReadinessResponseSchema),
  connectorReleaseChannels: () => request("/api/platform/connectors/release-channels", ConnectorReleaseChannelsResponseSchema),
  connectorReleaseManifest: () => request("/api/platform/connectors/release-manifest", ConnectorReleaseManifestResponseSchema),
  backupEncryptionPolicy: () => request("/api/platform/backup-encryption", BackupEncryptionPolicyResponseSchema),
  backupKeyRotationPlan: () => request("/api/platform/backup-encryption/rotation-plan", BackupKeyRotationPlanResponseSchema),
  auditRetentionPolicies: () => request("/api/platform/audit-retention-policies", AuditRetentionPoliciesResponseSchema),
  auditRetentionEvaluation: () => request("/api/platform/audit-retention-policies/evaluate", AuditRetentionEvaluationResponseSchema, "POST", { workspace: "default", eventType: "*", eventCount: 0 }),
  plugins: () => request("/api/platform/plugins", PluginManifestsResponseSchema),
  pluginPermissionEvaluation: (pluginId: string) => request("/api/platform/plugins/evaluate", PluginPermissionEvaluationResponseSchema, "POST", { pluginId, requestedScopes: ["platform:read"] }),
  highAvailabilityPlan: () => request("/api/platform/high-availability-plan", HighAvailabilityPlanResponseSchema),
  licenseStatus: () => request("/api/platform/license", LicenseStatusResponseSchema),
  updateLicense: (input: UpdateLicense) => request("/api/platform/license", LicenseStatusResponseSchema, "PUT", UpdateLicenseSchema.parse(input)),
  verifyLicense: (input: UpdateLicense) => request("/api/platform/license/verify", LicenseVerificationResponseSchema, "POST", UpdateLicenseSchema.parse(input)),
  approvalPolicies: () => request("/api/platform/approval-policies", ResourceApprovalPoliciesResponseSchema),
  createApprovalPolicy: (input: CreateResourceApprovalPolicy) => request("/api/platform/approval-policies", ResourceApprovalPolicyResponseSchema, "POST", CreateResourceApprovalPolicySchema.parse(input)),
  checkApprovalPolicy: (input: z.infer<typeof ResourceApprovalCheckSchema>) => request("/api/platform/approval-policies/check", ResourceApprovalPrecheckResponseSchema, "POST", ResourceApprovalCheckSchema.parse(input)),
  remediationRuns: () => request("/api/platform/remediations", RemediationRunsResponseSchema),
  createRemediationRun: (input: z.infer<typeof SecurityRemediationRequestSchema>) => request("/api/platform/remediations", RemediationRunResponseSchema, "POST", SecurityRemediationRequestSchema.parse(input)),
  capacityPlan: () => request("/api/platform/capacity-plan", CapacityPlanResponseSchema),
  upgradePlan: () => request("/api/platform/upgrade-plan", UpgradePlanResponseSchema),
  deliveryChecklist: () => request("/api/platform/delivery-checklist", DeliveryChecklistResponseSchema),
  openApiSummary: () => request("/api/platform/openapi-summary", OpenApiSummaryResponseSchema),
  openApiDocument: () => request("/api/platform/openapi.json", OpenApiDocumentResponseSchema),
  archiveState: (input: z.infer<typeof StateArchiveRequestSchema>) => request("/api/platform/archive-state", StateArchiveResponseSchema, "POST", StateArchiveRequestSchema.parse(input)),
  archiveRecords: (bucket?: string, limit = 100) => request(`/api/platform/archive-records${toQuery({ bucket, limit })}`, StateArchivePageResponseSchema),
  installerGuide: () => request("/api/platform/installer-guide", InstallerGuideResponseSchema),
  sdkExamples: () => request("/api/platform/sdk-examples", SdkExamplesResponseSchema),
  frontendQuality: () => request("/api/platform/frontend-quality", FrontendQualityResponseSchema),
  diagnosticsBundle: () => request("/api/platform/diagnostics-bundle", DiagnosticsBundleResponseSchema)
};

export type ApiClient = typeof api;

async function request<TSchema extends z.ZodType>(path: string, schema: TSchema, method = "GET", body?: unknown): Promise<z.infer<TSchema>> {
  const init: RequestInit = {
    method,
    credentials: "include"
  };
  if (body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${apiBase}${path}`, init);
  const payload = await readPayload(response);
  if (!response.ok) {
    throw new Error(extractMessage(payload, response.statusText));
  }
  return schema.parse(payload);
}

async function download(path: string): Promise<Blob> {
  const response = await fetch(`${apiBase}${path}`, { credentials: "include" });
  if (!response.ok) {
    throw new Error(extractMessage(await readPayload(response), response.statusText));
  }
  return response.blob();
}

async function readPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return { message: response.statusText };
  }
}

function extractMessage(payload: unknown, fallback: string): string {
  if (isRecord(payload) && typeof payload.message === "string") {
    return payload.message;
  }
  return fallback || "请求失败。";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toQuery(value: object): string {
  const params = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(value)) {
    if (rawValue !== undefined && rawValue !== "") {
      params.set(key, String(rawValue));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export type { AuthUser };
