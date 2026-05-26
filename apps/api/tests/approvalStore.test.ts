import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JsonStore } from "../src/lib/jsonStore.js";
import { ApprovalStore } from "../src/modules/approvals/approvalStore.js";
import { createInitialPanelState, type PanelState } from "../src/modules/state/panelState.js";

describe("审批流", () => {
  it("创建、批准并一次性消费审批单", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-approval-"));
    const stateStore = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const approvalStore = new ApprovalStore(stateStore);

    const approval = await approvalStore.request({ action: "audit.prune", target: "30d", reason: "cleanup", requiredApprovals: 1, expiresInMinutes: 30 }, "owner");
    await expect(approvalStore.consume({ approvalId: approval.id, action: "audit.prune", target: "30d", actor: "owner" })).rejects.toThrow("审批单尚未批准");

    const approved = await approvalStore.approve(approval.id, "owner");
    const consumed = await approvalStore.consume({ approvalId: approved.id, action: "audit.prune", target: "30d", actor: "owner" });
    const approvals = await approvalStore.list();

    expect(approved.status).toBe("approved");
    expect(consumed.status).toBe("used");
    expect(approvals[0]?.status).toBe("used");
    await expect(approvalStore.consume({ approvalId: approved.id, action: "audit.prune", target: "30d", actor: "owner" })).rejects.toThrow("审批单尚未批准");
  });

  it("需要达到配置的批准人数才可消费", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-approval-multi-"));
    const stateStore = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const approvalStore = new ApprovalStore(stateStore);

    const approval = await approvalStore.request({ action: "backup.restore", target: "backup-1", reason: "restore", requiredApprovals: 2, expiresInMinutes: 30 }, "owner");
    const first = await approvalStore.approve(approval.id, "owner-a");
    await expect(approvalStore.consume({ approvalId: approval.id, action: "backup.restore", target: "backup-1", actor: "owner" })).rejects.toThrow("审批单尚未批准");
    const second = await approvalStore.approve(approval.id, "owner-b");
    const consumed = await approvalStore.consume({ approvalId: approval.id, action: "backup.restore", target: "backup-1", actor: "owner" });

    expect(first.status).toBe("pending");
    expect(first.approvedCount).toBe(1);
    expect(second.status).toBe("approved");
    expect(second.approvedCount).toBe(2);
    expect(consumed.status).toBe("used");
  });
});
