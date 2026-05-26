import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";

describe("环境配置", () => {
  it("解析 IP 白名单和受控目录", () => {
    const config = loadConfig({
      LXPANEL_SESSION_SECRET: "test-secret-with-enough-length",
      LXPANEL_IP_ALLOWLIST: "127.0.0.1;10.0.0.2",
      LXPANEL_WEB_ROOT: "C:/lxpanel/web",
      LXPANEL_FILE_ROOTS: "C:/lxpanel/data;D:/logs",
      LXPANEL_LOG_ROOTS: "C:/lxpanel/logs",
      LXPANEL_WEBHOOK_ALLOWLIST: "hooks.example.com;*.corp.local",
      LXPANEL_STATE_STORE: "sqlite",
      LXPANEL_STATE_SQLITE_PATH: "C:/lxpanel/data/lxpanel.db"
    });

    expect(config.ipAllowlist).toEqual(["127.0.0.1", "10.0.0.2"]);
    expect(config.stateStoreDriver).toBe("sqlite");
    expect(config.stateSqlitePath).toContain("lxpanel.db");
    expect(config.webRoot).toContain("lxpanel");
    expect(config.fileRoots).toHaveLength(2);
    expect(config.logRoots).toHaveLength(1);
    expect(config.webhookAllowlist).toEqual(["hooks.example.com", "*.corp.local"]);
  });
});
