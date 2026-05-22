import type { AlertEvent, AlertSummary, AlertThreshold, UpdateAlertThreshold, SystemOverview } from "@lxpanel/shared";
import type { StateStore } from "../../lib/stateStore.js";
import type { PanelState } from "../state/panelState.js";
import { createDefaultAlertThresholds } from "../state/panelState.js";
import { getSystemOverview, listDiskUsage, type DiskUsageInfo } from "../system/systemService.js";
import { AlertEvaluator } from "./alertEvaluator.js";

const maxAlertEvents = 200;
const defaultListLimit = 100;
const duplicateCooldownMs = 15 * 60 * 1000;

export interface AlertMetricsProvider {
  getOverview(): SystemOverview;
  listDisks(): Promise<DiskUsageInfo[]>;
}

const defaultMetricsProvider: AlertMetricsProvider = {
  getOverview: () => getSystemOverview(),
  listDisks: () => listDiskUsage()
};

export class AlertService {
  private readonly evaluator = new AlertEvaluator();

  constructor(
    private readonly store: StateStore<PanelState>,
    private readonly metricsProvider: AlertMetricsProvider = defaultMetricsProvider
  ) {}

  async listEvents(limit = defaultListLimit): Promise<AlertEvent[]> {
    const state = await this.store.read();
    return (state.alertEvents ?? []).slice(-limit).reverse();
  }

  async getSummary(): Promise<AlertSummary> {
    const events = await this.listEvents(maxAlertEvents);
    return summarize(events);
  }

  async getThresholds(): Promise<AlertThreshold[]> {
    const state = await this.store.read();
    return normalizeThresholds(state.alertThresholds);
  }

  async updateThreshold(input: UpdateAlertThreshold, actor: string): Promise<AlertThreshold[]> {
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const nextThreshold: AlertThreshold = { ...input, updatedAt: now, updatedBy: actor };
      const thresholds = normalizeThresholds(state.alertThresholds).map((item) => item.type === input.type ? nextThreshold : item);
      return { data: { ...state, alertThresholds: thresholds }, result: thresholds };
    });
  }

  async dismissAlert(alertId: string, actor: string): Promise<AlertEvent> {
    return this.store.update((state) => {
      const events = state.alertEvents ?? [];
      const existing = events.find((event) => event.id === alertId);
      if (!existing) {
        throw new Error("告警不存在。");
      }
      const now = new Date().toISOString();
      const dismissed: AlertEvent = { ...existing, dismissedAt: now, dismissedBy: actor };
      return {
        data: {
          ...state,
          alertEvents: events.map((event) => event.id === alertId ? dismissed : event)
        },
        result: dismissed
      };
    });
  }

  async check(now = new Date()): Promise<AlertEvent[]> {
    const state = await this.store.read();
    const thresholds = normalizeThresholds(state.alertThresholds);
    const overview = this.metricsProvider.getOverview();
    let disks: DiskUsageInfo[] = [];
    try {
      disks = await this.metricsProvider.listDisks();
    } catch (error) {
      console.error("[alerts] 采集磁盘使用率失败", error);
    }
    const candidates = this.evaluator.evaluate({ overview, disks, thresholds, now });
    if (candidates.length === 0) {
      return [];
    }
    return this.store.update((current) => {
      const existingEvents = current.alertEvents ?? [];
      const freshEvents = candidates.filter((candidate) => !isDuplicate(existingEvents, candidate, now));
      if (freshEvents.length === 0) {
        return { data: current, result: [] };
      }
      return {
        data: { ...current, alertEvents: [...existingEvents, ...freshEvents].slice(-maxAlertEvents) },
        result: freshEvents
      };
    });
  }
}

export function normalizeThresholds(thresholds: AlertThreshold[] | undefined): AlertThreshold[] {
  const defaults = createDefaultAlertThresholds("system", new Date(0).toISOString());
  if (!thresholds?.length) {
    return defaults;
  }
  return defaults.map((defaultThreshold) => thresholds.find((item) => item.type === defaultThreshold.type) ?? defaultThreshold);
}

function summarize(events: AlertEvent[]): AlertSummary {
  const active = events.filter((event) => !event.dismissedAt);
  const latest = active[0];
  const base = {
    activeWarning: active.filter((event) => event.level === "warning").length,
    activeCritical: active.filter((event) => event.level === "critical").length
  };
  return latest ? { ...base, latest } : base;
}

function isDuplicate(events: AlertEvent[], candidate: AlertEvent, now: Date): boolean {
  return events.some((event) => {
    if (event.type !== candidate.type || event.target !== candidate.target || event.level !== candidate.level || event.dismissedAt) {
      return false;
    }
    return now.getTime() - new Date(event.time).getTime() < duplicateCooldownMs;
  });
}
