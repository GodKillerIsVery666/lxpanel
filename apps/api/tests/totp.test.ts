import { describe, expect, it } from "vitest";
import { buildTotpUri, generateTotpCodeForTest, generateTotpSecret, verifyTotpCode } from "../src/lib/totp.js";

describe("TOTP", () => {
  it("生成并验证 6 位验证码", () => {
    const secret = generateTotpSecret();
    const now = Date.UTC(2026, 4, 22, 8, 0, 0);
    const code = generateTotpCodeForTest(secret, now);

    expect(code).toMatch(/^\d{6}$/u);
    expect(verifyTotpCode(secret, code, now)).toBe(true);
    expect(verifyTotpCode(secret, "000000", now)).toBe(code === "000000");
  });

  it("生成 otpauth URI", () => {
    const secret = generateTotpSecret();
    const uri = buildTotpUri(secret, "admin");

    expect(uri).toContain("otpauth://totp/LXPanel:admin");
    expect(uri).toContain(`secret=${secret}`);
  });
});
