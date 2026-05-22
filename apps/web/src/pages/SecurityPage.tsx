import { useEffect, useState } from "react";
import type { SecurityPosture } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { StatusPill } from "../components/StatusPill.js";

export function SecurityPage(): JSX.Element {
  const [posture, setPosture] = useState<SecurityPosture | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.security().then((response) => setPosture(response.posture)).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "加载失败。"));
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading"><div><h1>安全</h1><p>会话、文件根目录与部署状态</p></div></div>
      {error ? <div className="form-error">{error}</div> : null}
      <div className="security-grid">
        <section className="table-panel"><div className="panel-title">会话 Cookie</div><StatusPill status={posture?.cookieSecure ? "secure" : "warn"} /></section>
        <section className="table-panel"><div className="panel-title">连接器</div><strong>{posture?.connectorCount ?? 0}</strong></section>
        <section className="table-panel"><div className="panel-title">用户</div><strong>{posture?.userCount ?? 0}</strong></section>
        <section className="table-panel"><div className="panel-title">任务</div><strong>{posture?.taskCount ?? 0}</strong></section>
      </div>
      <section className="table-panel"><div className="panel-title">受控目录</div>{posture?.managedRoots.map((item) => <code className="path-code" key={item}>{item}</code>)}</section>
      <section className="table-panel"><div className="panel-title">日志目录</div>{posture?.logRoots.map((item) => <code className="path-code" key={item}>{item}</code>)}</section>
      <section className="table-panel"><div className="panel-title">备份快照</div><strong>{posture?.backupCount ?? 0}</strong></section>
      <section className="table-panel"><div className="panel-title">建议</div>{posture?.recommendations.length ? posture.recommendations.map((item) => <p className="notice" key={item}>{item}</p>) : <p className="muted-text">无。</p>}</section>
    </main>
  );
}
