import { describe, expect, it } from "vitest";
import { formatBytes, formatDuration } from "../utils/format.js";

describe("格式化工具", () => {
  it("格式化字节", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024 * 12)).toBe("12 MB");
  });

  it("格式化运行时长", () => {
    expect(formatDuration(60 * 62)).toBe("1 小时 2 分钟");
  });
});
