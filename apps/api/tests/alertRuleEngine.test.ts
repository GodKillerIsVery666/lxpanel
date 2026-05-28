import { describe, expect, it } from "vitest";
import { evaluateCustomRule, buildMetricsMap, customRuleLevelScore } from "../src/modules/alerts/alertRuleEngine.js";
import type { CustomAlertRule, MetricSample } from "@lxpanel/shared";

const baseRule: CustomAlertRule = {
  id: "rule-1",
  name: "CPU 过高",
  description: "CPU 使用率超过 90%",
  enabled: true,
  metric: "cpu.percent",
  condition: ">",
  threshold: 90,
  duration: 0,
  level: "critical",
  target: "system",
  messageTemplate: "CPU 过高: {{value}}%",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  updatedBy: "test"
};

describe("自定义告警规则引擎", () => {
  it("满足条件应触发告警", () => {
    const result = evaluateCustomRule({ rule: baseRule, metrics: { "cpu.percent": 95 } });
    expect(result).toBe(true);
  });

  it("未满足条件不应触发", () => {
    const result = evaluateCustomRule({ rule: baseRule, metrics: { "cpu.percent": 50 } });
    expect(result).toBe(false);
  });

  it("边界值应正确判定", () => {
    expect(evaluateCustomRule({ rule: baseRule, metrics: { "cpu.percent": 90 } })).toBe(false); // > 90 not >=
    expect(evaluateCustomRule({ rule: { ...baseRule, condition: ">=" }, metrics: { "cpu.percent": 90 } })).toBe(true);
  });

  it("缺失指标应返回 false", () => {
    expect(evaluateCustomRule({ rule: baseRule, metrics: {} })).toBe(false);
  });

  it("所有条件类型都应工作", () => {
    const testCases: Array<{ condition: CustomAlertRule["condition"]; value: number; threshold: number; expected: boolean }> = [
      { condition: ">", value: 5, threshold: 3, expected: true },
      { condition: ">", value: 2, threshold: 3, expected: false },
      { condition: ">=", value: 3, threshold: 3, expected: true },
      { condition: "<", value: 2, threshold: 3, expected: true },
      { condition: "<=", value: 3, threshold: 3, expected: true },
      { condition: "==", value: 3, threshold: 3, expected: true },
      { condition: "!=", value: 3, threshold: 5, expected: true }
    ];

    for (const { condition, value, threshold, expected } of testCases) {
      expect(evaluateCustomRule({ rule: { ...baseRule, condition, threshold }, metrics: { "cpu.percent": value } })).toBe(expected);
    }
  });

  it("buildMetricsMap 应从样本提取指标", () => {
    const sample: MetricSample = { id: "1", time: new Date().toISOString(), hostId: "local", hostName: "local", cpuPercent: 45, memoryPercent: 60, diskUsedPercent: 70 };
    const metrics = buildMetricsMap(sample, { cpu: { usagePercent: 45 }, memory: { usedPercent: 60 }, disks: [{ target: "/", usedPercent: 70 }] });
    expect(metrics["cpu.percent"]).toBe(45);
    expect(metrics["memory.percent"]).toBe(60);
    expect(metrics["disk.percent"]).toBe(70);
  });

  it("buildMetricsMap 应提取系统概览指标", () => {
    const metrics = buildMetricsMap(undefined, { cpu: { usagePercent: 50 }, memory: { usedPercent: 70 }, disks: [{ target: "/", usedPercent: 80 }] });
    expect(metrics["cpu.usagePercent"]).toBe(50);
    expect(metrics["memory.usedPercent"]).toBe(70);
    expect(metrics["disk./.percent"]).toBe(80);
  });

  it("customRuleLevelScore 应返回正确分数", () => {
    expect(customRuleLevelScore("warning")).toBe(1);
    expect(customRuleLevelScore("critical")).toBe(2);
  });
});
