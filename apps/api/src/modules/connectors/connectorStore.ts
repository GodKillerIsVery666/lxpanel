import type { Connector, ConnectorCommand, ConnectorCommandResult, ConnectorCompatibility, ConnectorHeartbeat, ConnectorUpgradePlan, ConnectorUpgradeRequest, ConnectorVersionPolicy, CreateConnector, CreateConnectorCommand } from "@lxpanel/shared";
import { createHmac, timingSafeEqual } from "node:crypto";
import { randomToken, sha256 } from "../../lib/crypto.js";
import type { StateStore } from "../../lib/stateStore.js";
import type { ConnectorCommandRecord, ConnectorRecord, MetricSampleRecord, PanelState } from "../state/panelState.js";

const staleAfterMs = 1000 * 60 * 3;
const offlineAfterMs = 1000 * 60 * 15;
const connectorMinimumSupportedVersion = "node-agent-0.1";
const connectorRecommendedVersion = "node-agent-0.2";
const connectorLatestVersion = "node-agent-0.2";
const connectorChannels = [
  { name: "stable", version: connectorRecommendedVersion, rolloutPercent: 100, notes: "生产推荐版本，包含签名校验和诊断能力。" },
  { name: "candidate", version: connectorLatestVersion, rolloutPercent: 25, notes: "灰度候选版本，适合少量主机先行验证。" }
];

export interface CreatedConnector {
  connector: Connector;
  token: string;
}

export class ConnectorStore {
  constructor(private readonly store: StateStore<PanelState>) {}

