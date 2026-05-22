import type { Connector, ConnectorCommand, ConnectorCommandResult, ConnectorHeartbeat, CreateConnector, CreateConnectorCommand } from "@lxpanel/shared";
import { randomToken, sha256 } from "../../lib/crypto.js";
import type { StateStore } from "../../lib/stateStore.js";
import type { ConnectorCommandRecord, ConnectorRecord, PanelState } from "../state/panelState.js";

const staleAfterMs = 1000 * 60 * 3;
const offlineAfterMs = 1000 * 60 * 15;

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
        lastSeenAt: new Date().toISOString()
      };
      return {
        data: {
          ...state,
          connectors: state.connectors.map((item) => item.id === record.id ? updated : item)
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
      return {
        data: { ...state, connectorCommands: [...(state.connectorCommands ?? []), record].slice(-500) },
        result: toCommand(record, state.connectors)
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
}

function toConnector(record: ConnectorRecord): Connector {
  return {
    id: record.id,
    name: record.name,
    ...(record.description ? { description: record.description } : {}),
    capabilities: record.capabilities,
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
