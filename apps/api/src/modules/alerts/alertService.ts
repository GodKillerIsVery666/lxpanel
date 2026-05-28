import type { AlertEvent, AlertSilence, AlertSummary, AlertThreshold, CreateAlertSilence, UpdateAlertThreshold, SystemOverview, CustomAlertRule, CreateCustomAlertRule, UpdateCustomAlertRule } from "@lxpanel/shared";
import { randomToken } from "../../lib/crypto.js";
import type { StateStore } from "../../lib/stateStore.js";
import type { PanelState, CustomAlertRuleRecord } from "../state/panelState.js";
import { createDefaultAlertThresholds } from "../state/panelState.js";
import { getSystemOverview, listDiskUsage, type DiskUsageInfo } from "../system/systemService.js";
import { AlertEvaluator } from "./alertEvaluator.js";
import { evaluateCustomRule, buildMetricsMap } from "./alertRuleEngine.js";

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

  async listSilences(): Promise<AlertSilence[]> {
    const state = await this.store.read();
    return (state.alertSilences ?? []).slice().reverse();
  }

  async createSilence(input: CreateAlertSilence, actor: string): Promise<AlertSilence> {
    return this.store.update((state) => {
      const now = new Date();
      const silence: AlertSilence = {
        id: randomToken(12),
        ...(input.type ? { type: input.type } : {}),
        ...(input.target ? { target: input.target } : {}),
        reason: input.reason,
        startsAt: now.toISOString(),
        endsAt: new Date(now.getTime() + input.minutes * 60_000).toISOString(),
        createdAt: now.toISOString(),
        createdBy: actor
      };
      return { data: { ...state, alertSilences: [...(state.alertSilences ?? []), silence].slice(-100) }, result: silence };
    });
  }

  /** 导入外部告警（如 Prometheus AlertManager Webhook） */
  async importExternalAlert(input: { type: string; level: "warning" | "critical"; target: string; message: string; externalId?: string }): Promise<AlertEvent> {
    const alertType: "cpu" | "memory" | "disk" = input.type === "cpu" || input.type === "memory" || input.type === "disk" ? input.type : "cpu";
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const event: AlertEvent = {
        id: randomToken(12),
        time: now,
        type: alertType,
        level: input.level,
        target: input.target,
        currentValue: 0,
        threshold: 0,
        message: `${input.message}${input.externalId ? ` [${input.externalId}]` : ""}`
      };
      const events = [...(state.alertEvents ?? []), event].slice(-maxAlertEvents);
      return { data: { ...state, alertEvents: events }, result: event };
    });
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

  // ---- 自定义告警规则 CRUD ----

  async listCustomRules(): Promise<CustomAlertRule[]> {
    const state = await this.store.read();
    return (state.customAlertRules ?? []).map(toCustomAlertRule);
  }

  async createCustomRule(input: CreateCustomAlertRule, actor: string): Promise<CustomAlertRule> {
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const rule: CustomAlertRuleRecord = {
        id: randomToken(12),
        name: input.name,
        description: input.description ?? "",
        enabled: input.enabled ?? true,
        metric: input.metric,
        condition: input.condition,
        threshold: input.threshold,
        duration: input.duration ?? 0,
        level: input.level ?? "warning",
        target: input.target ?? "",
        messageTemplate: input.messageTemplate,
        createdAt: now,
        updatedAt: now,
        updatedBy: actor
      };
      const rules = [...(state.customAlertRules ?? []), rule].slice(-200);
      return { data: { ...state, customAlertRules: rules }, result: toCustomAlertRule(rule) };
    });
  }

  async updateCustomRule(input: UpdateCustomAlertRule, actor: string): Promise<CustomAlertRule> {
    return this.store.update((state) => {
      const rules = state.customAlertRules ?? [];
      const existing = rules.find((r) => r.id === input.ruleId);
      if (!existing) {
        throw new Error("自定义告警规则不存在。");
      }
      const now = new Date().toISOString();
      const updated: CustomAlertRuleRecord = {
        ...existing,
        ...(input.name ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.metric ? { metric: input.metric } : {}),
        ...(input.condition ? { condition: input.condition } : {}),
        ...(input.threshold !== undefined ? { threshold: input.threshold } : {}),
        ...(input.duration !== undefined ? { duration: input.duration } : {}),
        ...(input.level ? { level: input.level } : {}),
        ...(input.target !== undefined ? { target: input.target } : {}),
        ...(input.messageTemplate ? { messageTemplate: input.messageTemplate } : {}),
        updatedAt: now,
        updatedBy: actor
      };
      const nextRules = rules.map((r) => r.id === input.ruleId ? updated : r);
      return { data: { ...state, customAlertRules: nextRules }, result: toCustomAlertRule(updated) };
    });
  }

  async deleteCustomRule(ruleId: string): Promise<boolean> {
    return this.store.update((state) => {
      const rules = state.customAlertRules ?? [];
      const nextRules = rules.filter((r) => r.id !== ruleId);
      return { data: { ...state, customAlertRules: nextRules }, result: nextRules.length !== rules.length };
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
    const silences = state.alertSilences ?? [];
    const candidates = this.evaluator.evaluate({ overview, disks, thresholds, now }).filter((event) => !isSilenced(event, silences, now));

    // 评估自定义告警规则
    const latestSample = state.metricSamples?.[state.metricSamples.length - 1];
    const metrics = buildMetricsMap(latestSample, { cpu: overview.cpu, memory: overview.memory, disks });
    const customRules = state.customAlertRules ?? [];
    for (const rule of customRules) {
      if (!rule.enabled) {
        continue;
      }
      const triggered = evaluateCustomRule({ rule, metrics });
      if (triggered) {
        const triggeredLevel: "warning" | "critical" = rule.level;
        candidates.push({
          id: randomToken(12),
          time: now.toISOString(),
          type: "cpu",  // 自定义规则使用通用类型
          level: triggeredLevel,
          target: rule.target ?? "system",
          currentValue: metrics[rule.metric] ?? 0,
          threshold: rule.threshold,
          message: rule.messageTemplate || `自定义规则「${rule.name}」触发: ${rule.metric} ${rule.condition} ${rule.threshold}`
        });
      }
    }
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

function isSilenced(event: AlertEvent, silences: AlertSilence[], now: Date): boolean {
  const nowTime = now.getTime();
  return silences.some((silence) => {
    const active = new Date(silence.startsAt).getTime() <= nowTime && new Date(silence.endsAt).getTime() >= nowTime;
    return active && (!silence.type || silence.type === event.type) && (!silence.target || silence.target === event.target);
  });
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

function toCustomAlertRule(record: CustomAlertRuleRecord): CustomAlertRule {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    enabled: record.enabled,
    metric: record.metric,
    condition: record.condition,
    threshold: record.threshold,
    duration: record.duration,
    level: record.level,
    target: record.target,
    messageTemplate: record.messageTemplate,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    updatedBy: record.updatedBy
  };
}
