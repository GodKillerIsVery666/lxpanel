import type { AlertEvent, CreateNotificationChannel, NotificationChannel, NotificationDelivery, NotificationTest, UpdateNotificationChannel } from "@lxpanel/shared";
import { randomToken } from "../../lib/crypto.js";
import type { StateStore } from "../../lib/stateStore.js";
import type { NotificationChannelRecord, NotificationDeliveryRecord, PanelState } from "../state/panelState.js";

const maxDeliveries = 300;
const defaultDeliveryLimit = 100;

export interface WebhookResult {
  ok: boolean;
  status: number;
  body: string;
}

export type WebhookSender = (url: string, payload: unknown) => Promise<WebhookResult>;

const defaultWebhookSender: WebhookSender = async (url, payload) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    return { ok: response.ok, status: response.status, body: await response.text() };
  } finally {
    clearTimeout(timer);
  }
};

export class NotificationService {
  constructor(
    private readonly store: StateStore<PanelState>,
    private readonly webhookSender: WebhookSender = defaultWebhookSender,
    private readonly webhookAllowlist: readonly string[] = []
  ) {}

  async listChannels(): Promise<NotificationChannel[]> {
    const state = await this.store.read();
    return (state.notificationChannels ?? []).map(toPublicChannel);
  }

  async listDeliveries(limit = defaultDeliveryLimit): Promise<NotificationDelivery[]> {
    const state = await this.store.read();
    return (state.notificationDeliveries ?? []).slice(-limit).reverse();
  }

