import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SystemOverview } from "@lxpanel/shared";
import { describe, expect, it } from "vitest";
import { JsonStore } from "../src/lib/jsonStore.js";
import { AlertService, type AlertMetricsProvider } from "../src/modules/alerts/alertService.js";
import { createInitialPanelState, type PanelState } from "../src/modules/state/panelState.js";

const overview: SystemOverview = {
  hostname: "node-a",
  platform: "linux",
  arch: "x64",
  uptimeSeconds: 120,
  loadAverage: [4, 2, 1],
  cpu: { model: "test", cores: 4, usagePercent: 96 },
  memory: { totalBytes: 100, freeBytes: 50, usedPercent: 50 },
  networkInterfaces: []
};

const metricsProvider: AlertMetricsProvider = {
  getOverview: () => overview,
  listDisks: () => Promise.resolve([{ target: "/", totalBytes: 100, freeBytes: 3, usedPercent: 97 }])
};

describe("资源告警服务", () => {
  it("记录告警并在冷却窗口内去重", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-alerts-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const service = new AlertService(store, metricsProvider);

    const first = await service.check(new Date("2026-05-22T10:00:00.000Z"));
    const second = await service.check(new Date("2026-05-22T10:05:00.000Z"));
    const events = await service.listEvents();
    const summary = await service.getSummary();

    expect(first).toHaveLength(2);
    expect(second).toHaveLength(0);
    expect(events).toHaveLength(2);
    expect(summary.activeCritical).toBe(2);
  });

  it("更新阈值并确认告警", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-alerts-dismiss-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const service = new AlertService(store, metricsProvider);
    const [event] = await service.check(new Date("2026-05-22T10:00:00.000Z"));

    const thresholds = await service.updateThreshold({ type: "cpu", warningPercent: 70, criticalPercent: 90, enabled: false }, "admin");
    const dismissed = await service.dismissAlert(event?.id ?? "", "admin");
    const summary = await service.getSummary();

    expect(thresholds.find((threshold) => threshold.type === "cpu")?.enabled).toBe(false);
    expect(dismissed.dismissedBy).toBe("admin");
    expect(summary.activeCritical).toBe(1);
  });
});
