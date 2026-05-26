import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { AlertEvent, CreateNotificationChannel, NotificationChannel, NotificationDelivery, NotificationSecretRotation, NotificationSecretRotationResult, NotificationTest, UpdateNotificationChannel } from "@lxpanel/shared";
import { randomToken } from "../../lib/crypto.js";
import type { StateStore } from "../../lib/stateStore.js";
import type { NotificationChannelRecord, NotificationDeliveryRecord, PanelState } from "../state/panelState.js";

const maxDeliveries = 300;
const defaultDeliveryLimit = 100;
const encryptedUrlPrefix = "enc:v1";

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
  private readonly encryptionKey: Buffer | null;

  constructor(
    private readonly store: StateStore<PanelState>,
    private readonly webhookSender: WebhookSender = defaultWebhookSender,
    private readonly webhookAllowlist: readonly string[] = [],
    encryptionSecret = ""
  ) {
    this.encryptionKey = encryptionSecret ? deriveEncryptionKey(encryptionSecret) : null;
  }

  async listChannels(): Promise<NotificationChannel[]> {
    const state = await this.store.read();
    return (state.notificationChannels ?? []).map((channel) => toPublicChannel(channel, this.readWebhookUrl(channel)));
  }

  async listDeliveries(limit = defaultDeliveryLimit): Promise<NotificationDelivery[]> {
    const state = await this.store.read();
    return (state.notificationDeliveries ?? []).slice(-limit).reverse();
  }

  async createChannel(input: CreateNotificationChannel, actor: string): Promise<NotificationChannel> {
    this.assertWebhookAllowed(input.url);
    const storedUrl = this.toStoredUrl(input.url);
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const channel: NotificationChannelRecord = {
        id: randomToken(12),
        name: input.name,
        type: input.type,
        ...storedUrl,
        enabled: input.enabled,
        minLevel: input.minLevel,
        createdAt: now,
        updatedAt: now,
        updatedBy: actor
      };
      return { data: { ...state, notificationChannels: [...(state.notificationChannels ?? []), channel] }, result: toPublicChannel(channel, input.url) };
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
      let updated: NotificationChannelRecord = {
        ...existing,
        ...(input.name ? { name: input.name } : {}),
        ...(typeof input.enabled === "boolean" ? { enabled: input.enabled } : {}),
        ...(input.minLevel ? { minLevel: input.minLevel } : {}),
        updatedAt: new Date().toISOString(),
        updatedBy: actor
      };
      if (input.url) {
        updated = withStoredUrl(updated, this.toStoredUrl(input.url));
      }
      return {
        data: { ...state, notificationChannels: (state.notificationChannels ?? []).map((channel) => channel.id === input.channelId ? updated : channel) },
        result: toPublicChannel(updated, input.url ?? this.readWebhookUrl(existing))
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

  async notifySystemEvent(input: { level: AlertEvent["level"]; target: string; message: string }): Promise<NotificationDelivery[]> {
    const event: AlertEvent = {
      id: `system-${randomToken(8)}`,
      time: new Date().toISOString(),
      type: "disk",
      level: input.level,
      target: input.target,
      currentValue: 1,
      threshold: 1,
      message: input.message
    };
    return this.notifyAlerts([event]);
  }

  async rotateWebhookSecrets(input: NotificationSecretRotation, actor: string): Promise<NotificationSecretRotationResult> {
    const encryptionKey = this.encryptionKey;
    if (!encryptionKey) {
      throw new Error("当前未配置通知 URL 加密密钥，无法执行迁移。");
    }
    const previousKey = input.previousSecret ? deriveEncryptionKey(input.previousSecret) : null;
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const result: NotificationSecretRotationResult = {
        total: (state.notificationChannels ?? []).length,
        rotated: 0,
        plaintextMigrated: 0,
        alreadyCurrent: 0,
        failed: 0,
        issues: []
      };
      const channels = (state.notificationChannels ?? []).map((channel) => {
        const target = `${channel.name}(${channel.id})`;
        try {
          if (channel.url) {
            result.rotated += 1;
            result.plaintextMigrated += 1;
            return withStoredUrl({ ...channel, updatedAt: now, updatedBy: actor }, { encryptedUrl: encryptSecret(channel.url, encryptionKey) });
          }
          if (channel.encryptedUrl) {
            const decrypted = this.tryDecryptWebhookUrl(channel.encryptedUrl, previousKey);
            if (!decrypted.rotated) {
              result.alreadyCurrent += 1;
              return channel;
            }
            result.rotated += 1;
            return withStoredUrl({ ...channel, updatedAt: now, updatedBy: actor }, { encryptedUrl: encryptSecret(decrypted.url, encryptionKey) });
          }
          result.failed += 1;
          result.issues.push(`${target} 缺少 Webhook URL。`);
          return channel;
        } catch (error) {
          result.failed += 1;
          result.issues.push(`${target} ${error instanceof Error ? error.message : "迁移失败。"}`);
          return channel;
        }
      });
      return { data: { ...state, notificationChannels: channels }, result };
    });
  }

  private async sendToChannel(channel: NotificationChannelRecord, alert: AlertEvent): Promise<NotificationDelivery> {
    const now = new Date().toISOString();
    let status: NotificationDelivery["status"] = "success";
    let errorMessage: string | undefined;
    try {
      const url = this.readWebhookUrl(channel);
      this.assertWebhookAllowed(url);
      const response = await this.webhookSender(url, createPayload(channel, alert, now));
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

  private toStoredUrl(value: string): Pick<NotificationChannelRecord, "url" | "encryptedUrl"> {
    return this.encryptionKey ? { encryptedUrl: encryptSecret(value, this.encryptionKey) } : { url: value };
  }

  private readWebhookUrl(channel: NotificationChannelRecord): string {
    if (channel.encryptedUrl) {
      if (!this.encryptionKey) {
        throw new Error("通知渠道已加密，但当前未配置解密密钥。");
      }
      return decryptSecret(channel.encryptedUrl, this.encryptionKey);
    }
    if (channel.url) {
      return channel.url;
    }
    throw new Error("通知渠道缺少 Webhook URL。");
  }

  private tryDecryptWebhookUrl(encryptedUrl: string, previousKey: Buffer | null): { url: string; rotated: boolean } {
    if (this.encryptionKey) {
      try {
        return { url: decryptSecret(encryptedUrl, this.encryptionKey), rotated: false };
      } catch {
        // Continue with the previous key path below.
      }
    }
    if (!previousKey) {
      throw new Error("无法使用当前密钥解密，请提供旧 LXPANEL_SESSION_SECRET。");
    }
    return { url: decryptSecret(encryptedUrl, previousKey), rotated: true };
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

function createPayload(channel: NotificationChannelRecord, alert: AlertEvent, time: string): unknown {
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

function toPublicChannel(channel: NotificationChannelRecord, url: string): NotificationChannel {
  const publicChannel = { ...channel };
  delete publicChannel.encryptedUrl;
  return { ...publicChannel, url: maskWebhookUrl(url) };
}

function withStoredUrl(channel: NotificationChannelRecord, storedUrl: Pick<NotificationChannelRecord, "url" | "encryptedUrl">): NotificationChannelRecord {
  const next = { ...channel, ...storedUrl };
  if (storedUrl.encryptedUrl) {
    delete next.url;
  }
  if (storedUrl.url) {
    delete next.encryptedUrl;
  }
  return next;
}

function deriveEncryptionKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

function encryptSecret(value: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${encryptedUrlPrefix}:${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

function decryptSecret(value: string, key: Buffer): string {
  const [prefix, version, ivText, tagText, ciphertextText] = value.split(":");
  if (`${prefix}:${version}` !== encryptedUrlPrefix || !ivText || !tagText || !ciphertextText) {
    throw new Error("通知渠道加密 URL 格式不正确。");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8");
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
