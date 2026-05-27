import type { FastifyReply } from "fastify";
import type { ResourceApprovalCheck } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { sendApprovalError } from "../approvals/approvalRoutes.js";

export async function enforceResourceApproval(services: Services, reply: FastifyReply, input: ResourceApprovalCheck, actor: string): Promise<boolean> {
  const policy = await services.platformStore.requiredApprovalPolicy(input);
  if (!policy) {
    return true;
  }
  try {
    await services.approvalStore.consume({ approvalId: input.approvalId ?? "", action: "resource.access", target: resourceApprovalTarget(input), actor, minimumApprovals: policy.requiredApprovals });
    return true;
  } catch (error) {
    if (await sendApprovalError(reply, error)) {
      return false;
    }
    throw error;
  }
}

export function resourceApprovalTarget(input: Pick<ResourceApprovalCheck, "resourceType" | "resourceId" | "action" | "workspace">): string {
  return `${input.workspace || "default"}:${input.resourceType}:${input.resourceId}:${input.action}`;
}