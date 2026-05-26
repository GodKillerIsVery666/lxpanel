import { useEffect, useState } from "react";
import { Bell, Send, Trash2 } from "lucide-react";
import type { NotificationChannel, NotificationDelivery } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { StatusPill } from "../components/StatusPill.js";
import { formatDate } from "../utils/format.js";

export function NotificationsPage(): JSX.Element {
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [minLevel, setMinLevel] = useState<"warning" | "critical">("warning");
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    try {
      const response = await api.notifications();
      setChannels(response.channels);
      setDeliveries(response.deliveries);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败。");
    }
  }

  async function create(): Promise<void> {
    try {
      await api.createNotificationChannel({ name, url, type: "webhook", enabled: true, minLevel });
      setName("");
      setUrl("");
      setMinLevel("warning");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建失败。");
    }
  }

  async function toggle(channel: NotificationChannel): Promise<void> {
    try {
      await api.updateNotificationChannel({ channelId: channel.id, enabled: !channel.enabled });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新失败。");
    }
  }

  async function test(channelId: string): Promise<void> {
    try {
      await api.testNotificationChannel(channelId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "测试失败。");
    }
  }

  async function remove(channelId: string): Promise<void> {
    try {
      await api.deleteNotificationChannel(channelId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "删除失败。");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading"><div><h1>通知渠道</h1><p>告警触发后推送到 Webhook</p></div></div>
      {error ? <div className="form-error">{error}</div> : null}
      <section className="table-panel">
        <div className="panel-title">新增 Webhook</div>
        <div className="inline-form wrap">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="渠道名称" />
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/webhook" />
          <select value={minLevel} onChange={(event) => setMinLevel(event.target.value === "critical" ? "critical" : "warning")}>
            <option value="warning">警告及以上</option>
            <option value="critical">仅严重</option>
          </select>
          <button type="button" onClick={() => void create()}><Bell size={16} /> 新增</button>
        </div>
      </section>
      <section className="table-panel">
        <div className="panel-title">渠道</div>
        <table>
          <thead><tr><th>名称</th><th>级别</th><th>状态</th><th>地址</th><th>最近发送</th><th>结果</th><th>操作</th></tr></thead>
          <tbody>{channels.map((channel) => (
            <tr key={channel.id}>
              <td>{channel.name}</td>
              <td>{channel.minLevel}</td>
              <td><StatusPill status={channel.enabled ? "active" : "inactive"} /></td>
              <td>{maskUrl(channel.url)}</td>
              <td>{channel.lastSentAt ? formatDate(channel.lastSentAt) : "-"}</td>
              <td>{channel.lastStatus ? <StatusPill status={channel.lastStatus} /> : "-"}</td>
              <td className="row-actions"><button onClick={() => void toggle(channel)}>{channel.enabled ? "停用" : "启用"}</button><button onClick={() => void test(channel.id)}><Send size={14} /></button><button onClick={() => void remove(channel.id)}><Trash2 size={14} /></button></td>
            </tr>
          ))}</tbody>
        </table>
      </section>
      <section className="table-panel">
        <div className="panel-title">投递记录</div>
        <table>
          <thead><tr><th>时间</th><th>渠道</th><th>级别</th><th>目标</th><th>状态</th><th>错误</th></tr></thead>
          <tbody>{deliveries.map((delivery) => (
            <tr key={delivery.id}><td>{formatDate(delivery.time)}</td><td>{delivery.channelName}</td><td>{delivery.level}</td><td>{delivery.target}</td><td><StatusPill status={delivery.status} /></td><td>{delivery.error ?? "-"}</td></tr>
          ))}</tbody>
        </table>
      </section>
    </main>
  );
}

function maskUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return value;
  }
}
