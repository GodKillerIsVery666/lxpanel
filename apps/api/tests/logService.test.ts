import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listLogEntries, listLogRoots, tailLogFile } from "../src/modules/logs/logService.js";

describe("日志服务", () => {
  it("列出日志根目录和目录项", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-logs-"));
    await mkdir(join(root, "nginx"));
    await writeFile(join(root, "app.log"), "line-1\nline-2\n", "utf8");

    expect(listLogRoots([root])).toEqual([{ path: root, label: root.split(/[\\/]/u).at(-1) }]);
    const listing = await listLogEntries(root, [root]);
    expect(listing.entries.map((entry) => entry.name)).toEqual(["nginx", "app.log"]);
  });

  it("读取日志尾部并限制行数", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-tail-"));
    const filePath = join(root, "app.log");
    const lines = Array.from({ length: 25 }, (_, index) => `line-${index + 1}`);
    await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");

    const tail = await tailLogFile(filePath, [root], 2);
    expect(tail.lines).toEqual(lines.slice(-20));
    expect(tail.truncated).toBe(true);
  });

  it("拒绝读取日志根目录外文件", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-root-"));
    const outside = await mkdtemp(join(tmpdir(), "lxpanel-outside-"));
    const filePath = join(outside, "app.log");
    await writeFile(filePath, "secret\n", "utf8");

    await expect(tailLogFile(filePath, [root], 50)).rejects.toThrow("路径不在允许的管理目录内");
  });
});
