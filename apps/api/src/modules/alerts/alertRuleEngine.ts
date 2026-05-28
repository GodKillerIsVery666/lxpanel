/**
 * 自定义告警规则引擎。
 * 允许用户编写 JSON 规则（指标 + 条件 + 阈值）替代固定阈值检查。
 */
import type { CustomAlertRule, MetricSample } from "@lxpanel/shared";

export interface RuleEvaluationInput {
  rule: CustomAlertRule;
  /** 当前可用的指标快照（按名称索引） */
  metrics: Record<string, number>;
}

/**
 * 评估单条自定义告警规则。
 * 返回 true 表示满足触发条件。
 */
export function evaluateCustomRule(input: RuleEvaluationInput): boolean {
  const { rule, metrics } = input;
  const value = metrics[rule.metric];
  if (value === undefined || value === null) {
    return false;
  }
  switch (rule.condition) {
    case ">":
      return value > rule.threshold;
    case ">=":
      return value >= rule.threshold;
    case "<":
      return value < rule.threshold;
    case "<=":
      return value <= rule.threshold;
    case "==":
      return value === rule.threshold;
    case "!=":
      return value !== rule.threshold;
    default:
      return false;
  }
}

/**
 * 从监控样本和系统概览中提取指标字典。
 */
export function buildMetricsMap(
  latestSample: MetricSample | undefined,
  overview: { cpu: { usagePercent: number }; memory: { usedPercent: number }; disks: { target: string; usedPercent: number }[] }
): Record<string, number> {
  const metrics: Record<string, number> = {};

  if (latestSample) {
    metrics["cpu.percent"] = latestSample.cpuPercent;
    metrics["memory.percent"] = latestSample.memoryPercent;
    metrics["disk.percent"] = latestSample.diskUsedPercent ?? 0;
  }

  // 系统概览覆盖
  if (overview) {
    metrics["cpu.usagePercent"] = overview.cpu.usagePercent;
    metrics["memory.usedPercent"] = overview.memory.usedPercent;
    for (const disk of overview.disks) {
      metrics[`disk.${disk.target}.percent`] = disk.usedPercent;
    }
  }

  return metrics;
}

/**
 * 获取告警级别对应的严重程度分数。
 */
export function customRuleLevelScore(level: "warning" | "critical"): number {
  return level === "critical" ? 2 : 1;
}
