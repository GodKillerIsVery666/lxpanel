import { mkdir, readFile, appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import { AuditEventSchema, type AuditEvent } from "@lxpanel/shared";
import { randomToken } from "../../lib/crypto.js";

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

  async list(limit = 200): Promise<AuditEvent[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return raw.split("\n")
        .filter(Boolean)
        .slice(-limit)
        .map((line) => AuditEventSchema.safeParse(JSON.parse(line)))
        .filter((result) => result.success)
        .map((result) => result.data)
        .reverse();
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return [];
      }
      console.error("[audit] 读取审计日志失败", error);
      throw error;
    }
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
