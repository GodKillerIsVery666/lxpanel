import { useEffect, useState } from "react";
import { Play, RotateCcw, RotateCw, Square } from "lucide-react";
import type { ServiceInfo } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { StatusPill } from "../components/StatusPill.js";

export function ServicesPage(): JSX.Element {
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    try {
      setServices((await api.services()).services);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败。");
    }
  }

  async function act(name: string, action: "start" | "stop" | "restart"): Promise<void> {
    setBusy(`${name}:${action}`);
    try {
      await api.serviceAction(name, action);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "操作失败。");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading"><div><h1>服务</h1><p>systemd / Windows 服务视图</p></div><button className="icon-button" onClick={() => void load()} title="刷新"><RotateCw size={18} /></button></div>
      {error ? <div className="form-error">{error}</div> : null}
      <section className="table-panel">
        <table>
          <thead><tr><th>名称</th><th>状态</th><th>说明</th><th>操作</th></tr></thead>
          <tbody>
            {services.map((item) => (
              <tr key={item.name}>
                <td>{item.name}</td><td><StatusPill status={item.state} /></td><td>{item.description ?? "-"}</td>
                <td className="row-actions">
                  <button title="启动" disabled={Boolean(busy)} onClick={() => void act(item.name, "start")}><Play size={15} /></button>
                  <button title="停止" disabled={Boolean(busy)} onClick={() => void act(item.name, "stop")}><Square size={15} /></button>
                  <button title="重启" disabled={Boolean(busy)} onClick={() => void act(item.name, "restart")}><RotateCcw size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
