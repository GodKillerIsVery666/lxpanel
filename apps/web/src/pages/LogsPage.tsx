import { useEffect, useState, type FormEvent } from "react";
import { FileText, Folder, RotateCw } from "lucide-react";
import type { FileEntry, LogRoot, LogTail } from "@lxpanel/shared";
import { api, type FileListResponse } from "../api/client.js";
import { formatBytes, formatDate } from "../utils/format.js";

export function LogsPage(): JSX.Element {
  const [roots, setRoots] = useState<LogRoot[]>([]);
  const [path, setPath] = useState("");
  const [listing, setListing] = useState<FileListResponse | null>(null);
  const [tail, setTail] = useState<LogTail | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadRoots(): Promise<void> {
    const response = await api.logRoots();
    setRoots(response.roots);
    if (response.roots[0] && !path) {
      await loadFiles(response.roots[0].path);
    }
  }

  async function loadFiles(nextPath = path): Promise<void> {
    try {
      const result = await api.logFiles(nextPath || undefined);
      setListing(result);
      setPath(result.path);
      setTail(null);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败。");
    }
  }

  async function loadTail(nextPath = path): Promise<void> {
    try {
      const result = await api.logTail(nextPath, 300);
      setTail(result.tail);
      setPath(result.tail.path);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "读取失败。");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void loadFiles(path);
  }

  function open(entry: FileEntry): void {
    if (entry.type === "directory") {
      void loadFiles(entry.path);
      return;
    }
    if (entry.type === "file") {
      void loadTail(entry.path);
    }
  }

  useEffect(() => {
    loadRoots().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "加载失败。"));
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading"><div><h1>日志</h1><p>{tail ? `${formatBytes(tail.sizeBytes)} · ${formatDate(tail.modifiedAt)}` : listing?.root ?? "受控日志目录"}</p></div><button className="icon-button" onClick={() => void loadFiles(path)} title="刷新"><RotateCw size={18} /></button></div>
      <div className="root-chips">{roots.map((root) => <button key={root.path} onClick={() => void loadFiles(root.path)}>{root.label}</button>)}</div>
      <form className="path-form" onSubmit={submit}><input value={path} onChange={(event) => setPath(event.target.value)} /><button type="submit">列目录</button><button type="button" onClick={() => void loadTail(path)}>读取</button></form>
      {error ? <div className="form-error">{error}</div> : null}
      {tail ? (
        <section className="log-panel">
          {tail.truncated ? <div className="notice">已截取尾部内容。</div> : null}
          <pre>{tail.lines.map((line, index) => <span className="log-line" key={`${index}-${line}`}>{line || " "}</span>)}</pre>
        </section>
      ) : (
        <section className="table-panel">
          <table>
            <thead><tr><th>名称</th><th>类型</th><th>大小</th><th>修改时间</th></tr></thead>
            <tbody>
              {listing?.entries.map((entry) => (
                <tr key={entry.path} onClick={() => open(entry)} className="clickable-row">
                  <td className="file-name">{entry.type === "directory" ? <Folder size={16} /> : <FileText size={16} />}{entry.name}</td><td>{entry.type}</td><td>{formatBytes(entry.sizeBytes)}</td><td>{formatDate(entry.modifiedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
