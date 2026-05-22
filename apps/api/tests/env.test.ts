import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";

describe("环境配置", () => {
  it("解析 IP 白名单和受控目录", () => {
    const config = loadConfig({
      LXPANEL_SESSION_SECRET: "test-secret-with-enough-length",
      LXPANEL_IP_ALLOWLIST: "127.0.0.1;10.0.0.2",
      LXPANEL_FILE_ROOTS: "C:/lxpanel/data;D:/logs",
      LXPANEL_LOG_ROOTS: "C:/lxpanel/logs"
    });

    expect(config.ipAllowlist).toEqual(["127.0.0.1", "10.0.0.2"]);
    expect(config.fileRoots).toHaveLength(2);
    expect(config.logRoots).toHaveLength(1);
  });
});
