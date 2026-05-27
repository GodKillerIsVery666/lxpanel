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

  it("为新写入事件生成哈希链并可输出合规报表", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-audit-chain-"));
    const auditLog = new AuditLog(join(root, "audit.jsonl"));

    await auditLog.append({ actor: "admin", action: "auth.login", target: "session", status: "success" });
    await auditLog.append({ actor: "admin", action: "backup.create", target: "state", status: "success" });
    const events = await auditLog.list({ limit: 10 });
    const integrity = await auditLog.verifyIntegrity();
    const compliance = await auditLog.complianceReport();

    expect(events[0]?.chainHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(integrity.ok).toBe(true);
    expect(compliance.actions.some((item) => item.action === "backup.create" && item.count === 1)).toBe(true);
  });

  it("支持分页读取和签名导出包", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-audit-page-"));
    const auditLog = new AuditLog(join(root, "audit.jsonl"));
    await auditLog.append({ actor: "admin", action: "one", target: "a", status: "success" });
    await auditLog.append({ actor: "admin", action: "two", target: "b", status: "success" });
    await auditLog.append({ actor: "admin", action: "three", target: "c", status: "success" });

    const firstPage = await auditLog.page({ limit: 2 });
    const secondPage = await auditLog.page({ limit: 2, cursor: firstPage.nextCursor });
    const auditPackage = await auditLog.exportSignedPackage({ format: "jsonl", limit: 10 });

    expect(firstPage.events.map((event) => event.action)).toEqual(["three", "two"]);
    expect(secondPage.events.map((event) => event.action)).toEqual(["one"]);
    expect(auditPackage.contentSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(auditPackage.manifestSha256).toMatch(/^[a-f0-9]{64}$/u);
  });
});
