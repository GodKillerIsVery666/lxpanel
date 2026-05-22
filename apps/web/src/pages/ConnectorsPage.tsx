import { useEffect, useState, type FormEvent } from "react";
import type { Connector } from "@lxpanel/shared";
import { api, type CreatedConnectorResponse } from "../api/client.js";
import { StatusPill } from "../components/StatusPill.js";
import { formatDate } from "../utils/format.js";

export function ConnectorsPage(): JSX.Element {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [name, setName] = useState("本地连接器");
  const [token, setToken] = useState<CreatedConnectorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    try {
      setConnectors((await api.connectors()).connectors);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败。");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    try {
      const created = await api.createConnector({ name, capabilities: ["metrics", "ssh-client-offload"] });
      setToken(created);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建失败。");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading"><div><h1>连接器</h1><p>本地客户端承担远程连接负载</p></div></div>
      <form className="inline-form" onSubmit={(event) => void submit(event)}><input value={name} onChange={(event) => setName(event.target.value)} /><button type="submit">创建令牌</button></form>
      {token ? <div className="token-box"><strong>{token.connector.name}</strong><code>{token.token}</code></div> : null}
      {error ? <div className="form-error">{error}</div> : null}
      <section className="table-panel">
        <table>
          <thead><tr><th>名称</th><th>状态</th><th>能力</th><th>最近心跳</th></tr></thead>
          <tbody>{connectors.map((item) => <tr key={item.id}><td>{item.name}</td><td><StatusPill status={item.status} /></td><td>{item.capabilities.join(", ") || "-"}</td><td>{formatDate(item.lastSeenAt)}</td></tr>)}</tbody>
        </table>
      </section>
    </main>
  );
}
