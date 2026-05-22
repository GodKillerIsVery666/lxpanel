import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface AppConfig {
  host: string;
  port: number;
  dataDir: string;
  sessionSecret: string;
  cookieSecure: boolean;
  allowedOrigins: string[];
  fileRoots: string[];
  logRoots: string[];
  logLevel: string;
}

const defaultDevSecret = "dev-change-me-lxpanel-session-secret-32-bytes";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const sessionSecret = env.LXPANEL_SESSION_SECRET ?? defaultDevSecret;
  if (env.NODE_ENV === "production" && sessionSecret === defaultDevSecret) {
    throw new Error("生产环境必须设置 LXPANEL_SESSION_SECRET。");
  }

  const fileRoots = splitList(env.LXPANEL_FILE_ROOTS).map((item) => resolve(item));
  const dataDir = resolve(env.LXPANEL_DATA_DIR ?? join(process.cwd(), "data"));
  const logRoots = splitList(env.LXPANEL_LOG_ROOTS).map((item) => resolve(item));
  return {
    host: env.LXPANEL_HOST ?? "127.0.0.1",
    port: parsePort(env.LXPANEL_PORT ?? "7080"),
    dataDir,
    sessionSecret,
    cookieSecure: parseBool(env.LXPANEL_COOKIE_SECURE ?? "false"),
    allowedOrigins: splitList(env.LXPANEL_ALLOWED_ORIGINS).length > 0
      ? splitList(env.LXPANEL_ALLOWED_ORIGINS)
      : ["http://localhost:5173", "http://127.0.0.1:5173"],
    fileRoots: fileRoots.length > 0 ? fileRoots : [homedir()],
    logRoots: logRoots.length > 0 ? logRoots : defaultLogRoots(dataDir),
    logLevel: env.LXPANEL_LOG_LEVEL ?? "info"
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

function splitList(value?: string): string[] {
  if (!value) {
    return [];
  }
  return value.split(/[;,]/u).map((item) => item.trim()).filter(Boolean);
}
