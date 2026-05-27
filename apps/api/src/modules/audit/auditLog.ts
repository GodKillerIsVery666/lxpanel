import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { AuditEventSchema, type AuditEvent, type AuditExportPackage, type AuditExportQuery, type AuditIntegrityReport, type AuditPage, type AuditPageQuery, type AuditQuery, type ComplianceReport } from "@lxpanel/shared";
import { randomToken } from "../../lib/crypto.js";

export interface AuditPruneResult {
  removed: number;
  remaining: number;
}

export class AuditLog {
  constructor(private readonly filePath: string) {}

  async append(event: Omit<AuditEvent, "id" | "time" | "previousHash" | "chainHash">): Promise<void> {
    const previous = (await this.readEvents()).at(-1);
    const baseEvent: AuditEvent = {
      id: randomToken(12),
      time: new Date().toISOString(),
      ...event,
      ...(previous?.chainHash ? { previousHash: previous.chainHash } : {})
    };
    const fullEvent: AuditEvent = { ...baseEvent, chainHash: hashAuditEvent(baseEvent) };
    try {
      await mkdir(dirname(this.filePath), { recursive: true });
      await appendFile(this.filePath, `${JSON.stringify(fullEvent)}\n`, "utf8");
    } catch (error) {
      console.error("[audit] 写入审计日志失败", error);
      throw error;
    }
  }

  async list(query: AuditQuery = {}): Promise<AuditEvent[]> {
    const limit = query.limit ?? 200;
    const events = await this.readEvents();
    return filterEvents(events, query).slice(-limit).reverse();
  }

  async export(query: AuditExportQuery): Promise<string> {
    const events = filterEvents(await this.readEvents(), query).slice(-(query.limit ?? 5000));
    return query.format === "csv" ? toCsv(events) : events.map((event) => JSON.stringify(event)).join("\n");
  }

  async page(query: AuditPageQuery): Promise<AuditPage> {
    const cursor = query.cursor ? Number.parseInt(query.cursor, 10) : 0;
    const offset = Number.isFinite(cursor) && cursor >= 0 ? cursor : 0;
    const filtered = filterEvents(await this.readEvents(), query).reverse();
    const events = filtered.slice(offset, offset + query.limit);
    const nextOffset = offset + events.length;
    return { events, total: filtered.length, ...(nextOffset < filtered.length ? { nextCursor: String(nextOffset) } : {}) };
  }

  async exportSignedPackage(query: AuditExportQuery): Promise<AuditExportPackage> {
    const generatedAt = new Date().toISOString();
    const content = await this.export(query);
    const integrity = await this.verifyIntegrity();
    const contentSha256 = sha256(content);
    const manifest = {
      product: "LXPanel" as const,
      version: "0.1.0",
      format: query.format,
      generatedAt,
      contentSha256,
      ...(integrity.latestHash ? { latestHash: integrity.latestHash } : {})
    };
    return {
      generatedAt,
      format: query.format,
      contentSha256,
      manifestSha256: sha256(JSON.stringify(manifest)),
      integrity,
      eventCount: filterEvents(await this.readEvents(), query).length,
      manifest
    };
  }

  async prune(retainDays: number): Promise<AuditPruneResult> {
    const events = await this.readEvents();
    const cutoff = Date.now() - retainDays * 24 * 60 * 60 * 1000;
    const remainingEvents = events.filter((event) => new Date(event.time).getTime() >= cutoff);
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, remainingEvents.map((event) => JSON.stringify(event)).join("\n") + (remainingEvents.length > 0 ? "\n" : ""), "utf8");
    return { removed: events.length - remainingEvents.length, remaining: remainingEvents.length };
  }

  async verifyIntegrity(): Promise<AuditIntegrityReport> {
    const events = await this.readEvents();
    const issues: string[] = [];
    let previousHash = "";
    let firstBrokenId: string | undefined;
    for (const event of events) {
      if (!event.chainHash) {
        issues.push(`legacy event without chain hash: ${event.id}`);
        firstBrokenId ??= event.id;
        previousHash = "";
        continue;
      }
      const expectedPrevious = previousHash || undefined;
      if (event.previousHash !== expectedPrevious) {
        issues.push(`previous hash mismatch: ${event.id}`);
        firstBrokenId ??= event.id;
      }
      const expectedHash = hashAuditEvent(event);
      if (event.chainHash !== expectedHash) {
        issues.push(`chain hash mismatch: ${event.id}`);
        firstBrokenId ??= event.id;
      }
      previousHash = event.chainHash;
    }
    return {
      checkedAt: new Date().toISOString(),
      total: events.length,
      ok: issues.length === 0,
      ...(firstBrokenId ? { firstBrokenId } : {}),
      ...(previousHash ? { latestHash: previousHash } : {}),
      issues
    };
  }

  async complianceReport(): Promise<ComplianceReport> {
    const events = await this.readEvents();
    const counts = new Map<string, number>();
    for (const event of events) {
      counts.set(event.action, (counts.get(event.action) ?? 0) + 1);
    }
    return {
      generatedAt: new Date().toISOString(),
      totalEvents: events.length,
      actions: [...counts.entries()].map(([action, count]) => ({ action, count })).sort((left, right) => right.count - left.count),
      denied: events.filter((event) => event.status === "denied").length,
      errors: events.filter((event) => event.status === "error").length,
      integrity: await this.verifyIntegrity()
    };
  }

  private async readEvents(): Promise<AuditEvent[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return raw.split("\n")
        .filter(Boolean)
        .map(parseLine)
        .filter((result) => result !== null)
        .filter((result) => result.success)
        .map((result) => result.data);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return [];
      }
      console.error("[audit] 读取审计日志失败", error);
      throw error;
    }
  }
}

function filterEvents(events: AuditEvent[], query: AuditQuery): AuditEvent[] {
  const fromTime = query.from ? new Date(query.from).getTime() : null;
  const toTime = query.to ? new Date(query.to).getTime() : null;
  return events.filter((event) => {
    const eventTime = new Date(event.time).getTime();
    return (!query.actor || event.actor.includes(query.actor))
      && (!query.action || event.action.includes(query.action))
      && (!query.status || event.status === query.status)
      && (fromTime === null || eventTime >= fromTime)
      && (toTime === null || eventTime <= toTime);
  });
}

function parseLine(line: string) {
  try {
    return AuditEventSchema.safeParse(JSON.parse(line));
  } catch {
    return null;
  }
}

function toCsv(events: AuditEvent[]): string {
  const header = ["id", "time", "actor", "action", "target", "ip", "status", "detail", "previousHash", "chainHash"];
  return [header.join(","), ...events.map((event) => header.map((key) => csvCell(event[key as keyof AuditEvent])).join(","))].join("\n");
}

function csvCell(value: string | undefined): string {
  return `"${(value ?? "").replace(/"/gu, '""')}"`;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function hashAuditEvent(event: AuditEvent): string {
  const hashable = { ...event };
  delete hashable.chainHash;
  return sha256(JSON.stringify(hashable));
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
