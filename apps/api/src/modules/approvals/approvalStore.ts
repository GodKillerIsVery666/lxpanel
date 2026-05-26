import type { Approval, ApprovalAction, ApprovalQuery, CreateApproval } from "@lxpanel/shared";
import { randomToken } from "../../lib/crypto.js";
import type { StateStore } from "../../lib/stateStore.js";
import type { ApprovalRecord, PanelState } from "../state/panelState.js";

export class ApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalError";
  }
}

export interface ApprovalConsumeInput {
  approvalId: string;
  action: ApprovalAction;
  target: string;
  actor: string;
}

export class ApprovalStore {
  constructor(private readonly store: StateStore<PanelState>) {}

  async list(query: ApprovalQuery = {}): Promise<Approval[]> {
    const state = await this.store.read();
    const approvals = (state.approvals ?? [])
      .map(toApproval)
      .filter((approval) => !query.status || approval.status === query.status)
      .filter((approval) => !query.action || approval.action === query.action)
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));
    return approvals.slice(0, query.limit ?? 200);
  }

  async request(input: CreateApproval, actor: string): Promise<Approval> {
    return this.store.update((state) => {
      const requestedAt = new Date();
      const record: ApprovalRecord = {
        id: randomToken(10),
        action: input.action,
        target: input.target,
        reason: input.reason,
        status: "pending",
        requiredApprovals: input.requiredApprovals,
        approvedCount: 0,
        reviews: [],
        requestedBy: actor,
        requestedAt: requestedAt.toISOString(),
        expiresAt: new Date(requestedAt.getTime() + input.expiresInMinutes * 60_000).toISOString()
      };
      return { data: { ...state, approvals: [...(state.approvals ?? []), record].slice(-1000) }, result: toApproval(record) };
    });
  }

  async approve(approvalId: string, actor: string, comment?: string): Promise<Approval> {
    return this.review(approvalId, actor, "approved", comment);
  }

  async reject(approvalId: string, actor: string, comment?: string): Promise<Approval> {
    return this.review(approvalId, actor, "rejected", comment);
  }

  async consume(input: ApprovalConsumeInput): Promise<Approval> {
    return this.store.update((state) => {
      const approvals = state.approvals ?? [];
      const index = approvals.findIndex((item) => item.id === input.approvalId);
      if (index < 0) {
        throw new ApprovalError("审批单不存在。");
      }
      const current = approvals[index];
      if (!current) {
        throw new ApprovalError("审批单不存在。");
      }
      if (current.action !== input.action || current.target !== input.target) {
        throw new ApprovalError("审批单与当前操作不匹配。");
      }
      if (current.status !== "approved") {
        throw new ApprovalError("审批单尚未批准或已被使用。");
      }
      if (readApprovedCount(current) < readRequiredApprovals(current)) {
        throw new ApprovalError("审批单批准人数不足。");
      }
      if (isExpired(current)) {
        throw new ApprovalError("审批单已过期。");
      }
      const consumed: ApprovalRecord = {
        ...current,
        status: "used",
        consumedBy: input.actor,
        consumedAt: new Date().toISOString()
      };
      return { data: { ...state, approvals: replaceAt(approvals, index, consumed) }, result: toApproval(consumed) };
    });
  }

  private async review(approvalId: string, actor: string, status: "approved" | "rejected", comment?: string): Promise<Approval> {
    return this.store.update((state) => {
      const approvals = state.approvals ?? [];
      const index = approvals.findIndex((item) => item.id === approvalId);
      if (index < 0) {
        throw new ApprovalError("审批单不存在。");
      }
      const current = approvals[index];
      if (!current) {
        throw new ApprovalError("审批单不存在。");
      }
      if (current.status !== "pending") {
        throw new ApprovalError("只有待审批记录可以处理。");
      }
      if (isExpired(current)) {
        throw new ApprovalError("审批单已过期。");
      }
      if ((current.reviews ?? []).some((review) => review.reviewedBy === actor)) {
        throw new ApprovalError("当前账号已处理过该审批单。");
      }
      const reviewedAt = new Date().toISOString();
      const reviews = [
        ...(current.reviews ?? []),
        { reviewedBy: actor, reviewedAt, decision: status, ...(comment ? { comment } : {}) }
      ];
      const approvedCount = reviews.filter((review) => review.decision === "approved").length;
      const finalStatus = status === "rejected" ? "rejected" : approvedCount >= readRequiredApprovals(current) ? "approved" : "pending";
      const reviewed: ApprovalRecord = {
        ...current,
        requiredApprovals: readRequiredApprovals(current),
        approvedCount,
        reviews,
        status: finalStatus,
        reviewedBy: actor,
        reviewedAt,
        ...(comment ? { reviewComment: comment } : {})
      };
      return { data: { ...state, approvals: replaceAt(approvals, index, reviewed) }, result: toApproval(reviewed) };
    });
  }
}

function toApproval(record: ApprovalRecord): Approval {
  const approval = {
    ...record,
    requiredApprovals: readRequiredApprovals(record),
    approvedCount: readApprovedCount(record),
    reviews: record.reviews ?? []
  };
  return isExpired(record) && (record.status === "pending" || record.status === "approved") ? { ...approval, status: "expired" } : approval;
}

function readRequiredApprovals(record: ApprovalRecord): number {
  return record.requiredApprovals ?? 1;
}

function readApprovedCount(record: ApprovalRecord): number {
  return record.approvedCount ?? (record.status === "approved" ? readRequiredApprovals(record) : 0);
}

function isExpired(record: ApprovalRecord): boolean {
  return new Date(record.expiresAt).getTime() <= Date.now();
}

function replaceAt(items: ApprovalRecord[], index: number, item: ApprovalRecord): ApprovalRecord[] {
  return [...items.slice(0, index), item, ...items.slice(index + 1)];
}
