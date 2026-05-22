import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/crypto.js";

describe("密码哈希", () => {
  it("验证正确密码并拒绝错误密码", async () => {
    const hash = await hashPassword("Correct-Horse-2026");
    await expect(verifyPassword("Correct-Horse-2026", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });
});
