import type { FastifyInstance } from "fastify";
import { AuditExportQuerySchema, AuditPageQuerySchema, AuditQuerySchema, AuditReplayQuerySchema, AuditRetentionSchema } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { sendApprovalError } from "../approvals/approvalRoutes.js";
import { requireRole, requireUser } from "../auth/authMiddleware.js";
import { generateComplianceReportHtml, generateComplianceReportText } from "./auditReportService.js";

export function registerAuditRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/audit", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const query = AuditQuerySchema.parse(request.query);
    return { events: await services.auditLog.list(query) };
  });

  app.get("/api/audit/export", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const query = AuditExportQuerySchema.parse(request.query);
    const content = await services.auditLog.export(query);
    const extension = query.format === "csv" ? "csv" : "jsonl";
    await services.auditLog.append({ actor: user.username, action: "audit.export", target: extension, ip: request.ip, status: "success" });
    reply.header("content-type", query.format === "csv" ? "text/csv; charset=utf-8" : "application/x-ndjson; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="lxpanel-audit.${extension}"`);
    return content;
  });

  app.get("/api/audit/page", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const query = AuditPageQuerySchema.parse(request.query);
    return { page: await services.auditLog.page(query) };
  });

  app.get("/api/audit/export-package", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const query = AuditExportQuerySchema.parse(request.query);
    const auditPackage = await services.auditLog.exportSignedPackage(query);
    await services.auditLog.append({ actor: user.username, action: "audit.export_package", target: query.format, ip: request.ip, status: "success", detail: auditPackage.manifestSha256 });
    return { package: auditPackage };
  });

  app.get("/api/audit/export-bundle", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const query = AuditExportQuerySchema.parse(request.query);
    const bundle = await services.auditLog.exportBundle(query);
    await services.auditLog.append({ actor: user.username, action: "audit.export_bundle", target: query.format, ip: request.ip, status: "success", detail: bundle.manifestSha256 });
    reply.header("content-type", bundle.contentType);
    reply.header("content-disposition", `attachment; filename="${bundle.fileName}"`);
    return bundle.buffer;
  });

  app.get("/api/audit/integrity", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { report: await services.auditLog.verifyIntegrity() };
  });

  app.get("/api/audit/compliance", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { report: await services.auditLog.complianceReport() };
  });

  app.delete("/api/audit", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = AuditRetentionSchema.parse(request.query);
    try {
      await services.approvalStore.consume({ approvalId: input.approvalId, action: "audit.prune", target: `${input.retainDays}d`, actor: user.username });
    } catch (error) {
      if (await sendApprovalError(reply, error)) {
        return;
      }
      throw error;
    }
    const result = await services.auditLog.prune(input.retainDays);
    await services.auditLog.append({ actor: user.username, action: "audit.prune", target: `${input.retainDays}d`, ip: request.ip, status: "success", detail: `removed=${result.removed}` });
    return { result };
  });

  // ---- 审计合规报告导出 ----
  app.get("/api/audit/compliance-report", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const { format } = (request.query ?? {}) as { format?: "html" | "txt" };
    const [compliance, integrity] = await Promise.all([
      services.auditLog.complianceReport(),
      services.auditLog.verifyIntegrity()
    ]);
    const input = { compliance, integrity, generatedAt: new Date().toISOString() };

    if (format === "txt") {
      const text = generateComplianceReportText(input);
      reply.header("content-type", "text/plain; charset=utf-8");
      reply.header("content-disposition", `attachment; filename="lxpanel-compliance-report.txt"`);
      return text;
    }
    const html = generateComplianceReportHtml(input);
    reply.header("content-type", "text/html; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="lxpanel-compliance-report.html"`);
    return html;
  });

  // ---- 审计重放 API ----
  app.get("/api/audit/replay", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const query = AuditReplayQuerySchema.parse(request.query);
    const events = await services.auditLog.list({ ...(query.from ? { from: query.from } : {}), ...(query.to ? { to: query.to } : {}) });
    const filtered = query.eventTypes ? events.filter((ev) => query.eventTypes!.includes(ev.action)) : events;
    
    if (query.format === "tar") {
      const content = filtered.map((ev) => JSON.stringify(ev)).join("\n");
      reply.header("content-type", "application/x-tar");
      reply.header("content-disposition", `attachment; filename="lxpanel-audit-replay.tar"`);
      return content;
    }
    
    reply.header("content-type", "application/x-ndjson; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="lxpanel-audit-replay.jsonl"`);
    return filtered.map((ev) => JSON.stringify(ev)).join("\n");
  });
}
