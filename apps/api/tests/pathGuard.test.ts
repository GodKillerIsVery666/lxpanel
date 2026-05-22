import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveManagedPath } from "../src/modules/files/pathGuard.js";

describe("受控路径", () => {
  it("允许管理根目录内路径", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-"));
    const result = resolveManagedPath(".", [root]);
    expect(result.root).toBe(root);
    expect(result.path).toBe(root);
  });

  it("拒绝逃逸管理根目录", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-"));
    expect(() => resolveManagedPath("..", [root])).toThrow("路径不在允许的管理目录内");
  });
});
