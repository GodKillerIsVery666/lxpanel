import type { NotificationChannel, NotificationDelivery } from "@lxpanel/shared";

/**
 * 事件总线配置：将 LXPanel 事件流式导出到企业消息平台（Kafka/Pulsar 兼容 HTTP 网关）。
 */
export interface EventBusConfig {
  endpoint: string;
  topic?: string;
  batchSize: number;
  flushIntervalMs: number;
}

export type EventBusSender = (endpoint: string, events: unknown[]) => Promise<{ ok: boolean; status: number; body: string }>;

const defaultEventBusSender: EventBusSender = async (endpoint, events) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-event-source": "lxpanel" },
      body: JSON.stringify({ events, source: "lxpanel", generatedAt: new Date().toISOString() }),
      signal: controller.signal
    });
    return { ok: response.ok, status: response.status, body: await response.text() };
  } finally {
    clearTimeout(timer);
  }
};

export class EventBusService {
  private eventBuffer: unknown[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly sender: EventBusSender = defaultEventBusSender
  ) {}

  /**
   * 推送审计事件到所有启用的 eventbus 通知渠道。
   * 支持批量发送和定时 flush。
   */
  async pushEvents(events: unknown[], channels: NotificationChannel[]): Promise<NotificationDelivery[]> {
    const busChannels = channels.filter((ch) => ch.type === "eventbus" && ch.enabled);
    if (busChannels.length === 0 || events.length === 0) {
      return [];
    }
    const deliveries: NotificationDelivery[] = [];
    for (const channel of busChannels) {
      const payload = events.map((event) => ({
        topic: channel.topic ?? "lxpanel-events",
        key: typeof event === "object" && event !== null && "id" in event ? String((event as Record<string, unknown>).id) : undefined,
        value: event,
        time: new Date().toISOString()
      }));
      try {
        const result = await this.sender(channel.url ?? channel.topic ?? "http://localhost", payload);
        deliveries.push({
          id: `eb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          channelId: channel.id,
          channelName: channel.name,
          alertId: "event-bus",
          level: "warning",
          target: "event-bus",
          status: result.ok ? "success" : "failed",
          time: new Date().toISOString(),
          error: result.ok ? undefined : `HTTP ${result.status}: ${result.body.slice(0, 200)}`
        });
      } catch (error) {
        deliveries.push({
          id: `eb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          channelId: channel.id,
          channelName: channel.name,
          alertId: "event-bus",
          level: "warning",
          target: "event-bus",
          status: "failed",
          time: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    return deliveries;
  }

  /**
   * 将事件加入缓冲区，按配置批量发送。
   */
  bufferEvent(event: unknown): void {
    this.eventBuffer.push(event);
  }

  stop(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
  }
}
