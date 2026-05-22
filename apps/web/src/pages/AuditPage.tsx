import { useEffect, useState } from "react";
import type { AuditEvent } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { StatusPill } from "../components/StatusPill.js";
import { formatDate } from "../utils/format.js";

export function AuditPage(): JSX.Element {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.audit().then((response) => setEvents(response.events)).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "加载失败。"));
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading"><div><h1>审计</h1><p>最近 200 条安全事件</p></div></div>
      {error ? <div className="form-error">{error}</div> : null}
      <section className="table-panel">
        <table>
          <thead><tr><th>时间</th><th>操作者</th><th>动作</th><th>对象</th><th>状态</th></tr></thead>
          <tbody>{events.map((item) => <tr key={item.id}><td>{formatDate(item.time)}</td><td>{item.actor}</td><td>{item.action}</td><td>{item.target}</td><td><StatusPill status={item.status} /></td></tr>)}</tbody>
        </table>
      </section>
    </main>
  );
}
