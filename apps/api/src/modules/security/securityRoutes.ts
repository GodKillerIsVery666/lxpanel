import { readFile, stat } from "node:fs/promises";
import { platform } from "node:os";
import type { FastifyInstance } from "fastify";
import type { SecurityCheck, SecurityPosture } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { requireUser } from "../auth/authMiddleware.js";
import type { ApiTokenExpirySummary } from "../auth/authStore.js";

export function registerSecurityRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/security/posture", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const backupCount = await services.backupStore.countBackups();
    const apiTokenExpiry = await services.authStore.summarizeApiTokenExpiry();
    const checks = await buildSecurityChecks(services, backupCount, apiTokenExpiry);
    const recommendations = checks
      .filter((check) => check.status === "warn" || check.status === "critical")
      .map((check) => check.detail);
    const posture: SecurityPosture = {
      setupRequired: !(await services.authStore.hasUsers()),
      cookieSecure: services.config.cookieSecure,
      ipAllowlistEnabled: services.config.ipAllowlist.length > 0,
      ipAllowlist: services.config.ipAllowlist,
      managedRoots: services.config.fileRoots,
      logRoots: services.config.logRoots,
      connectorCount: await services.connectorStore.count(),
      userCount: await services.authStore.countUsers(),
      taskCount: await services.taskStore.countTasks(),
      backupCount,
      checks,
      recommendations
    };
    return { posture };
  });
}

async function buildSecurityChecks(services: Services, backupCount: number, apiTokenExpiry: ApiTokenExpirySummary): Promise<SecurityCheck[]> {
  const checks: SecurityCheck[] = [
    {
      id: "session-secret",
      label: "会话密钥",
      status: services.config.sessionSecret.includes("dev-change-me") ? "critical" : services.config.sessionSecret.length >= 32 ? "secure" : "warn",
      detail: services.config.sessionSecret.includes("dev-change-me") ? "请设置强随机 LXPANEL_SESSION_SECRET。" : services.config.sessionSecret.length >= 32 ? "会话密钥长度满足基础要求。" : "LXPANEL_SESSION_SECRET 建议不少于 32 字符。"
    },
    {
      id: "cookie-secure",
      label: "HTTPS Cookie",
      status: services.config.cookieSecure ? "secure" : "warn",
      detail: services.config.cookieSecure ? "Cookie 已要求 HTTPS 传输。" : "生产环境建议启用 LXPANEL_COOKIE_SECURE=true 并放在 HTTPS 后面。"
    },
    {
      id: "ip-allowlist",
      label: "访问白名单",
      status: services.config.ipAllowlist.length > 0 ? "secure" : "warn",
      detail: services.config.ipAllowlist.length > 0 ? "已配置面板访问源 IP 白名单。" : "生产环境建议配置 LXPANEL_IP_ALLOWLIST 限制可访问面板的源地址。"
    },
    {
      id: "state-store",
      label: "状态存储",
      status: services.config.stateStoreDriver === "sqlite" ? "secure" : "info",
      detail: services.config.stateStoreDriver === "sqlite" ? "当前使用 SQLite 状态存储。" : "当前使用 JSON 状态存储，小型部署可用，生产建议评估 SQLite。"
    },
    {
      id: "backups",
      label: "状态备份",
      status: backupCount > 0 ? "secure" : "warn",
      detail: backupCount > 0 ? `已有 ${backupCount} 个状态备份。` : "建议在上线前创建至少一个状态备份并启用自动备份。"
    },
    buildApiTokenExpiryCheck(apiTokenExpiry),
    await dockerSocketCheck(),
    ...(await sshChecks())
  ];
  return checks;
}

function buildApiTokenExpiryCheck(summary: ApiTokenExpirySummary): SecurityCheck {
  if (summary.total === 0) {
    return { id: "api-token-expiry", label: "API Token 到期", status: "info", detail: "当前没有 API Token。" };
  }
  if (summary.expired > 0) {
    return {
      id: "api-token-expiry",
      label: "API Token 到期",
      status: "critical",
      detail: `发现 ${summary.expired} 个已过期 API Token，请撤销或重新签发。`
    };
  }
  if (summary.expiring > 0) {
    return {
      id: "api-token-expiry",
      label: "API Token 到期",
      status: "warn",
      detail: `${summary.expiring} 个 API Token 将在 ${summary.warningDays} 天内到期，请提前轮换。`
    };
  }
  if (summary.withoutExpiry > 0) {
    return {
      id: "api-token-expiry",
      label: "API Token 到期",
      status: "warn",
      detail: `${summary.withoutExpiry} 个 API Token 未设置到期时间，建议为自动化密钥设置有效期。`
    };
  }
  return { id: "api-token-expiry", label: "API Token 到期", status: "secure", detail: "API Token 均设置有效期，且当前没有即将到期项。" };
}

async function dockerSocketCheck(): Promise<SecurityCheck> {
  if (platform() === "win32") {
    return { id: "docker-socket", label: "Docker Socket", status: "info", detail: "当前平台未暴露 Linux Docker socket 检查。" };
  }
  try {
    const info = await stat("/var/run/docker.sock");
    return {
      id: "docker-socket",
      label: "Docker Socket",
      status: "warn",
      detail: info.isSocket() ? "检测到 /var/run/docker.sock，生产环境应只授予可信 operator。" : "检测到 Docker socket 路径但类型异常，请核对权限。"
    };
  } catch {
    return { id: "docker-socket", label: "Docker Socket", status: "secure", detail: "未检测到默认 Docker socket 暴露。" };
  }
}

async function sshChecks(): Promise<SecurityCheck[]> {
  if (platform() === "win32") {
    return [{ id: "ssh-config", label: "SSH 配置", status: "info", detail: "当前平台未检测 sshd_config。" }];
  }
  const config = await readSshConfig();
  if (!config) {
    return [{ id: "ssh-config", label: "SSH 配置", status: "info", detail: "未读取到 /etc/ssh/sshd_config。" }];
  }
  const rootLogin = readSshValue(config, "PermitRootLogin");
  const passwordAuth = readSshValue(config, "PasswordAuthentication");
  return [
    {
      id: "ssh-root-login",
      label: "SSH Root 登录",
      status: rootLogin === "yes" ? "critical" : rootLogin ? "secure" : "info",
      detail: rootLogin === "yes" ? "SSH PermitRootLogin 为 yes，建议关闭 root 直登。" : rootLogin ? `SSH PermitRootLogin=${rootLogin}。` : "未发现 SSH PermitRootLogin 显式配置。"
    },
    {
      id: "ssh-password-auth",
      label: "SSH 密码登录",
      status: passwordAuth === "yes" ? "warn" : passwordAuth ? "secure" : "info",
      detail: passwordAuth === "yes" ? "SSH PasswordAuthentication 为 yes，建议优先使用密钥登录。" : passwordAuth ? `SSH PasswordAuthentication=${passwordAuth}。` : "未发现 SSH PasswordAuthentication 显式配置。"
    }
  ];
}

async function readSshConfig(): Promise<string | null> {
  try {
    return await readFile("/etc/ssh/sshd_config", "utf8");
  } catch {
    return null;
  }
}

function readSshValue(config: string, key: string): string | null {
  const line = config.split("\n").find((item) => item.trim().toLowerCase().startsWith(key.toLowerCase()));
  return line ? line.trim().split(/\s+/u)[1]?.toLowerCase() ?? null : null;
}
