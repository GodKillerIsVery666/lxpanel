import type { Connector, ConnectorHeartbeat, CreateConnector } from "@lxpanel/shared";
import { randomToken, sha256 } from "../../lib/crypto.js";
import type { JsonStore } from "../../lib/jsonStore.js";
import type { ConnectorRecord, PanelState } from "../state/panelState.js";

const staleAfterMs = 1000 * 60 * 3;
const offlineAfterMs = 1000 * 60 * 15;

export interface CreatedConnector {
  connector: Connector;
  token: string;
}

export class ConnectorStore {
  constructor(private readonly store: JsonStore<PanelState>) {}

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
