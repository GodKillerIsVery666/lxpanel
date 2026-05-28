import type { ApiTokenScope } from "@lxpanel/shared";

/** 沙箱客户端：提供受限的 API 访问 */
export interface SandboxClient {
  /** 执行一个只读请求到面板 API */
  request(method: string, path: string): Promise<unknown>;
  /** 记录日志 */
  log(level: "info" | "warn" | "error", message: string): void;
  /** 获取已授予的作用域 */
  getGrantedScopes(): ApiTokenScope[];
  /** 检查是否拥有特定作用域 */
  hasScope(scope: ApiTokenScope): boolean;
}

/** 创建沙箱客户端实例 */
export function createSandboxClient(options: {
  grantedScopes: ApiTokenScope[];
  apiBase: string;
  apiToken?: string;
  logFn?: (level: string, message: string) => void;
}): SandboxClient {
  const { grantedScopes, apiBase, apiToken, logFn } = options;
  return {
    async request(method: string, path: string): Promise<unknown> {
      const url = `${apiBase.replace(/\/+$/u, "")}${path}`;
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (apiToken) {
        headers["authorization"] = `Bearer ${apiToken}`;
      }
      const response = await fetch(url, { method, headers });
      if (!response.ok) {
        throw new Error(`Sandbox request failed: ${response.status}`);
      }
      return response.json() as Promise<unknown>;
    },
    log(level: "info" | "warn" | "error", message: string): void {
      (logFn ?? console.log)(`[plugin-sdk:${level}] ${message}`);
    },
    getGrantedScopes(): ApiTokenScope[] {
      return [...grantedScopes];
    },
    hasScope(scope: ApiTokenScope): boolean {
      return grantedScopes.includes(scope);
    }
  };
}
