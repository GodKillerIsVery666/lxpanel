import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { AuditEventSchema, type AuditEvent, type AuditExportQuery, type AuditQuery } from "@lxpanel/shared";
import { randomToken } from "../../lib/crypto.js";

export interface AuditPruneResult {
  removed: number;
  remaining: number;
}

export class AuditLog {
  constructor(private readonly filePath: string) {}

  async append(event: Omit<AuditEvent, "id" | "time">): Promise<void> {
    const fullEvent: AuditEvent = {
      id: randomToken(12),
      time: new Date().toISOString(),
      ...event
    };
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

  async prune(retainDays: number): Promise<AuditPruneResult> {
    const events = await this.readEvents();
    const cutoff = Date.now() - retainDays * 24 * 60 * 60 * 1000;
    const remainingEvents = events.filter((event) => new Date(event.time).getTime() >= cutoff);
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, remainingEvents.map((event) => JSON.stringify(event)).join("\n") + (remainingEvents.length > 0 ? "\n" : ""), "utf8");
    return { removed: events.length - remainingEvents.length, remaining: remainingEvents.length };
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
  const header = ["id", "time", "actor", "action", "target", "ip", "status", "detail"];
  return [header.join(","), ...events.map((event) => header.map((key) => csvCell(event[key as keyof AuditEvent])).join(","))].join("\n");
}

function csvCell(value: string | undefined): string {
  return `"${(value ?? "").replace(/"/gu, '""')}"`;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
