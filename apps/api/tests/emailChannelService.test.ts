import { describe, expect, it, vi } from "vitest";
import { sendSmtpEmail, type SmtpConfig } from "../src/modules/notifications/emailChannelService.js";

describe("SMTP 邮件发送", () => {
  const baseConfig: SmtpConfig = {
    host: "smtp.example.com",
    port: 587,
    secure: false,
    username: "user@example.com",
    password: "secret",
    from: "lxpanel@example.com"
  };

  it("向无 SMTP 服务器发送应返回错误", { timeout: 3000 }, async () => {
    const config = { ...baseConfig, host: "127.0.0.1", port: 1 };
    const result = await sendSmtpEmail(config, "test@example.com", "Test", "Hello");
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("空收件人地址应报错", async () => {
    const config = { ...baseConfig, host: "127.0.0.1", port: 1 };
    const result = await sendSmtpEmail(config, "", "Test", "Body");
    expect(result.ok).toBe(false);
  });

  it("无效 SMTP 配置应优雅失败", async () => {
    const result = await sendSmtpEmail({ host: "", port: 0, secure: false, username: "", password: "", from: "" }, "test@test.com", "Test", "Body");
    expect(result.ok).toBe(false);
  });

  it("超短超时连接应返回错误", { timeout: 3000 }, async () => {
    const config = { ...baseConfig, host: "127.0.0.1", port: 1 };
    const result = await sendSmtpEmail(config, "test@example.com", "Test", "Body");
    expect(result.ok).toBe(false);
  });
});
