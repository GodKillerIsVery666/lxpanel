import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";
import type { ProcessInfo } from "@lxpanel/shared";
import { api } from "../api/client.js";

export function ProcessesPage(): JSX.Element {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    try {
      setProcesses((await api.processes()).processes);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败。");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading">
        <div><h1>进程</h1><p>按 CPU 占用排序</p></div>
        <button className="icon-button" onClick={() => void load()} title="刷新"><RotateCw size={18} /></button>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <section className="table-panel">
        <table>
          <thead><tr><th>PID</th><th>名称</th><th>CPU</th><th>内存</th></tr></thead>
          <tbody>
            {processes.map((item) => (
              <tr key={`${item.pid}-${item.name}`}><td>{item.pid}</td><td>{item.name}</td><td>{item.cpuPercent}%</td><td>{item.memoryMb} MB</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
