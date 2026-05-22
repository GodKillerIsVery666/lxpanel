import { z } from "zod";

export const RoleSchema = z.enum(["owner", "operator", "viewer"]);
export type Role = z.infer<typeof RoleSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: RoleSchema,
  createdAt: z.string(),
  lastLoginAt: z.string().optional()
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const LoginRequestSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(8).max(256)
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const SetupRequestSchema = LoginRequestSchema.extend({
  inviteCode: z.string().max(128).optional()
});
export type SetupRequest = z.infer<typeof SetupRequestSchema>;

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

export const SecurityPostureSchema = z.object({
  setupRequired: z.boolean(),
  cookieSecure: z.boolean(),
  managedRoots: z.array(z.string()),
  connectorCount: z.number(),
  recommendations: z.array(z.string())
});
export type SecurityPosture = z.infer<typeof SecurityPostureSchema>;
