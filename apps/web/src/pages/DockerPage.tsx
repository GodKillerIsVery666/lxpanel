import { useEffect, useState } from "react";
import { Play, RotateCcw, RotateCw, Square } from "lucide-react";
import type { DockerContainer, DockerImage, DockerStatus } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { StatusPill } from "../components/StatusPill.js";

export function DockerPage(): JSX.Element {
  const [status, setStatus] = useState<DockerStatus | null>(null);
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    try {
      const statusResponse = await api.dockerStatus();
      setStatus(statusResponse.status);
      if (statusResponse.status.available) {
        const [containerResponse, imageResponse] = await Promise.all([api.dockerContainers(), api.dockerImages()]);
        setContainers(containerResponse.containers);
        setImages(imageResponse.images);
      } else {
        setContainers([]);
        setImages([]);
      }
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败。");
    }
  }

  async function act(id: string, action: "start" | "stop" | "restart"): Promise<void> {
    setBusy(`${id}:${action}`);
    try {
      await api.dockerAction({ id, action });
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
      <div className="page-heading">
        <div><h1>容器</h1><p>{status?.available ? `Docker ${status.version ?? ""}` : "Docker 未就绪"}</p></div>
        <button className="icon-button" onClick={() => void load()} title="刷新"><RotateCw size={18} /></button>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      {status?.error ? <div className="notice">{status.error}</div> : null}
      <div className="security-grid">
        <section className="table-panel"><div className="panel-title">引擎</div><StatusPill status={status?.available ? "online" : "offline"} /></section>
        <section className="table-panel"><div className="panel-title">Compose</div><StatusPill status={status?.composeAvailable ? "online" : "offline"} /></section>
      </div>
      <section className="table-panel">
        <div className="panel-title">容器</div>
        <table>
          <thead><tr><th>名称</th><th>镜像</th><th>状态</th><th>端口</th><th>操作</th></tr></thead>
          <tbody>
            {containers.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td><td>{item.image}</td><td><StatusPill status={item.state} /></td><td>{item.ports ?? "-"}</td>
                <td className="row-actions">
                  <button title="启动" disabled={Boolean(busy)} onClick={() => void act(item.id, "start")}><Play size={15} /></button>
                  <button title="停止" disabled={Boolean(busy)} onClick={() => void act(item.id, "stop")}><Square size={15} /></button>
                  <button title="重启" disabled={Boolean(busy)} onClick={() => void act(item.id, "restart")}><RotateCcw size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="table-panel">
        <div className="panel-title">镜像</div>
        <table>
          <thead><tr><th>仓库</th><th>标签</th><th>ID</th><th>大小</th><th>创建</th></tr></thead>
          <tbody>{images.map((item) => <tr key={`${item.id}-${item.repository}-${item.tag}`}><td>{item.repository}</td><td>{item.tag}</td><td>{item.id}</td><td>{item.size}</td><td>{item.createdSince ?? "-"}</td></tr>)}</tbody>
        </table>
      </section>
    </main>
  );
}
