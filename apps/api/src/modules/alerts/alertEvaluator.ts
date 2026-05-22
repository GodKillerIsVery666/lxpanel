import type { AlertEvent, AlertThreshold, AlertType, SystemOverview } from "@lxpanel/shared";
import { randomToken } from "../../lib/crypto.js";
import type { DiskUsageInfo } from "../system/systemService.js";

export interface AlertEvaluationInput {
  overview: SystemOverview;
  disks: DiskUsageInfo[];
  thresholds: AlertThreshold[];
  now: Date;
}

export class AlertEvaluator {
  evaluate(input: AlertEvaluationInput): AlertEvent[] {
    const events: AlertEvent[] = [];
    const cpuThreshold = findThreshold(input.thresholds, "cpu");
    const memoryThreshold = findThreshold(input.thresholds, "memory");
    const diskThreshold = findThreshold(input.thresholds, "disk");

    const cpu = evaluatePercent("cpu", "CPU", "system", input.overview.cpu.usagePercent, cpuThreshold, input.now);
    if (cpu) {
      events.push(cpu);
    }

    const memory = evaluatePercent("memory", "内存", "system", input.overview.memory.usedPercent, memoryThreshold, input.now);
    if (memory) {
      events.push(memory);
    }

    if (diskThreshold?.enabled) {
      for (const disk of input.disks) {
        const diskEvent = evaluatePercent("disk", "磁盘", disk.target, disk.usedPercent, diskThreshold, input.now);
        if (diskEvent) {
          events.push(diskEvent);
        }
      }
    }

    return events;
  }
}

function findThreshold(thresholds: AlertThreshold[], type: AlertType): AlertThreshold | undefined {
  return thresholds.find((item) => item.type === type);
}

function evaluatePercent(type: AlertType, label: string, target: string, value: number, threshold: AlertThreshold | undefined, now: Date): AlertEvent | null {
  if (!threshold?.enabled) {
    return null;
  }
  const roundedValue = Math.round(value * 10) / 10;
  if (roundedValue >= threshold.criticalPercent) {
    return createEvent(type, "critical", label, target, roundedValue, threshold.criticalPercent, now);
  }
  if (roundedValue >= threshold.warningPercent) {
    return createEvent(type, "warning", label, target, roundedValue, threshold.warningPercent, now);
  }
  return null;
}

function createEvent(type: AlertType, level: "warning" | "critical", label: string, target: string, currentValue: number, threshold: number, now: Date): AlertEvent {
  const levelText = level === "critical" ? "严重" : "警告";
  return {
    id: randomToken(12),
    time: now.toISOString(),
    type,
    level,
    target,
    currentValue,
    threshold,
    message: `${label} ${target} 使用率 ${currentValue}% 达到${levelText}阈值 ${threshold}%`
  };
}
