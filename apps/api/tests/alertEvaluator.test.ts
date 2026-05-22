import type { AlertThreshold, SystemOverview } from "@lxpanel/shared";
import { describe, expect, it } from "vitest";
import { AlertEvaluator } from "../src/modules/alerts/alertEvaluator.js";

const overview: SystemOverview = {
  hostname: "node-a",
  platform: "linux",
  arch: "x64",
  uptimeSeconds: 120,
  loadAverage: [4, 2, 1],
  cpu: { model: "test", cores: 4, usagePercent: 96 },
  memory: { totalBytes: 100, freeBytes: 8, usedPercent: 92 },
  networkInterfaces: []
};

const thresholds: AlertThreshold[] = [
  { type: "cpu", warningPercent: 80, criticalPercent: 95, enabled: true, updatedAt: "2026-05-22T00:00:00.000Z", updatedBy: "test" },
  { type: "memory", warningPercent: 80, criticalPercent: 95, enabled: true, updatedAt: "2026-05-22T00:00:00.000Z", updatedBy: "test" },
  { type: "disk", warningPercent: 85, criticalPercent: 95, enabled: true, updatedAt: "2026-05-22T00:00:00.000Z", updatedBy: "test" }
];

describe("资源告警评估器", () => {
  it("根据 CPU、内存和磁盘阈值生成告警", () => {
    const evaluator = new AlertEvaluator();

    const events = evaluator.evaluate({
      overview,
      disks: [{ target: "/", totalBytes: 100, freeBytes: 2, usedPercent: 98 }],
      thresholds,
      now: new Date("2026-05-22T10:00:00.000Z")
    });

    expect(events.map((event) => `${event.type}:${event.level}`)).toEqual(["cpu:critical", "memory:warning", "disk:critical"]);
    expect(events[0]?.message).toContain("CPU");
  });

  it("跳过禁用的阈值", () => {
    const evaluator = new AlertEvaluator();
    const disabled = thresholds.map((threshold) => threshold.type === "cpu" ? { ...threshold, enabled: false } : threshold);

    const events = evaluator.evaluate({ overview, disks: [], thresholds: disabled, now: new Date("2026-05-22T10:00:00.000Z") });

    expect(events.some((event) => event.type === "cpu")).toBe(false);
  });
});
