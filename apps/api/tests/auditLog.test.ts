import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AuditLog } from "../src/modules/audit/auditLog.js";

const recentEvent = {
  id: "recent",
  time: new Date().toISOString(),
  actor: "admin",
  action: "backup.create",
  target: "state",
  status: "success" as const
};

const oldEvent = {
  id: "old",
  time: "2020-01-01T00:00:00.000Z",
  actor: "system",
  action: "auth.login",
  target: "session",
  status: "denied" as const
};

describe("审计日志", () => {
  it("支持筛选、导出和保留清理", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-audit-"));
    const filePath = join(root, "audit.jsonl");
    await writeFile(filePath, `${JSON.stringify(oldEvent)}\n${JSON.stringify(recentEvent)}\n`, "utf8");
    const auditLog = new AuditLog(filePath);

    const filtered = await auditLog.list({ action: "backup" });
    const csv = await auditLog.export({ format: "csv", limit: 10 });
    const jsonl = await auditLog.export({ format: "jsonl", status: "denied", limit: 10 });
    const pruned = await auditLog.prune(365);
    const remaining = await auditLog.list({ limit: 10 });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("recent");
    expect(csv).toContain("backup.create");
    expect(jsonl).toContain("auth.login");
    expect(pruned).toEqual({ removed: 1, remaining: 1 });
    expect(remaining.map((event) => event.id)).toEqual(["recent"]);
  });
});
