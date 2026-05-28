import { describe, expect, it } from "vitest";
import { generateRegistrationOptions, generateAssertionOptions } from "../src/modules/auth/webauthnService.js";

describe("WebAuthn 服务", () => {
  it("生成注册选项应包含挑战和 RP 信息", () => {
    const options = generateRegistrationOptions("user-1", "admin", []);
    expect(options.challenge).toBeDefined();
    expect(options.challenge.length).toBeGreaterThan(0);
    expect(options.rp.name).toBe("LXPanel");
    expect(options.rp.id).toBe("localhost");
    expect(options.user.id).toBe("user-1");
    expect(options.user.name).toBe("admin");
    expect(options.pubKeyCredParams.length).toBeGreaterThan(0);
  });

  it("生成注册选项应跳过已排除凭据", () => {
    const options = generateRegistrationOptions("user-1", "admin", [{ id: "cred-1", transports: ["usb"] }]);
    expect(options.excludeCredentials).toBeDefined();
    expect(options.excludeCredentials!.length).toBe(1);
    expect(options.excludeCredentials![0]!.id).toBe("cred-1");
  });

  it("生成断言选项应包含凭据列表", () => {
    const options = generateAssertionOptions([{ id: "cred-1", transports: ["internal"] }]);
    expect(options.challenge).toBeDefined();
    expect(options.allowCredentials.length).toBe(1);
    expect(options.allowCredentials[0]!.id).toBe("cred-1");
    expect(options.userVerification).toBe("preferred");
  });

  it("断言选项支持空凭据列表", () => {
    const options = generateAssertionOptions([]);
    expect(options.allowCredentials).toEqual([]);
  });
});
