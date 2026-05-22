import { z } from "zod";
import {
  AuditEventSchema,
  AuthUserSchema,
  ConnectorSchema,
  CreateConnectorSchema,
  FileEntrySchema,
  LoginRequestSchema,
  ProcessInfoSchema,
  SecurityPostureSchema,
  ServiceInfoSchema,
  SetupRequestSchema,
  SystemOverviewSchema,
  type AuthUser,
  type CreateConnector,
  type LoginRequest,
  type SetupRequest
} from "@lxpanel/shared";

const apiBase = typeof import.meta.env.VITE_API_BASE === "string" ? import.meta.env.VITE_API_BASE : "";

const AuthResponseSchema = z.object({ user: AuthUserSchema });
const AuthStatusSchema = z.object({ setupRequired: z.boolean(), user: AuthUserSchema.nullable() });
const OverviewResponseSchema = z.object({ overview: SystemOverviewSchema });
const ProcessesResponseSchema = z.object({ processes: z.array(ProcessInfoSchema) });
const ServicesResponseSchema = z.object({ services: z.array(ServiceInfoSchema) });
const FilesResponseSchema = z.object({ root: z.string(), path: z.string(), entries: z.array(FileEntrySchema) });
const AuditResponseSchema = z.object({ events: z.array(AuditEventSchema) });
const SecurityResponseSchema = z.object({ posture: SecurityPostureSchema });
const ConnectorsResponseSchema = z.object({ connectors: z.array(ConnectorSchema) });
const CreatedConnectorResponseSchema = z.object({ connector: ConnectorSchema, token: z.string() });
const OkResponseSchema = z.object({ ok: z.boolean() });

export type AuthStatus = z.infer<typeof AuthStatusSchema>;
export type FileListResponse = z.infer<typeof FilesResponseSchema>;
export type CreatedConnectorResponse = z.infer<typeof CreatedConnectorResponseSchema>;

export const api = {
  authStatus: () => request("/api/auth/status", AuthStatusSchema),
  setup: (input: SetupRequest) => request("/api/auth/setup", AuthResponseSchema, "POST", SetupRequestSchema.parse(input)),
  login: (input: LoginRequest) => request("/api/auth/login", AuthResponseSchema, "POST", LoginRequestSchema.parse(input)),
  logout: () => request("/api/auth/logout", OkResponseSchema, "POST"),
  overview: () => request("/api/system/overview", OverviewResponseSchema),
  processes: () => request("/api/system/processes", ProcessesResponseSchema),
  services: () => request("/api/system/services", ServicesResponseSchema),
  serviceAction: (name: string, action: "start" | "stop" | "restart") => request("/api/system/services/action", OkResponseSchema, "POST", { name, action }),
  files: (path?: string) => request(`/api/files${path ? `?path=${encodeURIComponent(path)}` : ""}`, FilesResponseSchema),
  audit: () => request("/api/audit", AuditResponseSchema),
  security: () => request("/api/security/posture", SecurityResponseSchema),
  connectors: () => request("/api/connectors", ConnectorsResponseSchema),
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