  async create(input: CreateConnector): Promise<CreatedConnector> {
    const token = randomToken(32);
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const record: ConnectorRecord = {
        id: randomToken(12),
        name: input.name,
        ...(input.description ? { description: input.description } : {}),
        capabilities: input.capabilities,
        tokenHash: sha256(token),
        createdAt: now
      };
      return {
        data: { ...state, connectors: [...state.connectors, record] },
        result: { connector: toConnector(record), token }
      };
    });
  }

  async list(): Promise<Connector[]> {
    const state = await this.store.read();
    return state.connectors.map(toConnector);
  }

  async listCommands(connectorId?: string): Promise<ConnectorCommand[]> {
    const state = await this.store.read();
    return (state.connectorCommands ?? [])
      .filter((command) => !connectorId || command.connectorId === connectorId)
      .slice(-100)
      .reverse()
      .map((command) => toCommand(command, state.connectors));
  }

  async count(): Promise<number> {
    const state = await this.store.read();
    return state.connectors.length;
  }

  async heartbeat(token: string, heartbeat: ConnectorHeartbeat): Promise<Connector | null> {
    const tokenHash = sha256(token);
    return this.store.update((state) => {
      const record = state.connectors.find((item) => item.tokenHash === tokenHash);
      if (!record) {
        return { data: state, result: null };
      }
      const updated: ConnectorRecord = {
        ...record,
        capabilities: heartbeat.capabilities.length > 0 ? heartbeat.capabilities : record.capabilities,
        ...(heartbeat.version ? { version: heartbeat.version } : {}),
        ...connectorUpgradePatch({ ...record, ...(heartbeat.version ? { version: heartbeat.version } : {}) }),
        lastSeenAt: new Date().toISOString()
      };
      const metricSample: MetricSampleRecord | undefined = heartbeat.metrics ? {
        id: randomToken(12),
        hostId: heartbeat.metrics.hostId,
        hostName: heartbeat.metrics.hostName,
        time: new Date().toISOString(),
        cpuPercent: heartbeat.metrics.cpuPercent,
        memoryPercent: heartbeat.metrics.memoryPercent,
        ...(typeof heartbeat.metrics.diskUsedPercent === "number" ? { diskUsedPercent: heartbeat.metrics.diskUsedPercent } : {})
      } : undefined;
      return {
        data: {
          ...state,
          connectors: state.connectors.map((item) => item.id === record.id ? updated : item),
          ...(metricSample ? { metricSamples: [...(state.metricSamples ?? []), metricSample].slice(-10_000) } : {})
        },
        result: toConnector(updated)
      };
    });
  }

  async createCommand(input: CreateConnectorCommand, actor: string): Promise<ConnectorCommand> {
    return this.store.update((state) => {
      const connector = state.connectors.find((item) => item.id === input.connectorId);
      if (!connector) {
        throw new Error("连接器不存在。");
      }
      const record: ConnectorCommandRecord = {
        id: randomToken(12),
        connectorId: connector.id,
        command: input.command,
        args: input.args,
        status: "queued",
        createdAt: new Date().toISOString(),
        createdBy: actor
      };
      const signaturePayload = commandSignaturePayload(record);
      const signedRecord: ConnectorCommandRecord = {
        ...record,
        signaturePayload,
        signature: signPayload(connector.tokenHash, signaturePayload)
      };
      return {
        data: { ...state, connectorCommands: [...(state.connectorCommands ?? []), signedRecord].slice(-500) },
        result: toCommand(signedRecord, state.connectors)
      };
    });
  }

  async claimCommands(token: string, limit = 5): Promise<ConnectorCommand[] | null> {
    const tokenHash = sha256(token);
    return this.store.update((state) => {
      const connector = state.connectors.find((item) => item.tokenHash === tokenHash);
      if (!connector) {
        return { data: state, result: null };
      }
      const now = new Date().toISOString();
      const claimIds = (state.connectorCommands ?? [])
        .filter((command) => command.connectorId === connector.id && command.status === "queued")
        .slice(0, limit)
        .map((command) => command.id);
      const updatedCommands = (state.connectorCommands ?? []).map((command) => claimIds.includes(command.id) ? { ...command, status: "running" as const, claimedAt: now } : command);
      return {
        data: { ...state, connectorCommands: updatedCommands },
        result: updatedCommands.filter((command) => claimIds.includes(command.id)).map((command) => toCommand(command, state.connectors))
      };
    });
  }

  async completeCommand(token: string, result: ConnectorCommandResult): Promise<ConnectorCommand | null> {
    const tokenHash = sha256(token);
    return this.store.update((state) => {
      const connector = state.connectors.find((item) => item.tokenHash === tokenHash);
      const command = (state.connectorCommands ?? []).find((item) => item.id === result.commandId);
      if (!connector || !command || command.connectorId !== connector.id) {
        return { data: state, result: null };
      }
      if (result.signature && !verifySignature(connector.tokenHash, resultSignaturePayload(result), result.signature)) {
        throw new Error("连接器命令结果签名无效。");
      }
      const updated: ConnectorCommandRecord = {
        ...command,
        status: result.status,
        finishedAt: new Date().toISOString(),
        ...(typeof result.exitCode === "number" ? { exitCode: result.exitCode } : {}),
        stdoutTail: result.stdoutTail,
        stderrTail: result.stderrTail
      };
      return {
        data: { ...state, connectorCommands: (state.connectorCommands ?? []).map((item) => item.id === command.id ? updated : item) },
        result: toCommand(updated, state.connectors)
      };
    });
  }

  async versionPolicy(): Promise<ConnectorVersionPolicy> {
    const state = await this.store.read();
    const generatedAt = new Date().toISOString();
    return {
      generatedAt,
      currentVersion: connectorRecommendedVersion,
      minimumSupportedVersion: connectorMinimumSupportedVersion,
      recommendedVersion: connectorRecommendedVersion,
      latestVersion: connectorLatestVersion,
      channels: connectorChannels,
      connectors: state.connectors.map((connector) => connectorCompatibility(connector))
    };
  }

  async scheduleUpgrade(input: ConnectorUpgradeRequest, actor: string): Promise<ConnectorUpgradePlan> {
    return this.store.update((state) => {
      const channel = connectorChannels.find((item) => item.name === input.channel) ?? connectorChannels[0]!;
      const targetVersion = input.targetVersion ?? channel.version;
      const candidates = state.connectors
        .map((connector) => connectorCompatibility(connector, targetVersion, input.rolloutPercent))
        .filter((connector) => !input.connectorId || connector.connectorId === input.connectorId);
      const selected = candidates.filter((connector) => connector.rolloutEligible && connector.compatibility !== "current");
      const skipped = candidates.filter((connector) => !selected.some((item) => item.connectorId === connector.connectorId));
      const now = new Date().toISOString();
      const upgradeCommands = selected.map((connector) => {
        const record = state.connectors.find((item) => item.id === connector.connectorId)!;
        const command: ConnectorCommandRecord = {
          id: randomToken(12),
          connectorId: record.id,
          command: "agent.upgrade",
          args: [targetVersion, input.channel],
          status: "queued",
          createdAt: now,
          createdBy: actor
        };
        const signaturePayload = commandSignaturePayload(command);
        return { ...command, signaturePayload, signature: signPayload(record.tokenHash, signaturePayload) };
      });
      const upgradedConnectors = state.connectors.map((connector) => selected.some((item) => item.connectorId === connector.id) ? {
        ...connector,
        upgradeStatus: "scheduled" as const,
        upgradeTargetVersion: targetVersion,
        upgradeChannel: input.channel,
        lastUpgradeCheckAt: now,
        upgradeNotes: `scheduled by ${actor}`
      } : connector);
      const nextState = { ...state, connectors: upgradedConnectors, connectorCommands: [...(state.connectorCommands ?? []), ...upgradeCommands].slice(-500) };
      return {
        data: nextState,
        result: { generatedAt: now, channel: input.channel, targetVersion, rolloutPercent: input.rolloutPercent, selected, skipped, commands: upgradeCommands.map((command) => toCommand(command, upgradedConnectors)) }
      };
    });
  }
}

