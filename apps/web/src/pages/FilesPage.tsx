import { useEffect, useState, type FormEvent } from "react";
import { FileText, Folder, FolderPlus, RotateCw, Save, Trash2 } from "lucide-react";
import type { FileEntry } from "@lxpanel/shared";
import { api, type FileListResponse } from "../api/client.js";
import { formatBytes, formatDate } from "../utils/format.js";

export function FilesPage(): JSX.Element {
  const [path, setPath] = useState("");
  const [listing, setListing] = useState<FileListResponse | null>(null);
  const [filePath, setFilePath] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [fileTruncated, setFileTruncated] = useState(false);
  const [newDirectoryName, setNewDirectoryName] = useState("");
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
      return;
    }
    if (entry.type === "file") {
      void openFile(entry.path);
    }
  }

  async function openFile(nextPath: string): Promise<void> {
    try {
      const response = await api.readFile(nextPath);
      setFilePath(response.file.path);
      setFileContent(response.file.content);
      setFileTruncated(response.file.truncated);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "读取失败。");
    }
  }

  async function saveFile(): Promise<void> {
    try {
      const response = await api.writeFile(filePath, fileContent);
      setFileContent(response.file.content);
      setFileTruncated(response.file.truncated);
      await load(listing?.path ?? path);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存失败。");
    }
  }

  async function createDirectory(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    try {
      await api.createDirectory(joinPath(listing?.path ?? path, newDirectoryName));
      setNewDirectoryName("");
      await load(listing?.path ?? path);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建目录失败。");
    }
  }

  async function deletePath(targetPath: string): Promise<void> {
    if (!window.confirm(`删除 ${targetPath} 后不可恢复，继续吗？`)) {
      return;
    }
    try {
      await api.deleteFile(targetPath);
      if (targetPath === filePath) {
        setFilePath("");
        setFileContent("");
        setFileTruncated(false);
      }
      await load(listing?.path ?? path);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "删除失败。");
    }
  }

  useEffect(() => {
    void load("");
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading"><div><h1>文件</h1><p>{listing?.root ?? "受控根目录"}</p></div><button className="icon-button" onClick={() => void load()} title="刷新"><RotateCw size={18} /></button></div>
      <form className="path-form" onSubmit={submit}><input value={path} onChange={(event) => setPath(event.target.value)} /><button type="submit">打开</button></form>
      <form className="inline-form wrap" onSubmit={(event) => void createDirectory(event)}><input value={newDirectoryName} onChange={(event) => setNewDirectoryName(event.target.value)} placeholder="新目录名" /><button type="submit"><FolderPlus size={16} /> 创建目录</button></form>
      {error ? <div className="form-error">{error}</div> : null}
      <section className="table-panel">
        <table>
          <thead><tr><th>名称</th><th>类型</th><th>大小</th><th>修改时间</th><th>操作</th></tr></thead>
          <tbody>
            {listing?.entries.map((entry) => (
              <tr key={entry.path} onClick={() => open(entry)} className={entry.type === "directory" ? "clickable-row" : ""}>
                <td className="file-name">{entry.type === "directory" ? <Folder size={16} /> : <FileText size={16} />}{entry.name}</td><td>{entry.type}</td><td>{formatBytes(entry.sizeBytes)}</td><td>{formatDate(entry.modifiedAt)}</td><td className="row-actions"><button title="删除" onClick={(event) => { event.stopPropagation(); void deletePath(entry.path); }}><Trash2 size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {filePath ? <section className="table-panel"><div className="panel-title">{filePath}</div>{fileTruncated ? <p className="notice">文件较大，仅载入前 512 KiB。</p> : null}<textarea className="file-editor" value={fileContent} onChange={(event) => setFileContent(event.target.value)} /><div className="inline-form wrap"><button className="mini-button" onClick={() => void saveFile()}><Save size={15} /> 保存</button><button className="mini-button" onClick={() => void deletePath(filePath)}><Trash2 size={15} /> 删除</button></div></section> : null}
    </main>
  );
}

function joinPath(basePath: string, name: string): string {
  const trimmedName = name.trim();
  const separator = basePath.includes("\\") ? "\\" : "/";
  return `${basePath.replace(/[\\/]+$/u, "")}${separator}${trimmedName}`;
}
