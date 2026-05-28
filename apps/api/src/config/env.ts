import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface AppConfig {
  host: string;
  port: number;
  dataDir: string;
  stateStoreDriver: "json" | "sqlite";
  stateSqlitePath: string;
  sessionSecret: string;
  cookieSecure: boolean;
  allowedOrigins: string[];
  ipAllowlist: string[];
  webhookAllowlist: string[];
  webRoot: string;
  fileRoots: string[];
  logRoots: string[];
  logLevel: string;
  logFormat: "json" | "text";
}

const defaultDevSecret = "dev-change-me-lxpanel-session-secret-32-bytes";
const defaultWebRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../web/dist");

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const sessionSecret = env.LXPANEL_SESSION_SECRET ?? defaultDevSecret;
  if (env.NODE_ENV === "production" && sessionSecret === defaultDevSecret) {
    throw new Error("生产环境必须设置 LXPANEL_SESSION_SECRET。");
  }

  const fileRoots = splitList(env.LXPANEL_FILE_ROOTS).map((item) => resolve(item));
  const dataDir = resolve(env.LXPANEL_DATA_DIR ?? join(process.cwd(), "data"));
  const stateStoreDriver = parseStateStoreDriver(env.LXPANEL_STATE_STORE ?? env.LXPANEL_STORAGE_DRIVER ?? "json");
  const logRoots = splitList(env.LXPANEL_LOG_ROOTS).map((item) => resolve(item));
  return {
    host: env.LXPANEL_HOST ?? "127.0.0.1",
    port: parsePort(env.LXPANEL_PORT ?? "7080"),
    dataDir,
    stateStoreDriver,
    stateSqlitePath: resolve(env.LXPANEL_STATE_SQLITE_PATH ?? env.LXPANEL_DATABASE_PATH ?? join(dataDir, "lxpanel.db")),
    sessionSecret,
    cookieSecure: parseBool(env.LXPANEL_COOKIE_SECURE ?? "false"),
    allowedOrigins: splitList(env.LXPANEL_ALLOWED_ORIGINS).length > 0
      ? splitList(env.LXPANEL_ALLOWED_ORIGINS)
      : ["http://localhost:5173", "http://127.0.0.1:5173"],
    ipAllowlist: splitList(env.LXPANEL_IP_ALLOWLIST),
    webhookAllowlist: splitList(env.LXPANEL_WEBHOOK_ALLOWLIST).map((item) => item.toLowerCase()),
    webRoot: resolve(env.LXPANEL_WEB_ROOT ?? defaultWebRoot),
    fileRoots: fileRoots.length > 0 ? fileRoots : [homedir()],
    logRoots: logRoots.length > 0 ? logRoots : defaultLogRoots(dataDir),
    logLevel: env.LXPANEL_LOG_LEVEL ?? "info",
    logFormat: env.LXPANEL_LOG_FORMAT === "text" ? "text" : "json"
  };
}

function defaultLogRoots(dataDir: string): string[] {
  if (process.platform === "win32") {
    return [dataDir, process.cwd()];
  }
  return [dataDir, "/var/log"];
}

function parsePort(value: string): number {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`无效端口: ${value}`);
  }
  return port;
}

function parseBool(value: string): boolean {
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseStateStoreDriver(value: string): "json" | "sqlite" {
  if (value === "json" || value === "sqlite") {
    return value;
  }
  throw new Error(`无效状态存储驱动: ${value}`);
}

function splitList(value?: string): string[] {
  if (!value) {
    return [];
  }
  return value.split(/[;,]/u).map((item) => item.trim()).filter(Boolean);
}