function toConnector(record: ConnectorRecord): Connector {
  return {
    id: record.id,
    name: record.name,
    ...(record.description ? { description: record.description } : {}),
    capabilities: record.capabilities,
    ...(record.version ? { version: record.version } : {}),
    ...(record.upgradeStatus ? { upgradeStatus: record.upgradeStatus } : {}),
    ...(record.upgradeTargetVersion ? { upgradeTargetVersion: record.upgradeTargetVersion } : {}),
    ...(record.upgradeChannel ? { upgradeChannel: record.upgradeChannel } : {}),
    ...(record.lastUpgradeCheckAt ? { lastUpgradeCheckAt: record.lastUpgradeCheckAt } : {}),
    ...(record.upgradeNotes ? { upgradeNotes: record.upgradeNotes } : {}),
    status: statusFor(record.lastSeenAt),
    createdAt: record.createdAt,
    ...(record.lastSeenAt ? { lastSeenAt: record.lastSeenAt } : {})
  };
}

function toCommand(record: ConnectorCommandRecord, connectors: ConnectorRecord[]): ConnectorCommand {
  const connector = connectors.find((item) => item.id === record.connectorId);
  return {
    id: record.id,
    connectorId: record.connectorId,
    ...(connector ? { connectorName: connector.name } : {}),
    command: record.command,
    args: record.args,
    ...(record.signaturePayload ? { signaturePayload: record.signaturePayload } : {}),
    ...(record.signature ? { signature: record.signature } : {}),
    status: record.status,
    createdAt: record.createdAt,
    createdBy: record.createdBy,
    ...(record.claimedAt ? { claimedAt: record.claimedAt } : {}),
    ...(record.finishedAt ? { finishedAt: record.finishedAt } : {}),
    ...(typeof record.exitCode === "number" ? { exitCode: record.exitCode } : {}),
    ...(record.stdoutTail ? { stdoutTail: record.stdoutTail } : {}),
    ...(record.stderrTail ? { stderrTail: record.stderrTail } : {})
  };
}

