import type { CreateHost, Host, UpdateHost } from "@lxpanel/shared";
import { randomToken } from "../../lib/crypto.js";
import type { StateStore } from "../../lib/stateStore.js";
import type { ConnectorRecord, HostRecord, PanelState } from "../state/panelState.js";

const staleAfterMs = 1000 * 60 * 3;
const offlineAfterMs = 1000 * 60 * 15;

export class HostService {
  constructor(private readonly store: StateStore<PanelState>) {}

  async list(): Promise<Host[]> {
    const state = await this.store.read();
    const hosts = (state.hosts ?? []).map((host) => toHost(host, state.connectors));
    const linkedConnectorIds = new Set(hosts.map((host) => host.connectorId).filter((id): id is string => Boolean(id)));
    const discovered = state.connectors
      .filter((connector) => !linkedConnectorIds.has(connector.id))
      .map(toDiscoveredHost);
    return [...hosts, ...discovered].sort((left, right) => left.name.localeCompare(right.name));
  }

  async create(input: CreateHost): Promise<Host> {
    return this.store.update((state) => {
      assertConnectorExists(input.connectorId, state.connectors);
      const now = new Date().toISOString();
      const record: HostRecord = {
        id: randomToken(12),
        name: input.name,
        ...(input.address ? { address: input.address } : {}),
        tags: input.tags,
        ...(input.connectorId ? { connectorId: input.connectorId } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
        createdAt: now,
        updatedAt: now
      };
      return {
        data: { ...state, hosts: [...(state.hosts ?? []), record] },
        result: toHost(record, state.connectors)
      };
    });
  }

  async update(input: UpdateHost): Promise<Host> {
    return this.store.update((state) => {
      const existing = (state.hosts ?? []).find((host) => host.id === input.hostId);
      if (!existing) {
        throw new Error("主机不存在。");
      }
      assertConnectorExists(input.connectorId, state.connectors);
      const updated: HostRecord = {
        ...existing,
        ...(input.name ? { name: input.name } : {}),
        ...(input.address ? { address: input.address } : {}),
        ...(input.tags ? { tags: input.tags } : {}),
        ...(input.connectorId ? { connectorId: input.connectorId } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
        updatedAt: new Date().toISOString()
      };
      return {
        data: { ...state, hosts: (state.hosts ?? []).map((host) => host.id === input.hostId ? updated : host) },
        result: toHost(updated, state.connectors)
      };
    });
  }

  async delete(hostId: string): Promise<boolean> {
    return this.store.update((state) => {
      const hosts = state.hosts ?? [];
      const nextHosts = hosts.filter((host) => host.id !== hostId);
      return { data: { ...state, hosts: nextHosts }, result: nextHosts.length !== hosts.length };
    });
  }
}

function toHost(record: HostRecord, connectors: ConnectorRecord[]): Host {
  const connector = record.connectorId ? connectors.find((item) => item.id === record.connectorId) : undefined;
  return {
    id: record.id,
    name: record.name,
    ...(record.address ? { address: record.address } : {}),
    tags: record.tags,
    status: connector ? statusFor(connector.lastSeenAt) : "unknown",
    ...(record.connectorId ? { connectorId: record.connectorId } : {}),
    ...(connector ? { connectorName: connector.name } : {}),
    ...(record.notes ? { notes: record.notes } : {}),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ...(connector?.lastSeenAt ? { lastSeenAt: connector.lastSeenAt } : {})
  };
}

function toDiscoveredHost(connector: ConnectorRecord): Host {
  return {
    id: `connector:${connector.id}`,
    name: connector.name,
    tags: ["connector"],
    status: statusFor(connector.lastSeenAt),
    connectorId: connector.id,
    connectorName: connector.name,
    createdAt: connector.createdAt,
    updatedAt: connector.lastSeenAt ?? connector.createdAt,
    ...(connector.lastSeenAt ? { lastSeenAt: connector.lastSeenAt } : {})
  };
}

function statusFor(lastSeenAt?: string): Host["status"] {
  if (!lastSeenAt) {
    return "offline";
  }
  const ageMs = Date.now() - new Date(lastSeenAt).getTime();
  if (ageMs <= staleAfterMs) {
    return "online";
  }
  return ageMs <= offlineAfterMs ? "stale" : "offline";
}

function assertConnectorExists(connectorId: string | undefined, connectors: ConnectorRecord[]): void {
  if (connectorId && !connectors.some((connector) => connector.id === connectorId)) {
    throw new Error("连接器不存在。");
  }
}
