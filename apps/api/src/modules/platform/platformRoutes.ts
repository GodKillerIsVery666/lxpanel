import type { FastifyInstance } from "fastify";
import { AccessEvaluationRequestSchema, CreateAccessPolicySchema, SecurityRemediationRequestSchema } from "@lxpanel/shared";
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
}
