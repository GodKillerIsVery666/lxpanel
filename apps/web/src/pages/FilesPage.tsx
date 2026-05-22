import { useEffect, useState, type FormEvent } from "react";
import { Folder, RotateCw } from "lucide-react";
import type { FileEntry } from "@lxpanel/shared";
import { api, type FileListResponse } from "../api/client.js";
import { formatBytes, formatDate } from "../utils/format.js";

export function FilesPage(): JSX.Element {
  const [path, setPath] = useState("");
  const [listing, setListing] = useState<FileListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(nextPath = path): Promise<void> {
    try {
      const result = await api.files(nextPath || undefined);
      setListing(result);
      setPath(result.path);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败。");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void load(path);
  }

  function open(entry: FileEntry): void {
    if (entry.type === "directory") {
      void load(entry.path);
    }
  }

  useEffect(() => {
    void load("");
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading"><div><h1>文件</h1><p>{listing?.root ?? "受控根目录"}</p></div><button className="icon-button" onClick={() => void load()} title="刷新"><RotateCw size={18} /></button></div>
      <form className="path-form" onSubmit={submit}><input value={path} onChange={(event) => setPath(event.target.value)} /><button type="submit">打开</button></form>
      {error ? <div className="form-error">{error}</div> : null}
      <section className="table-panel">
        <table>
          <thead><tr><th>名称</th><th>类型</th><th>大小</th><th>修改时间</th></tr></thead>
          <tbody>
            {listing?.entries.map((entry) => (
              <tr key={entry.path} onClick={() => open(entry)} className={entry.type === "directory" ? "clickable-row" : ""}>
                <td className="file-name">{entry.type === "directory" ? <Folder size={16} /> : null}{entry.name}</td><td>{entry.type}</td><td>{formatBytes(entry.sizeBytes)}</td><td>{formatDate(entry.modifiedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