function commandSignaturePayload(record: Pick<ConnectorCommandRecord, "id" | "connectorId" | "command" | "args" | "createdAt" | "createdBy">): string {
  return canonicalJson({ id: record.id, connectorId: record.connectorId, command: record.command, args: record.args, createdAt: record.createdAt, createdBy: record.createdBy });
}

function resultSignaturePayload(result: ConnectorCommandResult): string {
  return canonicalJson({ commandId: result.commandId, status: result.status, exitCode: result.exitCode, stdoutTail: result.stdoutTail, stderrTail: result.stderrTail });
}

function signPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function verifySignature(secret: string, payload: string, signature: string): boolean {
  const expected = Buffer.from(signPayload(secret, payload));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function statusFor(lastSeenAt?: string): Connector["status"] {
  if (!lastSeenAt) {
    return "offline";
  }
  const ageMs = Date.now() - new Date(lastSeenAt).getTime();
  if (ageMs <= staleAfterMs) {
    return "online";
  }
  return ageMs <= offlineAfterMs ? "stale" : "offline";
}

function connectorUpgradePatch(record: ConnectorRecord): Pick<ConnectorRecord, "upgradeStatus" | "upgradeTargetVersion" | "lastUpgradeCheckAt" | "upgradeNotes"> {
  const compatibility = connectorCompatibility(record);
  return {
    upgradeStatus: compatibility.compatibility,
    upgradeTargetVersion: compatibility.upgradeTargetVersion,
    lastUpgradeCheckAt: new Date().toISOString(),
    upgradeNotes: compatibility.detail
  };
}

function connectorCompatibility(record: ConnectorRecord, targetVersion = connectorRecommendedVersion, rolloutPercent = 100): ConnectorCompatibility {
  const desiredTarget = record.upgradeTargetVersion ?? targetVersion;
  const baseStatus = compatibilityFor(record.version, desiredTarget);
  const status = record.upgradeStatus === "scheduled" && baseStatus !== "current" ? "scheduled" : baseStatus;
  return {
    connectorId: record.id,
    name: record.name,
    ...(record.version ? { version: record.version } : {}),
    status: statusFor(record.lastSeenAt),
    compatibility: status,
    upgradeTargetVersion: desiredTarget,
    rolloutEligible: rolloutPercent >= 100 || rolloutBucket(record.id) < rolloutPercent,
    detail: compatibilityDetail(status, record.version, desiredTarget),
    ...(record.lastSeenAt ? { lastSeenAt: record.lastSeenAt } : {})
  };
}

function compatibilityFor(version: string | undefined, targetVersion: string): ConnectorCompatibility["compatibility"] {
  if (!version) {
    return "unknown";
  }
  if (compareAgentVersion(version, connectorMinimumSupportedVersion) < 0) {
    return "unsupported";
  }
  return compareAgentVersion(version, targetVersion) >= 0 ? "current" : "upgrade-available";
}

function compatibilityDetail(status: ConnectorCompatibility["compatibility"], version: string | undefined, targetVersion: string): string {
  if (status === "current") {
    return `agent ${version ?? "unknown"} 已达到 ${targetVersion}`;
  }
  if (status === "scheduled") {
    return `升级到 ${targetVersion} 已排队`;
  }
  if (status === "unsupported") {
    return `agent ${version ?? "unknown"} 低于最低支持版本 ${connectorMinimumSupportedVersion}`;
  }
  if (status === "unknown") {
    return "尚未上报 agent 版本，建议升级到受管版本。";
  }
  return `agent ${version ?? "unknown"} 可升级到 ${targetVersion}`;
}

function compareAgentVersion(left: string, right: string): number {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

function parseVersion(version: string): number[] {
  const matched = version.match(/(\d+(?:\.\d+)*)$/u);
  const versionText = matched?.[1];
  return versionText ? versionText.split(".").map((part) => Number.parseInt(part, 10)) : [0];
}

function rolloutBucket(id: string): number {
  return [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 100;
}
