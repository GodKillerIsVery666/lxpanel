import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JsonStore } from "../src/lib/jsonStore.js";
import { HostService } from "../src/modules/hosts/hostService.js";
import { createInitialPanelState, type PanelState } from "../src/modules/state/panelState.js";

describe("主机资产服务", () => {
  it("创建主机并绑定连接器", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-hosts-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    await store.write({
      ...createInitialPanelState(),
      connectors: [{ id: "c1", name: "edge-a", capabilities: ["ssh"], tokenHash: "hash", createdAt: "2026-05-22T00:00:00.000Z", lastSeenAt: new Date().toISOString() }]
    });
    const service = new HostService(store);

    const host = await service.create({ name: "prod-a", address: "10.0.0.2", tags: ["prod"], connectorId: "c1" });
    const hosts = await service.list();

    expect(host.connectorName).toBe("edge-a");
    expect(host.status).toBe("online");
    expect(hosts.find((item) => item.id === host.id)?.tags).toEqual(["prod"]);
  });

  it("把未绑定的连接器作为发现主机返回", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-hosts-discovered-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    await store.write({
      ...createInitialPanelState(),
      connectors: [{ id: "c1", name: "connector-only", capabilities: [], tokenHash: "hash", createdAt: "2026-05-22T00:00:00.000Z" }]
    });
    const service = new HostService(store);

    const hosts = await service.list();

    expect(hosts[0]?.id).toBe("connector:c1");
    expect(hosts[0]?.status).toBe("offline");
  });

  it("创建主机组并解析批量命令目标", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-hosts-group-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    await store.write({
      ...createInitialPanelState(),
      connectors: [{ id: "c1", name: "edge-a", capabilities: ["ssh"], tokenHash: "hash", createdAt: "2026-05-22T00:00:00.000Z", lastSeenAt: new Date().toISOString() }]
    });
    const service = new HostService(store);
    const host = await service.create({ name: "prod-a", address: "10.0.0.2", tags: ["prod"], connectorId: "c1" });

    const group = await service.createGroup({ name: "prod", tags: ["prod"], hostIds: [host.id] }, "owner");
    const targets = await service.resolveCommandTargets([host.id]);

    expect(group.hostIds).toEqual([host.id]);
    expect(targets[0]?.connectorId).toBe("c1");
  });
});
