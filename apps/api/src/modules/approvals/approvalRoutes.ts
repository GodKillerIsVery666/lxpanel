import type { FastifyInstance, FastifyReply } from "fastify";
import { ApprovalDecisionSchema, ApprovalQuerySchema, CreateApprovalSchema } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { requireRole } from "../auth/authMiddleware.js";
import { ApprovalError } from "./approvalStore.js";

export function registerApprovalRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/approvals", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const query = ApprovalQuerySchema.parse(request.query);
    return { approvals: await services.approvalStore.list(query) };
  });

  app.post("/api/approvals", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = CreateApprovalSchema.parse(request.body);
    const approval = await services.approvalStore.request(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "approval.request", target: `${approval.action}:${approval.target}`, ip: request.ip, status: "success" });
    return { approval };
  });

  app.post("/api/approvals/approve", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    try {
      const input = ApprovalDecisionSchema.parse(request.body);
      const approval = await services.approvalStore.approve(input.approvalId, user.username, input.comment);
      await services.auditLog.append({ actor: user.username, action: "approval.approve", target: approval.id, ip: request.ip, status: "success" });
      return { approval };
    } catch (error) {
      if (await sendApprovalError(reply, error)) {
        return;
      }
      throw error;
    }
  });

  app.post("/api/approvals/reject", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    try {
      const input = ApprovalDecisionSchema.parse(request.body);
      const approval = await services.approvalStore.reject(input.approvalId, user.username, input.comment);
      await services.auditLog.append({ actor: user.username, action: "approval.reject", target: approval.id, ip: request.ip, status: "success" });
      return { approval };
    } catch (error) {
      if (await sendApprovalError(reply, error)) {
        return;
      }
      throw error;
    }
  });
}

export async function sendApprovalError(reply: FastifyReply, error: unknown): Promise<boolean> {
  if (!(error instanceof ApprovalError)) {
    return false;
  }
  await reply.code(400).send({ message: error.message });
  return true;
}
