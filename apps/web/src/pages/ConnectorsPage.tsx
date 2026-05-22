import { useEffect, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import type { Connector, ConnectorCommand } from "@lxpanel/shared";
import { api, type CreatedConnectorResponse } from "../api/client.js";
import { StatusPill } from "../components/StatusPill.js";
import { formatDate } from "../utils/format.js";

export function ConnectorsPage(): JSX.Element {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [commands, setCommands] = useState<ConnectorCommand[]>([]);
  const [name, setName] = useState("本地连接器");
  const [connectorId, setConnectorId] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [token, setToken] = useState<CreatedConnectorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    try {
      const [connectorResponse, commandResponse] = await Promise.all([api.connectors(), api.connectorCommands()]);
      setConnectors(connectorResponse.connectors);
      setCommands(commandResponse.commands);
      if (!connectorId && connectorResponse.connectors[0]) {
        setConnectorId(connectorResponse.connectors[0].id);
      }
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

  async function submitCommand(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    try {
      await api.createConnectorCommand({ connectorId, command, args: splitArgs(args) });
      setCommand("");
      setArgs("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "派发失败。");
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
      <form className="task-form" onSubmit={(event) => void submitCommand(event)}>
        <select value={connectorId} onChange={(event) => setConnectorId(event.target.value)}>{connectors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="命令，例如 ssh" />
        <input value={args} onChange={(event) => setArgs(event.target.value)} placeholder="参数，用空格分隔" />
        <button type="submit"><Send size={16} /> 派发</button>
      </form>
      <section className="table-panel">
        <div className="panel-title">命令队列</div>
        <table>
          <thead><tr><th>连接器</th><th>命令</th><th>状态</th><th>时间</th><th>输出</th></tr></thead>
          <tbody>{commands.map((item) => <tr key={item.id}><td>{item.connectorName ?? item.connectorId}</td><td><code>{[item.command, ...item.args].join(" ")}</code></td><td><StatusPill status={item.status} /></td><td>{formatDate(item.finishedAt ?? item.claimedAt ?? item.createdAt)}</td><td><pre className="inline-log">{item.stdoutTail || item.stderrTail || "-"}</pre></td></tr>)}</tbody>
        </table>
      </section>
    </main>
  );
}

function splitArgs(value: string): string[] {
  return value.split(" ").map((item) => item.trim()).filter(Boolean);
}
