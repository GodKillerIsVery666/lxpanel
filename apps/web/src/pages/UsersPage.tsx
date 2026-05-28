import { useEffect, useState, type FormEvent } from "react";
import { RotateCw, Trash2 } from "lucide-react";
import type { AuthUser, Role } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { formatDate } from "../utils/format.js";

export function UsersPage(): JSX.Element {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("operator");
  const [resetPassword, setResetPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    try {
      setUsers((await api.users()).users);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败。");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    try {
      await api.createUser({ username, password, role });
      setUsername("");
      setPassword("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建失败。");
    }
  }

  async function updateRole(userId: string, nextRole: Role): Promise<void> {
    try {
      await api.updateUserRole(userId, nextRole);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新失败。");
    }
  }

  async function reset(userId: string): Promise<void> {
    try {
      await api.resetUserPassword({ userId, password: resetPassword });
      setResetPassword("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "重置失败。");
    }
  }

  async function remove(userId: string): Promise<void> {
    try {
      await api.deleteUser(userId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "删除失败。");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading"><div><h1>用户</h1><p>账号、角色与密码重置</p></div><button className="icon-button" onClick={() => void load()} title="刷新"><RotateCw size={18} /></button></div>
      <form className="inline-form wrap" onSubmit={(event) => void submit(event)}>
        <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="用户名" />
        <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="初始密码" type="password" />
        <select value={role} onChange={(event) => setRole(event.target.value as Role)}><option value="operator">operator</option><option value="viewer">viewer</option><option value="owner">owner</option></select>
        <button type="submit">创建</button>
      </form>
      {error ? <div className="form-error">{error}</div> : null}
      <section className="table-panel">
        <table>
          <thead><tr><th>用户名</th><th>角色</th><th>创建时间</th><th>上次登录</th><th>密码</th><th>操作</th></tr></thead>
          <tbody>{users.map((user) => <tr key={user.id}><td>{user.username}</td><td><select value={user.role} onChange={(event) => void updateRole(user.id, event.target.value as Role)}><option value="owner">owner</option><option value="operator">operator</option><option value="viewer">viewer</option></select></td><td>{formatDate(user.createdAt)}</td><td>{formatDate(user.lastLoginAt)}</td><td><span className="password-reset-row"><input className="password-reset-input" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} type="password" placeholder="新密码" /><button className="mini-button" onClick={() => void reset(user.id)}>重置</button></span></td><td><button className="icon-button" onClick={() => void remove(user.id)} title="删除"><Trash2 size={16} /></button></td></tr>)}</tbody>
        </table>
      </section>
    </main>
  );
}
