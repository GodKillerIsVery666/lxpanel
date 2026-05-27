import { mkdtemp } from "node:fs/promises";
import { createHash, createHmac } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JsonStore } from "../src/lib/jsonStore.js";
import { ConnectorStore } from "../src/modules/connectors/connectorStore.js";
import { createInitialPanelState, type PanelState } from "../src/modules/state/panelState.js";

describe("连接器命令队列", () => {
  it("连接器领取命令并回传结果", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-connector-"));
    const connectorStore = new ConnectorStore(new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState));
    const created = await connectorStore.create({ name: "agent", capabilities: ["command"] });
    const queued = await connectorStore.createCommand({ connectorId: created.connector.id, command: "echo", args: ["ok"] }, "admin");

    const claimed = await connectorStore.claimCommands(created.token);
    const resultPayload = canonicalJson({ commandId: queued.id, status: "success", exitCode: 0, stdoutTail: "ok", stderrTail: "" });
    const signature = createHmac("sha256", createHash("sha256").update(created.token).digest("base64url")).update(resultPayload).digest("base64url");
    const completed = await connectorStore.completeCommand(created.token, { commandId: queued.id, status: "success", exitCode: 0, stdoutTail: "ok", stderrTail: "", signature });
    const commands = await connectorStore.listCommands(created.connector.id);

    expect(claimed).toHaveLength(1);
    expect(claimed?.[0]).toMatchObject({ id: queued.id, status: "running" });
    expect(claimed?.[0]?.signaturePayload).toContain(queued.id);
    expect(claimed?.[0]?.signature).toBeTruthy();
    expect(completed).toMatchObject({ status: "success", stdoutTail: "ok" });
    expect(commands[0]).toMatchObject({ id: queued.id, connectorName: "agent", status: "success" });
  });

  it("拒绝无效令牌领取或完成命令", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-connector-token-"));
    const connectorStore = new ConnectorStore(new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState));
    const created = await connectorStore.create({ name: "agent", capabilities: ["command"] });
    const queued = await connectorStore.createCommand({ connectorId: created.connector.id, command: "echo", args: [] }, "admin");

    await expect(connectorStore.claimCommands("bad-token")).resolves.toBeNull();
    await expect(connectorStore.completeCommand("bad-token", { commandId: queued.id, status: "failed", stdoutTail: "", stderrTail: "bad" })).resolves.toBeNull();
  });

  it("心跳可上报远端主机监控样本", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-connector-metrics-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const connectorStore = new ConnectorStore(store);
    const created = await connectorStore.create({ name: "agent", capabilities: ["metrics"] });

    const connector = await connectorStore.heartbeat(created.token, { capabilities: ["metrics"], metrics: { hostId: "node-a", hostName: "node-a", cpuPercent: 12, memoryPercent: 34, diskUsedPercent: 56 } });
    const state = await store.read();

    expect(connector?.status).toBe("online");
    expect(state.metricSamples?.[0]).toMatchObject({ hostId: "node-a", cpuPercent: 12, memoryPercent: 34, diskUsedPercent: 56 });
  });
});

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
