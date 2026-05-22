import { z } from "zod";
import {
  AuditEventSchema,
  AlertEventSchema,
  AlertSummarySchema,
  AlertThresholdSchema,
  BackupScheduleSchema,
  BackupRequestSchema,
  BackupRestoreResponseSchema,
  AuthSessionSchema,
  ConnectorCommandSchema,
  AuthUserSchema,
  BackupSnapshotSchema,
  ChangeOwnPasswordSchema,
  ConnectorSchema,
  CreateConnectorCommandSchema,
  CreateTaskSchema,
  CreateUserSchema,
  DismissAlertSchema,
  CreateConnectorSchema,
  DockerContainerActionSchema,
  DockerContainerSchema,
  DockerImageSchema,
  DockerStatusSchema,
  FileEntrySchema,
  LogRootSchema,
  LogTailSchema,
  LoginResponseSchema,
  LoginRequestSchema,
  ProcessInfoSchema,
  SecurityPostureSchema,
  ServiceInfoSchema,
  SetupRequestSchema,
  SystemOverviewSchema,
  TaskRunRequestSchema,
  TaskRunSchema,
  TotpConfirmSchema,
  PanelTaskSchema,
  ResetUserPasswordSchema,
  UpdateBackupScheduleSchema,
  UpdateAlertThresholdSchema,
  UpdateTaskScheduleSchema,
  UpdateUserRoleSchema,
  type AuthUser,
  type ChangeOwnPassword,
  type CreateConnector,
  type CreateConnectorCommand,
  type CreateTask,
  type CreateUser,
  type UpdateAlertThreshold,
  type DockerContainerAction,
  type LoginRequest,
  type ResetUserPassword,
  type SetupRequest,
  type UpdateBackupSchedule,
  type UpdateTaskSchedule
} from "@lxpanel/shared";

const apiBase = typeof import.meta.env.VITE_API_BASE === "string" ? import.meta.env.VITE_API_BASE : "";

const AuthResponseSchema = z.object({ user: AuthUserSchema });
const TotpSetupResponseSchema = z.object({ secret: z.string(), uri: z.string() });
const SessionsResponseSchema = z.object({ sessions: z.array(AuthSessionSchema) });
const UsersResponseSchema = z.object({ users: z.array(AuthUserSchema) });
const AuthStatusSchema = z.object({ setupRequired: z.boolean(), user: AuthUserSchema.nullable() });
const OverviewResponseSchema = z.object({ overview: SystemOverviewSchema });
const ProcessesResponseSchema = z.object({ processes: z.array(ProcessInfoSchema) });
const ServicesResponseSchema = z.object({ services: z.array(ServiceInfoSchema) });
const FilesResponseSchema = z.object({ root: z.string(), path: z.string(), entries: z.array(FileEntrySchema) });
const LogRootsResponseSchema = z.object({ roots: z.array(LogRootSchema) });
const LogTailResponseSchema = z.object({ tail: LogTailSchema });
const AuditResponseSchema = z.object({ events: z.array(AuditEventSchema) });
const AlertsResponseSchema = z.object({ events: z.array(AlertEventSchema), summary: AlertSummarySchema });
const AlertThresholdsResponseSchema = z.object({ thresholds: z.array(AlertThresholdSchema) });
const AlertDismissResponseSchema = z.object({ event: AlertEventSchema });
const SecurityResponseSchema = z.object({ posture: SecurityPostureSchema });
const ConnectorsResponseSchema = z.object({ connectors: z.array(ConnectorSchema) });
const ConnectorCommandsResponseSchema = z.object({ commands: z.array(ConnectorCommandSchema) });
const CreatedConnectorResponseSchema = z.object({ connector: ConnectorSchema, token: z.string() });
const ConnectorCommandResponseSchema = z.object({ command: ConnectorCommandSchema });
const DockerStatusResponseSchema = z.object({ status: DockerStatusSchema });
const DockerContainersResponseSchema = z.object({ containers: z.array(DockerContainerSchema) });
const DockerImagesResponseSchema = z.object({ images: z.array(DockerImageSchema) });
const TasksResponseSchema = z.object({ tasks: z.array(PanelTaskSchema), runs: z.array(TaskRunSchema) });
const TaskResponseSchema = z.object({ task: PanelTaskSchema });
const TaskRunResponseSchema = z.object({ run: TaskRunSchema });
const BackupsResponseSchema = z.object({ backups: z.array(BackupSnapshotSchema), schedule: BackupScheduleSchema });
const BackupResponseSchema = z.object({ backup: BackupSnapshotSchema });
const BackupScheduleResponseSchema = z.object({ schedule: BackupScheduleSchema });
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
  downloadBackup: (backupId: string) => download(`/api/backups/download?backupId=${encodeURIComponent(BackupRequestSchema.parse({ backupId }).backupId)}`),
  restoreBackup: (backupId: string) => request("/api/backups/restore", BackupRestoreResponseSchema, "POST", BackupRequestSchema.parse({ backupId })),
  updateBackupSchedule: (input: UpdateBackupSchedule) => request("/api/backups/schedule", BackupScheduleResponseSchema, "PATCH", UpdateBackupScheduleSchema.parse(input)),
  audit: () => request("/api/audit", AuditResponseSchema),
  alerts: () => request("/api/alerts", AlertsResponseSchema),
  alertThresholds: () => request("/api/alerts/thresholds", AlertThresholdsResponseSchema),
  updateAlertThreshold: (input: UpdateAlertThreshold) => request("/api/alerts/thresholds", AlertThresholdsResponseSchema, "PATCH", UpdateAlertThresholdSchema.parse(input)),
  checkAlerts: () => request("/api/alerts/check", AlertsResponseSchema, "POST"),
  dismissAlert: (alertId: string) => request("/api/alerts/dismiss", AlertDismissResponseSchema, "POST", DismissAlertSchema.parse({ alertId })),
  security: () => request("/api/security/posture", SecurityResponseSchema),
  connectors: () => request("/api/connectors", ConnectorsResponseSchema),
  connectorCommands: (connectorId?: string) => request(`/api/connectors/commands${connectorId ? `?connectorId=${encodeURIComponent(connectorId)}` : ""}`, ConnectorCommandsResponseSchema),
  createConnectorCommand: (input: CreateConnectorCommand) => request("/api/connectors/commands", ConnectorCommandResponseSchema, "POST", CreateConnectorCommandSchema.parse(input)),
  createConnector: (input: CreateConnector) => request("/api/connectors", CreatedConnectorResponseSchema, "POST", CreateConnectorSchema.parse(input))
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

export type { AuthUser };
