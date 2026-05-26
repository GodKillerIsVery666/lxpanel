import type { AccessEvaluation, AccessEvaluationRequest, AccessPolicy, CapacityPlan, CreateAccessPolicy, DeliveryChecklist, OpenApiSummary, SecurityRemediationRequest, SecurityRemediationRun, UpgradePlan } from "@lxpanel/shared";
import { randomToken } from "../../lib/crypto.js";
import type { StateStore } from "../../lib/stateStore.js";
import type { PanelState, SecurityRemediationRunRecord } from "../state/panelState.js";

const currentVersion = "0.1.0";

export class PlatformStore {
  constructor(private readonly store: StateStore<PanelState>) {}

  async listAccessPolicies(): Promise<AccessPolicy[]> {
    const state = await this.store.read();
    return (state.accessPolicies ?? []).slice().reverse();
  }

  async createAccessPolicy(input: CreateAccessPolicy, actor: string): Promise<AccessPolicy> {
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const policy: AccessPolicy = { id: randomToken(12), ...input, createdAt: now, updatedAt: now, updatedBy: actor };
      return { data: { ...state, accessPolicies: [...(state.accessPolicies ?? []), policy].slice(-500) }, result: policy };
    });
  }

  async evaluateAccess(input: AccessEvaluationRequest): Promise<AccessEvaluation> {
    const state = await this.store.read();
    const policy = (state.accessPolicies ?? []).find((item) => item.workspace === input.workspace && item.resourceType === input.resourceType && (item.resourceId === input.resourceId || item.resourceId === "*") && item.role === input.role && item.permissions.includes(input.permission));
    return { ...input, allowed: Boolean(policy), ...(policy ? { matchedPolicyId: policy.id } : {}) };
  }

  async remediationRuns(): Promise<SecurityRemediationRun[]> {
    const state = await this.store.read();
    return (state.securityRemediationRuns ?? []).slice().reverse();
  }

  async createRemediationRun(input: SecurityRemediationRequest, actor: string): Promise<SecurityRemediationRun> {
    const command = remediationCommand(input.itemId);
    const run: SecurityRemediationRunRecord = {
      id: randomToken(12),
      itemId: input.itemId,
      dryRun: input.dryRun,
      status: input.dryRun ? "planned" : command ? "success" : "failed",
      ...(command ? { command } : {}),
      outputTail: input.dryRun ? "dry-run: 已生成修复动作，未改动系统。" : command ? "已记录受控修复动作；生产执行前请核对回滚步骤。" : "未知修复项。",
      createdAt: new Date().toISOString(),
      createdBy: actor
    };
    await this.store.update((state) => ({ data: { ...state, securityRemediationRuns: [...(state.securityRemediationRuns ?? []), run].slice(-200) }, result: undefined }));
    return run;
  }

  async capacityPlan(): Promise<CapacityPlan> {
    const state = await this.store.read();
    const stateBytes = Buffer.byteLength(JSON.stringify(state), "utf8");
    const recommendations = [
      stateBytes > 5_000_000 ? "状态文件已超过 5MB，建议启用 SQLite 并归档历史样本。" : "当前状态体积适合轻量部署。",
      (state.metricSamples ?? []).length > 1000 ? "监控样本较多，建议开启历史归档和图表分页加载。" : "监控样本数量处于可控范围。",
      (state.hosts ?? []).length > 50 ? "主机数量较多，建议使用主机组和批量任务分批执行。" : "主机数量适合当前调度并发。"
    ];
    return { generatedAt: new Date().toISOString(), stateBytes, metricSamples: (state.metricSamples ?? []).length, hosts: (state.hosts ?? []).length, recommendations };
  }

  async upgradePlan(): Promise<UpgradePlan> {
    const state = await this.store.read();
    return {
      generatedAt: new Date().toISOString(),
      currentVersion,
      steps: [
        { id: "pre-backup", title: "升级前备份", status: (state.backups ?? []).length > 0 ? "ready" : "warn", detail: (state.backups ?? []).length > 0 ? "已有可回滚状态备份。" : "升级前建议先创建状态备份。" },
        { id: "state-migration", title: "状态迁移预检", status: "ready", detail: "可使用 scripts/migrate-state.mjs 补齐新增状态字段。" },
        { id: "package-verify", title: "发布包校验", status: "ready", detail: "发布包生成 .sha256 校验文件，可在离线环境核对。" }
      ]
    };
  }

  async deliveryChecklist(): Promise<DeliveryChecklist> {
    const state = await this.store.read();
    return {
      generatedAt: new Date().toISOString(),
      items: [
        { id: "session-secret", title: "强会话密钥", ready: true, detail: "部署时必须覆盖 LXPANEL_SESSION_SECRET。" },
        { id: "remote-backup", title: "远程备份目标", ready: (state.remoteBackupTargets ?? []).length > 0, detail: "建议至少配置一个文件系统或 S3 兼容远程目标。" },
        { id: "audit-integrity", title: "审计完整性", ready: true, detail: "新写入审计事件带哈希链，可执行完整性检查。" },
        { id: "offline-package", title: "离线交付包", ready: true, detail: "release 包含构建产物、脚本、部署模板和校验文件。" }
      ]
    };
  }

  openApiSummary(): OpenApiSummary {
    return {
      generatedAt: new Date().toISOString(),
      paths: [
        { method: "GET", path: "/api/system/overview", scope: "system:read" },
        { method: "GET", path: "/api/backups", scope: "backups:read" },
        { method: "POST", path: "/api/backups/remote-sync", scope: "backups:write" },
        { method: "POST", path: "/api/databases/restore-drill", scope: "databases:write" },
        { method: "POST", path: "/api/hosts/batch-command", scope: "hosts:write" },
        { method: "GET", path: "/api/audit/integrity", scope: "audit:read" },
        { method: "GET", path: "/api/platform/openapi-summary", scope: "platform:read" }
      ],
      webhookEvents: ["alert.warning", "alert.critical", "approval.requested", "approval.progress", "approval.rejected", "security.remediation"]
    };
  }
}

function remediationCommand(itemId: string): string | undefined {
  const commands: Record<string, string> = {
    "firewall-management-network": "ufw allow from <管理网段> to any port <面板端口>",
    "ssh-disable-password": "set PasswordAuthentication no and reload sshd",
    "ssh-disable-root": "set PermitRootLogin no and reload sshd",
    "docker-socket-boundary": "move Docker operations to trusted connector or rootless Docker"
  };
  return commands[itemId];
}
