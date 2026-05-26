import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SystemOverview } from "@lxpanel/shared";
import { describe, expect, it } from "vitest";
import { JsonStore } from "../src/lib/jsonStore.js";
import { MonitoringService, type MonitoringMetricsProvider } from "../src/modules/monitoring/monitoringService.js";
import { createInitialPanelState, type PanelState } from "../src/modules/state/panelState.js";

const overview: SystemOverview = {
  hostname: "node-a",
  platform: "linux",
  arch: "x64",
  uptimeSeconds: 120,
  loadAverage: [1, 1, 1],
  cpu: { model: "test", cores: 4, usagePercent: 33 },
  memory: { totalBytes: 100, freeBytes: 40, usedPercent: 60 },
  networkInterfaces: []
};

const provider: MonitoringMetricsProvider = {
  getOverview: () => overview,
  listDisks: () => Promise.resolve([{ target: "/", totalBytes: 100, freeBytes: 30, usedPercent: 70 }])
};

describe("监控采样服务", () => {
  it("记录本机指标并按冷却间隔去重", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-monitoring-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const service = new MonitoringService(store, provider);

    const first = await service.recordLocalSample(new Date("2026-05-22T10:00:00.000Z"));
    const skipped = await service.recordLocalSample(new Date("2026-05-22T10:00:30.000Z"));
    const second = await service.recordLocalSample(new Date("2026-05-22T10:01:01.000Z"));
    const samples = await service.listSamples("local", 10);

    expect(first?.cpuPercent).toBe(33);
    expect(skipped).toBeNull();
    expect(second?.diskUsedPercent).toBe(70);
    expect(samples).toHaveLength(2);
  });
});
