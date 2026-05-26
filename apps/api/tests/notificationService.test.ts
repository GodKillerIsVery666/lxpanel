import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AlertEvent } from "@lxpanel/shared";
import { describe, expect, it } from "vitest";
import { JsonStore } from "../src/lib/jsonStore.js";
import { NotificationService, type WebhookSender } from "../src/modules/notifications/notificationService.js";
import { createInitialPanelState, type PanelState } from "../src/modules/state/panelState.js";

const alert: AlertEvent = {
  id: "a1",
  time: "2026-05-22T10:00:00.000Z",
  type: "cpu",
  level: "critical",
  target: "system",
  currentValue: 96,
  threshold: 95,
  message: "CPU system 使用率 96% 达到严重阈值 95%"
};

describe("通知服务", () => {
  it("向匹配级别的 Webhook 渠道投递告警并记录结果", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-notify-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const sent: unknown[] = [];
    const sender: WebhookSender = (_url, payload) => {
      sent.push(payload);
      return Promise.resolve({ ok: true, status: 200, body: "ok" });
    };
    const service = new NotificationService(store, sender);
    const channel = await service.createChannel({ name: "ops", type: "webhook", url: "https://example.com/hook", enabled: true, minLevel: "warning" }, "admin");

    const deliveries = await service.notifyAlerts([alert]);
    const channels = await service.listChannels();
    const history = await service.listDeliveries();

    expect(channel.name).toBe("ops");
    expect(sent).toHaveLength(1);
    expect(deliveries[0]?.status).toBe("success");
    expect(history).toHaveLength(1);
    expect(channels[0]?.lastStatus).toBe("success");
  });

  it("跳过低于渠道级别的告警", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-notify-skip-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const sender: WebhookSender = () => Promise.resolve({ ok: true, status: 200, body: "ok" });
    const service = new NotificationService(store, sender);
    await service.createChannel({ name: "critical-only", type: "webhook", url: "https://example.com/hook", enabled: true, minLevel: "critical" }, "admin");

    const deliveries = await service.notifyAlerts([{ ...alert, id: "a2", level: "warning" }]);

    expect(deliveries).toHaveLength(0);
  });

  it("校验 Webhook 出站白名单并脱敏返回 URL", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-notify-allowlist-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const sentUrls: string[] = [];
    const sender: WebhookSender = (url) => {
      sentUrls.push(url);
      return Promise.resolve({ ok: true, status: 200, body: "ok" });
    };
    const service = new NotificationService(store, sender, ["hooks.example.com"]);

    await expect(service.createChannel({ name: "bad", type: "webhook", url: "https://evil.example.net/hook", enabled: true, minLevel: "warning" }, "admin")).rejects.toThrow("WEBHOOK_ALLOWLIST");
    const channel = await service.createChannel({ name: "ops", type: "webhook", url: "https://hooks.example.com/token/secret?key=hidden", enabled: true, minLevel: "warning" }, "admin");
    const channels = await service.listChannels();
    await service.notifyAlerts([alert]);

    expect(channel.url).toBe("https://hooks.example.com/...");
    expect(channels[0]?.url).toBe("https://hooks.example.com/...");
    expect(sentUrls[0]).toBe("https://hooks.example.com/token/secret?key=hidden");
  });

  it("加密保存 Webhook URL 并兼容旧明文渠道", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-notify-encrypted-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const sentUrls: string[] = [];
    const sender: WebhookSender = (url) => {
      sentUrls.push(url);
      return Promise.resolve({ ok: true, status: 200, body: "ok" });
    };
    const service = new NotificationService(store, sender, [], "test-secret-with-enough-length");

    const channel = await service.createChannel({ name: "ops", type: "webhook", url: "https://hooks.example.com/token/secret?key=hidden", enabled: true, minLevel: "warning" }, "admin");
    await store.update((state) => ({
      data: {
        ...state,
        notificationChannels: [
          ...(state.notificationChannels ?? []),
          { id: "legacy", name: "legacy", type: "webhook", url: "https://legacy.example.com/raw-secret", enabled: true, minLevel: "warning", createdAt: "2026-05-22T00:00:00.000Z", updatedAt: "2026-05-22T00:00:00.000Z", updatedBy: "admin" }
        ]
      },
      result: undefined
    }));
    const state = await store.read();
    const channels = await service.listChannels();
    await service.notifyAlerts([alert]);

    expect(channel.url).toBe("https://hooks.example.com/...");
    expect(state.notificationChannels?.[0]?.url).toBeUndefined();
    expect(state.notificationChannels?.[0]?.encryptedUrl).toMatch(/^enc:v1:/u);
    expect(JSON.stringify(state.notificationChannels?.[0])).not.toContain("hidden");
    expect(channels.map((item) => item.url)).toEqual(["https://hooks.example.com/...", "https://legacy.example.com/..."]);
    expect(sentUrls).toContain("https://hooks.example.com/token/secret?key=hidden");
    expect(sentUrls).toContain("https://legacy.example.com/raw-secret");
  });

  it("使用旧密钥迁移并重加密通知渠道 URL", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-notify-rotate-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const oldService = new NotificationService(store, () => Promise.resolve({ ok: true, status: 200, body: "ok" }), [], "old-secret-with-enough-length");

    await oldService.createChannel({ name: "ops", type: "webhook", url: "https://hooks.example.com/token/old-secret", enabled: true, minLevel: "warning" }, "admin");
    await store.update((state) => ({
      data: {
        ...state,
        notificationChannels: [
          ...(state.notificationChannels ?? []),
          { id: "legacy", name: "legacy", type: "webhook", url: "https://legacy.example.com/raw-secret", enabled: true, minLevel: "warning", createdAt: "2026-05-22T00:00:00.000Z", updatedAt: "2026-05-22T00:00:00.000Z", updatedBy: "admin" }
        ]
      },
      result: undefined
    }));
    const sentUrls: string[] = [];
    const newService = new NotificationService(store, (url) => {
      sentUrls.push(url);
      return Promise.resolve({ ok: true, status: 200, body: "ok" });
    }, [], "new-secret-with-enough-length");

    const result = await newService.rotateWebhookSecrets({ previousSecret: "old-secret-with-enough-length" }, "owner");
    const state = await store.read();
    await newService.notifyAlerts([alert]);

    expect(result).toMatchObject({ total: 2, rotated: 2, plaintextMigrated: 1, failed: 0 });
    expect(state.notificationChannels?.every((channel) => !channel.url && channel.encryptedUrl?.startsWith("enc:v1:"))).toBe(true);
    expect(JSON.stringify(state.notificationChannels)).not.toContain("raw-secret");
    expect(JSON.stringify(state.notificationChannels)).not.toContain("old-secret");
    expect(sentUrls).toContain("https://hooks.example.com/token/old-secret");
    expect(sentUrls).toContain("https://legacy.example.com/raw-secret");
  });
});
