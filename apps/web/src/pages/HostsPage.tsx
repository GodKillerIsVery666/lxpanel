import { useEffect, useMemo, useState } from "react";
import { Plus, Send, Terminal, Trash2 } from "lucide-react";
import type { Connector, Host, HostGroup } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { EmptyState } from "../components/EmptyState.js";
import { StatusPill } from "../components/StatusPill.js";
import { VirtualTable, type VirtualColumn } from "../components/VirtualTable.js";
import { pageText } from "../i18n/resources.js";
import { formatDate } from "../utils/format.js";
import { readDefaultWorkspacePreference, readLocalePreference } from "../utils/preferences.js";

export function HostsPage(): JSX.Element {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [groups, setGroups] = useState<HostGroup[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [locale] = useState(() => readLocalePreference());
  const [workspace] = useState(() => readDefaultWorkspacePreference());
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [tags, setTags] = useState("");
  const [connectorId, setConnectorId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupHostIds, setGroupHostIds] = useState("");
  const [batchHostIds, setBatchHostIds] = useState("");
  const [batchCommand, setBatchCommand] = useState("hostname");
  const [sshUser, setSshUser] = useState("");
  const [hostSearch, setHostSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filteredHosts = useMemo(() => {
    const query = hostSearch.trim().toLowerCase();
    return query ? hosts.filter((host) => [host.name, host.address ?? "", host.connectorName ?? "", host.status, ...host.tags].some((value) => value.toLowerCase().includes(query))) : hosts;
  }, [hostSearch, hosts]);
  const text = pageText[locale].hosts;
  const hostColumns: Array<VirtualColumn<Host>> = [
    { id: "name", header: text.columns.name, cell: (host) => host.name, sortValue: (host) => host.name },
    { id: "status", header: text.columns.status, cell: (host) => <StatusPill status={host.status} />, sortValue: (host) => host.status },
    { id: "address", header: text.columns.address, cell: (host) => host.address ?? "-", sortValue: (host) => host.address },
    { id: "tags", header: text.columns.tags, cell: (host) => host.tags.length ? host.tags.join(", ") : "-", sortValue: (host) => host.tags.join(",") },
    { id: "connector", header: text.columns.connector, cell: (host) => host.connectorName ?? "-", sortValue: (host) => host.connectorName },
    { id: "lastSeen", header: text.columns.lastSeen, cell: (host) => host.lastSeenAt ? formatDate(host.lastSeenAt) : "-", sortValue: (host) => host.lastSeenAt },
    { id: "actions", header: text.columns.actions, className: "row-actions", cell: (host) => <><button className="mini-button" onClick={() => void openSsh(host)}><Terminal size={14} /> SSH</button>{host.id.startsWith("connector:") ? null : <button className="mini-button" onClick={() => void remove(host.id)}><Trash2 size={14} /> {text.delete}</button>}</> }
  ];

  async function load(): Promise<void> {
    try {
      const [hostResponse, groupResponse, connectorResponse] = await Promise.allSettled([api.hosts(workspace), api.hostGroups(), api.connectors()]);
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
        workspace,
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
      const response = await api.createHostBatchCommand({ workspace, hostIds: splitIds(batchHostIds), command: batchCommand, args: [] });
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
      <div className="page-heading"><div><h1>{text.title}</h1><p>{text.subtitle}</p></div></div>
      {error ? <div className="form-error">{error}</div> : null}
      {notice ? <p className="notice">{notice}</p> : null}
      <section className="table-panel">
        <div className="panel-title">{text.add}</div>
        <div className="inline-form wrap">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder={text.name} />
          <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder={text.address} />
          <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder={text.tags} />
          <select value={connectorId} onChange={(event) => setConnectorId(event.target.value)}>
            <option value="">{text.noConnector}</option>
            {connectors.map((connector) => <option value={connector.id} key={connector.id}>{connector.name}</option>)}
          </select>
          <button type="button" onClick={() => void create()}><Plus size={16} /> {text.create}</button>
        </div>
      </section>
      <section className="table-panel">
        <div className="panel-title">{text.groups}</div>
        <div className="inline-form wrap"><input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder={text.groupName} /><input value={groupHostIds} onChange={(event) => setGroupHostIds(event.target.value)} placeholder={text.hostIds} /><button type="button" onClick={() => void createGroup()}><Plus size={16} /> {text.createGroup}</button></div>
        <div className="inline-form wrap"><input value={batchHostIds} onChange={(event) => setBatchHostIds(event.target.value)} placeholder={text.hostIds} /><input value={batchCommand} onChange={(event) => setBatchCommand(event.target.value)} placeholder={text.command} /><button type="button" onClick={() => void runBatch()}><Send size={16} /> {text.dispatch}</button></div>
        {groups.length === 0 ? <EmptyState title={text.emptyGroupsTitle} description={text.emptyGroupsDescription} /> : <table><thead><tr><th>{locale === "en-US" ? "Group" : "组名"}</th><th>{locale === "en-US" ? "Hosts" : "主机数"}</th><th>{locale === "en-US" ? "Updated" : "更新时间"}</th></tr></thead><tbody>{groups.map((group) => <tr key={group.id}><td>{group.name}</td><td>{group.hostIds.length}</td><td>{formatDate(group.updatedAt)}</td></tr>)}</tbody></table>}
      </section>
      <section className="table-panel">
        <div className="panel-title">{text.list}</div>
        <div className="list-toolbar"><input value={hostSearch} onChange={(event) => setHostSearch(event.target.value)} placeholder={text.search} /><p className="muted-text">{filteredHosts.length} / {hosts.length}</p></div>
        <div className="inline-form wrap"><input value={sshUser} onChange={(event) => setSshUser(event.target.value)} placeholder={text.sshUser} /></div>
        <VirtualTable tableId="hosts" rows={filteredHosts} columns={hostColumns} getRowKey={(host) => host.id} empty={<EmptyState title={text.emptyHostsTitle} description={text.emptyHostsDescription} />} />
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
