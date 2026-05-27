import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AccessEvaluationRequestSchema, CreateAccessPolicySchema, CreateResourceApprovalPolicySchema, CreateTemplateRepositorySchema, CreateTerminalSessionSchema, SecurityRemediationRequestSchema, StateArchiveRequestSchema, TerminalInputSchema, UpdateLicenseSchema } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { sendApprovalError } from "../approvals/approvalRoutes.js";
import { requireRole, requireUser } from "../auth/authMiddleware.js";

export function registerPlatformRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/platform/access-policies", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { policies: await services.platformStore.listAccessPolicies() };
  });

  app.post("/api/platform/access-policies", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = CreateAccessPolicySchema.parse(request.body);
    const policy = await services.platformStore.createAccessPolicy(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.access_policy.create", target: `${policy.workspace}:${policy.resourceType}:${policy.resourceId}`, ip: request.ip, status: "success" });
    return { policy };
  });

  app.post("/api/platform/access-evaluate", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const input = AccessEvaluationRequestSchema.parse(request.body);
    return { evaluation: await services.platformStore.evaluateAccess(input) };
  });

  app.get("/api/platform/terminal-sessions", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    return { sessions: await services.platformStore.listTerminalSessions() };
  });

  app.post("/api/platform/terminal-sessions", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = CreateTerminalSessionSchema.parse(request.body);
    const target = (await services.hostService.resolveCommandTargets([input.hostId]))[0];
    if (!target) {
      await reply.code(404).send({ message: "主机不存在。" });
      return;
    }
    const destination = `${input.username ? `${input.username}@` : ""}${target.host.address ?? target.host.name}`;
    const command = await services.connectorStore.createCommand({ connectorId: target.connectorId, command: "terminal.open", args: [destination, String(input.rows), String(input.cols)] }, user.username);
    const session = await services.platformStore.createTerminalSession(input, target.host.name, target.connectorId, command.id, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.terminal.open", target: target.host.name, ip: request.ip, status: "success" });
    return { session, command };
  });

  app.post("/api/platform/terminal-sessions/input", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = TerminalInputSchema.parse(request.body);
    const session = await services.platformStore.terminalSession(input.sessionId);
    if (!session) {
      await reply.code(404).send({ message: "终端会话不存在。" });
      return;
    }
    const command = await services.connectorStore.createCommand({ connectorId: session.connectorId, command: "terminal.input", args: [session.id, input.input] }, user.username);
    const updated = await services.platformStore.appendTerminalInput(input, command.id);
    await services.auditLog.append({ actor: user.username, action: "platform.terminal.input", target: session.hostName, ip: request.ip, status: "success" });
    return { session: updated, command };
  });

  app.post("/api/platform/terminal-sessions/close", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = z.object({ sessionId: z.string().min(1) }).parse(request.body);
    const session = await services.platformStore.terminalSession(input.sessionId);
    if (!session) {
      await reply.code(404).send({ message: "终端会话不存在。" });
      return;
    }
    const command = await services.connectorStore.createCommand({ connectorId: session.connectorId, command: "terminal.close", args: [session.id] }, user.username);
    const updated = await services.platformStore.closeTerminalSession(session.id);
    await services.auditLog.append({ actor: user.username, action: "platform.terminal.close", target: session.hostName, ip: request.ip, status: "success" });
    return { session: updated, command };
  });

  app.get("/api/platform/template-repositories", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    return { repositories: await services.platformStore.listTemplateRepositories() };
  });

  app.post("/api/platform/template-repositories", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = CreateTemplateRepositorySchema.parse(request.body);
    const repository = await services.platformStore.createTemplateRepository(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.template_repository.create", target: repository.name, ip: request.ip, status: "success" });
    return { repository };
  });

  app.post("/api/platform/template-repositories/sync", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = z.object({ repositoryId: z.string().min(1) }).parse(request.body);
    const repository = await services.platformStore.syncTemplateRepository(input.repositoryId, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.template_repository.sync", target: repository.name, ip: request.ip, status: repository.lastStatus === "success" ? "success" : "error" });
    return { repository };
  });

  app.get("/api/platform/license", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { status: await services.platformStore.licenseStatus() };
  });

  app.put("/api/platform/license", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = UpdateLicenseSchema.parse(request.body);
    const status = await services.platformStore.updateLicense(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.license.update", target: status.license.plan, ip: request.ip, status: "success" });
    return { status };
  });

  app.get("/api/platform/approval-policies", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { policies: await services.platformStore.listApprovalPolicies() };
  });

  app.post("/api/platform/approval-policies", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = CreateResourceApprovalPolicySchema.parse(request.body);
    const policy = await services.platformStore.createApprovalPolicy(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.approval_policy.create", target: `${policy.resourceType}:${policy.resourceId}`, ip: request.ip, status: "success" });
    return { policy };
  });

  app.get("/api/platform/remediations", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    return { runs: await services.platformStore.remediationRuns() };
  });

  app.post("/api/platform/remediations", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = SecurityRemediationRequestSchema.parse(request.body);
    if (!input.dryRun) {
      try {
        await services.approvalStore.consume({ approvalId: input.approvalId ?? "", action: "security.remediate", target: input.itemId, actor: user.username });
      } catch (error) {
        if (await sendApprovalError(reply, error)) {
          return;
        }
        throw error;
      }
    }
    const run = await services.platformStore.createRemediationRun(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "security.remediation", target: input.itemId, ip: request.ip, status: run.status === "failed" ? "error" : "success", detail: run.outputTail });
    return { run };
  });

  app.get("/api/platform/capacity-plan", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { plan: await services.platformStore.capacityPlan() };
  });

  app.get("/api/platform/upgrade-plan", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { plan: await services.platformStore.upgradePlan() };
  });

  app.get("/api/platform/delivery-checklist", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { checklist: await services.platformStore.deliveryChecklist() };
  });

  app.get("/api/platform/openapi-summary", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { summary: services.platformStore.openApiSummary() };
  });

  app.post("/api/platform/archive-state", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = StateArchiveRequestSchema.parse(request.body ?? {});
    const result = await services.platformStore.archiveState(input);
    await services.auditLog.append({ actor: user.username, action: "platform.archive_state", target: input.dryRun ? "dry-run" : "apply", ip: request.ip, status: "success", detail: `before=${result.beforeBytes};after=${result.afterBytes}` });
    return { result };
  });

  app.get("/api/platform/installer-guide", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { guide: services.platformStore.installerGuide() };
  });

  app.get("/api/platform/sdk-examples", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { examples: services.platformStore.sdkExamples() };
  });

  app.get("/api/platform/frontend-quality", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { report: services.platformStore.frontendQualityReport() };
  });
}
