import { useEffect, useState } from "react";
import { Plus, Send, Terminal, Trash2 } from "lucide-react";
import type { Connector, Host, HostGroup } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { StatusPill } from "../components/StatusPill.js";
import { formatDate } from "../utils/format.js";

export function HostsPage(): JSX.Element {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [groups, setGroups] = useState<HostGroup[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [tags, setTags] = useState("");
  const [connectorId, setConnectorId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupHostIds, setGroupHostIds] = useState("");
  const [batchHostIds, setBatchHostIds] = useState("");
  const [batchCommand, setBatchCommand] = useState("hostname");
  const [sshUser, setSshUser] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    try {
      const [hostResponse, groupResponse, connectorResponse] = await Promise.allSettled([api.hosts(), api.hostGroups(), api.connectors()]);
      if (hostResponse.status === "fulfilled") {
        setHosts(hostResponse.value.hosts);
      } else {
        setError(hostResponse.reason instanceof Error ? hostResponse.reason.message : "加载失败。");
      }
      if (groupResponse.status === "fulfilled") {
        setGroups(groupResponse.value.groups);
      }
      if (connectorResponse.status === "fulfilled") {
        setConnectors(connectorResponse.value.connectors);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败。");
    }
  }

  async function create(): Promise<void> {
    try {
      await api.createHost({
        name,
        ...(address ? { address } : {}),
        tags: splitTags(tags),
        ...(connectorId ? { connectorId } : {})
      });
      setName("");
      setAddress("");
      setTags("");
      setConnectorId("");
      setError(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建失败。");
    }
  }

  async function remove(hostId: string): Promise<void> {
    try {
      await api.deleteHost(hostId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "删除失败。");
    }
  }

  async function createGroup(): Promise<void> {
    try {
      const response = await api.createHostGroup({ name: groupName, tags: [], hostIds: splitIds(groupHostIds) });
      setNotice(`已创建主机组：${response.group.name}`);
      setGroupName("");
      setGroupHostIds("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建主机组失败。");
    }
  }

  async function runBatch(): Promise<void> {
    try {
      const response = await api.createHostBatchCommand({ workspace: "default", hostIds: splitIds(batchHostIds), command: batchCommand, args: [] });
      setNotice(`已下发 ${response.commands.length} 个连接器命令。`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "批量命令失败。");
    }
  }

  async function openSsh(host: Host): Promise<void> {
    try {
      const response = await api.createHostSshSession({ hostId: host.id, ...(sshUser ? { username: sshUser } : {}) });
      setNotice(`SSH 会话命令已排队：${response.command.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建 SSH 会话失败。");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading"><div><h1>主机资产</h1><p>本地与连接器发现的受管主机</p></div></div>
      {error ? <div className="form-error">{error}</div> : null}
      {notice ? <p className="notice">{notice}</p> : null}
      <section className="table-panel">
        <div className="panel-title">新增主机</div>
        <div className="inline-form wrap">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="主机名称" />
          <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="地址或备注入口" />
          <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="标签，逗号分隔" />
          <select value={connectorId} onChange={(event) => setConnectorId(event.target.value)}>
            <option value="">不绑定连接器</option>
            {connectors.map((connector) => <option value={connector.id} key={connector.id}>{connector.name}</option>)}
          </select>
          <button type="button" onClick={() => void create()}><Plus size={16} /> 新增</button>
        </div>
      </section>
      <section className="table-panel">
        <div className="panel-title">主机组和批量任务</div>
        <div className="inline-form wrap"><input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="主机组名称" /><input value={groupHostIds} onChange={(event) => setGroupHostIds(event.target.value)} placeholder="主机 ID，逗号分隔" /><button type="button" onClick={() => void createGroup()}><Plus size={16} /> 建组</button></div>
        <div className="inline-form wrap"><input value={batchHostIds} onChange={(event) => setBatchHostIds(event.target.value)} placeholder="主机 ID，逗号分隔" /><input value={batchCommand} onChange={(event) => setBatchCommand(event.target.value)} placeholder="命令" /><button type="button" onClick={() => void runBatch()}><Send size={16} /> 下发</button></div>
        <table><thead><tr><th>组名</th><th>主机数</th><th>更新时间</th></tr></thead><tbody>{groups.map((group) => <tr key={group.id}><td>{group.name}</td><td>{group.hostIds.length}</td><td>{formatDate(group.updatedAt)}</td></tr>)}</tbody></table>
      </section>
      <section className="table-panel">
        <div className="panel-title">主机列表</div>
        <div className="inline-form wrap"><input value={sshUser} onChange={(event) => setSshUser(event.target.value)} placeholder="SSH 用户，可选" /></div>
        <table>
          <thead><tr><th>名称</th><th>状态</th><th>地址</th><th>标签</th><th>连接器</th><th>最近在线</th><th>操作</th></tr></thead>
          <tbody>{hosts.map((host) => (
            <tr key={host.id}>
              <td>{host.name}</td>
              <td><StatusPill status={host.status} /></td>
              <td>{host.address ?? "-"}</td>
              <td>{host.tags.length ? host.tags.join(", ") : "-"}</td>
              <td>{host.connectorName ?? "-"}</td>
              <td>{host.lastSeenAt ? formatDate(host.lastSeenAt) : "-"}</td>
              <td className="row-actions"><button className="mini-button" onClick={() => void openSsh(host)}><Terminal size={14} /> SSH</button>{host.id.startsWith("connector:") ? null : <button className="mini-button" onClick={() => void remove(host.id)}><Trash2 size={14} /> 删除</button>}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>
    </main>
  );
}

function splitTags(value: string): string[] {
  return value.split(/[;,，]/u).map((item) => item.trim()).filter(Boolean);
}

function splitIds(value: string): string[] {
  return value.split(/[;,，\s]+/u).map((item) => item.trim()).filter(Boolean);
}