  async createChannel(input: CreateNotificationChannel, actor: string): Promise<NotificationChannel> {
    this.assertWebhookAllowed(input.url);
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const channel: NotificationChannelRecord = {
        id: randomToken(12),
        name: input.name,
        type: input.type,
        url: input.url,
        enabled: input.enabled,
        minLevel: input.minLevel,
        createdAt: now,
        updatedAt: now,
        updatedBy: actor
      };
      return { data: { ...state, notificationChannels: [...(state.notificationChannels ?? []), channel] }, result: toPublicChannel(channel) };
    });
  }

  async updateChannel(input: UpdateNotificationChannel, actor: string): Promise<NotificationChannel> {
    if (input.url) {
      this.assertWebhookAllowed(input.url);
    }
    return this.store.update((state) => {
      const existing = (state.notificationChannels ?? []).find((channel) => channel.id === input.channelId);
      if (!existing) {
        throw new Error("通知渠道不存在。");
      }
      const updated: NotificationChannelRecord = {
        ...existing,
        ...(input.name ? { name: input.name } : {}),
        ...(input.url ? { url: input.url } : {}),
        ...(typeof input.enabled === "boolean" ? { enabled: input.enabled } : {}),
        ...(input.minLevel ? { minLevel: input.minLevel } : {}),
        updatedAt: new Date().toISOString(),
        updatedBy: actor
      };
      return {
        data: { ...state, notificationChannels: (state.notificationChannels ?? []).map((channel) => channel.id === input.channelId ? updated : channel) },
        result: toPublicChannel(updated)
      };
    });
  }

  async deleteChannel(channelId: string): Promise<boolean> {
    return this.store.update((state) => {
      const channels = state.notificationChannels ?? [];
      const nextChannels = channels.filter((channel) => channel.id !== channelId);
      return { data: { ...state, notificationChannels: nextChannels }, result: nextChannels.length !== channels.length };
    });
  }

  async testChannel(input: NotificationTest, actor: string): Promise<NotificationDelivery> {
    const state = await this.store.read();
    const channel = (state.notificationChannels ?? []).find((item) => item.id === input.channelId);
    if (!channel) {
      throw new Error("通知渠道不存在。");
    }
    const alert: AlertEvent = {
      id: `test-${randomToken(8)}`,
      time: new Date().toISOString(),
      type: "cpu",
      level: "warning",
      target: "test",
      currentValue: 80,
      threshold: 80,
      message: `LXPanel 测试通知，由 ${actor} 触发。`
    };
    return this.sendToChannel(channel, alert);
  }

  async notifyAlerts(alerts: AlertEvent[]): Promise<NotificationDelivery[]> {
    const state = await this.store.read();
    const channels = (state.notificationChannels ?? []).filter((channel) => channel.enabled);
    const deliveries: NotificationDelivery[] = [];
    for (const alert of alerts) {
      for (const channel of channels) {
        if (levelRank(alert.level) < levelRank(channel.minLevel)) {
          continue;
        }
        deliveries.push(await this.sendToChannel(channel, alert));
      }
    }
    return deliveries;
  }

  private async sendToChannel(channel: NotificationChannel, alert: AlertEvent): Promise<NotificationDelivery> {
    const now = new Date().toISOString();
    let status: NotificationDelivery["status"] = "success";
    let errorMessage: string | undefined;
    try {
      this.assertWebhookAllowed(channel.url);
      const response = await this.webhookSender(channel.url, createPayload(channel, alert, now));
      if (!response.ok) {
        status = "failed";
        errorMessage = `HTTP ${response.status}${response.body ? ` ${response.body.slice(0, 200)}` : ""}`;
      }
    } catch (error) {
      status = "failed";
      errorMessage = error instanceof Error ? error.message : String(error);
    }
    const delivery: NotificationDeliveryRecord = {
      id: randomToken(12),
      channelId: channel.id,
      channelName: channel.name,
      alertId: alert.id,
      level: alert.level,
      target: alert.target,
      status,
      time: now,
      ...(errorMessage ? { error: errorMessage } : {})
    };
    await this.recordDelivery(channel.id, delivery);
    return delivery;
  }

  private assertWebhookAllowed(value: string): void {
    if (this.webhookAllowlist.length === 0) {
      return;
    }
    const hostname = new URL(value).hostname.toLowerCase();
    const allowed = this.webhookAllowlist.some((pattern) => matchesHostPattern(hostname, pattern));
    if (!allowed) {
      throw new Error("Webhook 目标不在 LXPANEL_WEBHOOK_ALLOWLIST 内。");
    }
  }

  private async recordDelivery(channelId: string, delivery: NotificationDeliveryRecord): Promise<void> {
    await this.store.update((state) => {
      const channels = (state.notificationChannels ?? []).map((channel) => {
        if (channel.id !== channelId) {
          return channel;
        }
        return {
          ...channel,
          lastStatus: delivery.status === "success" ? "success" as const : "failed" as const,
          ...(delivery.error ? { lastError: delivery.error } : {}),
          lastSentAt: delivery.time
        };
      });
      return {
        data: {
          ...state,
          notificationChannels: channels,
          notificationDeliveries: [...(state.notificationDeliveries ?? []), delivery].slice(-maxDeliveries)
        },
        result: undefined
      };
    });
  }
}

function createPayload(channel: NotificationChannel, alert: AlertEvent, time: string): unknown {
  return {
    product: "LXPanel",
    time,
    channel: { id: channel.id, name: channel.name, type: channel.type },
    alert: {
      id: alert.id,
      time: alert.time,
      type: alert.type,
      level: alert.level,
      target: alert.target,
      currentValue: alert.currentValue,
      threshold: alert.threshold,
      message: alert.message
    }
  };
}

function toPublicChannel(channel: NotificationChannelRecord): NotificationChannel {
  return { ...channel, url: maskWebhookUrl(channel.url) };
}

function maskWebhookUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}/...`;
  } catch {
    return value;
  }
}

function matchesHostPattern(hostname: string, pattern: string): boolean {
  const normalized = pattern.toLowerCase();
  if (normalized.startsWith("*.")) {
    const suffix = normalized.slice(1);
    return hostname.endsWith(suffix) && hostname !== normalized.slice(2);
  }
  return hostname === normalized;
}

function levelRank(level: AlertEvent["level"]): number {
  return level === "critical" ? 2 : 1;
}
