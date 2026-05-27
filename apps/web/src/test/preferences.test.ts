import { describe, expect, it } from "vitest";
import { isTableDensity, isViewId, mergeRecentViews } from "../utils/preferences.js";

describe("偏好工具", () => {
  it("合并最近访问并去重", () => {
    expect(mergeRecentViews("apps", ["dashboard", "apps", "hosts"])).toEqual(["apps", "dashboard", "hosts"]);
  });

  it("限制最近访问数量", () => {
    expect(mergeRecentViews("audit", ["dashboard", "hosts", "apps", "databases", "security"], 3)).toEqual(["audit", "dashboard", "hosts"]);
  });

  it("识别合法视图和表格密度", () => {
    expect(isViewId("platform")).toBe(true);
    expect(isViewId("missing")).toBe(false);
    expect(isTableDensity("compact")).toBe(true);
    expect(isTableDensity("dense")).toBe(false);
  });
});
