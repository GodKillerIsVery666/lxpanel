import { useEffect, useState } from "react";
import { BellDot, X } from "lucide-react";

interface NotificationItem {
  id: string;
  level: "warning" | "critical" | "info";
  message: string;
  time: string;
  read: boolean;
}

interface NotificationCenterProps {
  locale: "zh-CN" | "en-US";
}

export function NotificationCenter({ locale }: NotificationCenterProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // 从 API 获取通知（告警事件 + 投递状态）
  useEffect(() => {
    if (!open) {
      return;
    }
    // 在实际实现中会调用 API
    // 这里模拟一些样本数据
    setNotifications([
      { id: "1", level: "warning", message: locale === "en-US" ? "CPU usage exceeds 80%" : "CPU 使用率超过 80%", time: new Date().toISOString(), read: false },
      { id: "2", level: "info", message: locale === "en-US" ? "System backup completed" : "系统备份已完成", time: new Date(Date.now() - 3600000).toISOString(), read: false },
      { id: "3", level: "critical", message: locale === "en-US" ? "Disk usage at 91%" : "磁盘使用率 91%", time: new Date(Date.now() - 7200000).toISOString(), read: true }
    ]);
  }, [open, locale]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div style={{ position: "relative" }}>
      <button
        className="command-trigger"
        onClick={() => setOpen(!open)}
        style={{ position: "relative", minHeight: 34, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 999, background: "#fff", cursor: "pointer" }}
        aria-label={locale === "en-US" ? "Notifications" : "通知"}
      >
        <BellDot size={16} />
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4,
            background: "var(--red)", color: "#fff",
            borderRadius: "999px", width: 18, height: 18,
            fontSize: 11, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 9 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", top: "100%", right: 0, zIndex: 10,
            width: 340, marginTop: 6,
            background: "var(--panel)", border: "1px solid var(--line)",
            borderRadius: 8, boxShadow: "0 8px 24px rgba(30,27,24,.12)",
            maxHeight: 400, overflow: "auto"
          }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", fontWeight: 800, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{locale === "en-US" ? "Notifications" : "通知"}{unreadCount > 0 ? ` (${unreadCount})` : ""}</span>
              <button onClick={() => setOpen(false)} style={{ border: 0, background: "none", cursor: "pointer" }}><X size={14} /></button>
            </div>
            {notifications.length === 0 ? (
              <p style={{ padding: 20, textAlign: "center", color: "var(--muted)", margin: 0 }}>
                {locale === "en-US" ? "No notifications" : "暂无通知"}
              </p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} style={{
                  padding: "8px 12px", borderBottom: "1px solid var(--line)",
                  background: n.read ? "transparent" : "#f5f3f1",
                  display: "flex", gap: 8, alignItems: "flex-start"
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                    background: n.level === "critical" ? "var(--red)" : n.level === "warning" ? "var(--amber)" : "var(--primary)"
                  }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4 }}>{n.message}</p>
                    <span style={{ color: "var(--muted)", fontSize: 11 }}>
                      {new Date(n.time).toLocaleTimeString(locale === "zh-CN" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
