import { useEffect, useState } from "react";
import { ApiTokenScopes, type ApiToken, type ApiTokenScope, type AuthSession, type SecurityHardeningPlan, type SecurityPosture } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { StatusPill } from "../components/StatusPill.js";
import { formatDate } from "../utils/format.js";

export function SecurityPage(): JSX.Element {
  const [posture, setPosture] = useState<SecurityPosture | null>(null);
  const [hardeningPlan, setHardeningPlan] = useState<SecurityHardeningPlan | null>(null);
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [apiTokens, setApiTokens] = useState<ApiToken[]>([]);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [tokenDays, setTokenDays] = useState("30");
  const [tokenScopes, setTokenScopes] = useState<ApiTokenScope[]>([...ApiTokenScopes]);
  const [newTokenSecret, setNewTokenSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    const [securityResponse, hardeningResponse, sessionResponse, tokenResponse] = await Promise.allSettled([api.security(), api.securityHardeningPlan(), api.sessions(), api.apiTokens()]);
    if (securityResponse.status === "fulfilled") {
      setPosture(securityResponse.value.posture);
    } else {
      setError(securityResponse.reason instanceof Error ? securityResponse.reason.message : "加载失败。");
    }
    if (sessionResponse.status === "fulfilled") {
      setSessions(sessionResponse.value.sessions);
    }
    if (hardeningResponse.status === "fulfilled") {
      setHardeningPlan(hardeningResponse.value.plan);
    }
    if (tokenResponse.status === "fulfilled") {
      setApiTokens(tokenResponse.value.tokens);
    }
  }

  async function beginTotp(): Promise<void> {
    try {
      const setup = await api.setupTotp();
      setTotpSecret(setup.secret);
      setTotpUri(setup.uri);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "开启失败。");
    }
  }

  async function confirmTotp(): Promise<void> {
    try {
      await api.confirmTotp(totpCode);
      setTotpSecret(null);
      setTotpUri(null);
      setTotpCode("");
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "确认失败。");
    }
  }

  async function disableTotp(): Promise<void> {
    try {
      await api.disableTotp(totpCode);
      setTotpCode("");
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "关闭失败。");
    }
  }

  async function revoke(sessionId: string): Promise<void> {
    try {
      await api.revokeSession(sessionId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "撤销失败。");
    }
  }

  async function createToken(): Promise<void> {
    try {
      if (tokenScopes.length === 0) {
        setError("至少选择一个作用域。");
        return;
      }
      const created = await api.createApiToken({ name: tokenName, expiresInDays: Number.parseInt(tokenDays, 10), scopes: tokenScopes });
      setTokenName("");
      setNewTokenSecret(created.secret);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建失败。");
    }
  }

  function toggleScope(scope: ApiTokenScope): void {
    setTokenScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]);
  }

  async function revokeToken(tokenId: string): Promise<void> {
    try {
      await api.revokeApiToken(tokenId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "撤销失败。");
    }
  }

  useEffect(() => {
    load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "加载失败。"));
  }, []);

  const attentionTokens = apiTokens.filter((token) => token.status === "expired" || token.status === "expiring");

  return (
    <main className="page-stack">
      <div className="page-heading"><div><h1>安全</h1><p>会话、文件根目录与部署状态</p></div></div>
      {error ? <div className="form-error">{error}</div> : null}
      <div className="security-grid">
        <section className="table-panel"><div className="panel-title">会话 Cookie</div><StatusPill status={posture?.cookieSecure ? "secure" : "warn"} /></section>
        <section className="table-panel"><div className="panel-title">IP 白名单</div><StatusPill status={posture?.ipAllowlistEnabled ? "secure" : "warn"} /></section>
        <section className="table-panel"><div className="panel-title">连接器</div><strong>{posture?.connectorCount ?? 0}</strong></section>
        <section className="table-panel"><div className="panel-title">用户</div><strong>{posture?.userCount ?? 0}</strong></section>
        <section className="table-panel"><div className="panel-title">任务</div><strong>{posture?.taskCount ?? 0}</strong></section>
      </div>
      <section className="table-panel"><div className="panel-title">受控目录</div>{posture?.managedRoots.map((item) => <code className="path-code" key={item}>{item}</code>)}</section>
      <section className="table-panel"><div className="panel-title">日志目录</div>{posture?.logRoots.map((item) => <code className="path-code" key={item}>{item}</code>)}</section>
      <section className="table-panel"><div className="panel-title">IP 白名单</div>{posture?.ipAllowlist.length ? posture.ipAllowlist.map((item) => <code className="path-code" key={item}>{item}</code>) : <p className="muted-text">未启用。</p>}</section>
      <section className="table-panel"><div className="panel-title">备份快照</div><strong>{posture?.backupCount ?? 0}</strong></section>
      <section className="table-panel">
        <div className="panel-title">安全巡检</div>
        <table><thead><tr><th>项目</th><th>状态</th><th>详情</th></tr></thead><tbody>{posture?.checks.map((check) => <tr key={check.id}><td>{check.label}</td><td><StatusPill status={check.status} /></td><td>{check.detail}</td></tr>)}</tbody></table>
      </section>
      <section className="table-panel">
        <div className="panel-title">加固计划</div>
        <table><thead><tr><th>项目</th><th>风险</th><th>状态</th><th>建议</th><th>命令</th></tr></thead><tbody>{hardeningPlan?.items.map((item) => <tr key={item.id}><td>{item.title}</td><td>{item.risk}</td><td><StatusPill status={item.status} /></td><td>{item.recommendation}</td><td>{item.command ? <code className="inline-code">{item.command}</code> : "-"}</td></tr>)}</tbody></table>
      </section>
      <section className="table-panel">
        <div className="panel-title">双因素认证</div>
        <div className="inline-form wrap"><button type="button" onClick={() => void beginTotp()}>生成密钥</button><input value={totpCode} onChange={(event) => setTotpCode(event.target.value)} inputMode="numeric" maxLength={6} placeholder="验证码" /><button type="button" onClick={() => void confirmTotp()}>确认启用</button><button type="button" onClick={() => void disableTotp()}>关闭</button></div>
        {totpSecret ? <code className="path-code">{totpSecret}</code> : null}
        {totpUri ? <code className="path-code">{totpUri}</code> : null}
      </section>
      <section className="table-panel">
        <div className="panel-title">活动会话</div>
        <table><thead><tr><th>用户</th><th>创建时间</th><th>过期时间</th><th>当前</th><th>操作</th></tr></thead><tbody>{sessions.map((session) => <tr key={session.id}><td>{session.username}</td><td>{formatDate(session.createdAt)}</td><td>{formatDate(session.expiresAt)}</td><td>{session.current ? "是" : "否"}</td><td><button className="mini-button" onClick={() => void revoke(session.id)}>撤销</button></td></tr>)}</tbody></table>
      </section>
      <section className="table-panel">
        <div className="panel-title">API Token</div>
        <div className="inline-form wrap"><input value={tokenName} onChange={(event) => setTokenName(event.target.value)} placeholder="Token 名称" /><input value={tokenDays} onChange={(event) => setTokenDays(event.target.value)} inputMode="numeric" placeholder="有效天数" /><button type="button" onClick={() => void createToken()}>创建</button></div>
        <div className="scope-grid">{ApiTokenScopes.map((scope) => <label className="compact-check" key={scope}><input type="checkbox" checked={tokenScopes.includes(scope)} onChange={() => toggleScope(scope)} />{scope}</label>)}</div>
        {newTokenSecret ? <code className="path-code">{newTokenSecret}</code> : null}
        {attentionTokens.length ? <p className="notice">{attentionTokens.length} 个 API Token 已过期或将在 7 天内到期，请提前轮换。</p> : null}
        <table><thead><tr><th>名称</th><th>角色</th><th>状态</th><th>作用域</th><th>创建时间</th><th>过期时间</th><th>最近使用</th><th>操作</th></tr></thead><tbody>{apiTokens.map((token) => <tr key={token.id}><td>{token.name}</td><td>{token.role}</td><td><StatusPill status={token.status} label={apiTokenStatusLabel(token)} /></td><td>{token.scopes.join(", ")}</td><td>{formatDate(token.createdAt)}</td><td>{formatApiTokenExpiry(token)}</td><td>{token.lastUsedAt ? formatDate(token.lastUsedAt) : "-"}</td><td><button className="mini-button" onClick={() => void revokeToken(token.id)}>撤销</button></td></tr>)}</tbody></table>
      </section>
      <section className="table-panel"><div className="panel-title">建议</div>{posture?.recommendations.length ? posture.recommendations.map((item) => <p className="notice" key={item}>{item}</p>) : <p className="muted-text">无。</p>}</section>
    </main>
  );
}

function apiTokenStatusLabel(token: ApiToken): string {
  if (token.status === "expired") {
    return "已过期";
  }
  if (token.status === "expiring") {
    return "即将到期";
  }
  return "正常";
}

function formatApiTokenExpiry(token: ApiToken): string {
  if (!token.expiresAt) {
    return "永不过期";
  }
  if (token.status === "expired") {
    return `${formatDate(token.expiresAt)}（已过期）`;
  }
  if (typeof token.daysUntilExpiry === "number" && token.daysUntilExpiry <= 7) {
    return `${formatDate(token.expiresAt)}（剩余 ${Math.max(token.daysUntilExpiry, 0)} 天）`;
  }
  return formatDate(token.expiresAt);
}
