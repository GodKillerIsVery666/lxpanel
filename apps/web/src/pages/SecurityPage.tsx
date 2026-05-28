import { useEffect, useState } from "react";
import { ApiTokenScopes, type ApiToken, type ApiTokenScope, type AuthSession, type SecurityHardeningPlan, type SecurityPosture } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { StatusPill } from "../components/StatusPill.js";
import { VirtualTable, type VirtualColumn } from "../components/VirtualTable.js";
import { SecuritySettingsPanel } from "../components/SecuritySettingsPanel.js";
import { WebAuthnPanel } from "../components/WebAuthnPanel.js";
import { pageText } from "../i18n/resources.js";
import { formatDate } from "../utils/format.js";
import { readLocalePreference } from "../utils/preferences.js";

type SecurityCheck = SecurityPosture["checks"][number];
type HardeningItem = SecurityHardeningPlan["items"][number];

export function SecurityPage(): JSX.Element {
  const [posture, setPosture] = useState<SecurityPosture | null>(null);
  const [locale] = useState(() => readLocalePreference());
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
  const text = pageText[locale].security;
  const checkColumns: Array<VirtualColumn<SecurityCheck>> = [
    { id: "item", header: text.columns.item, cell: (check) => check.label, sortValue: (check) => check.label },
    { id: "status", header: text.columns.status, cell: (check) => <StatusPill status={check.status} />, sortValue: (check) => check.status },
    { id: "detail", header: text.columns.detail, cell: (check) => check.detail }
  ];
  const hardeningColumns: Array<VirtualColumn<HardeningItem>> = [
    { id: "item", header: text.columns.item, cell: (item) => item.title, sortValue: (item) => item.title },
    { id: "risk", header: text.columns.risk, cell: (item) => item.risk, sortValue: (item) => item.risk },
    { id: "status", header: text.columns.status, cell: (item) => <StatusPill status={item.status} />, sortValue: (item) => item.status },
    { id: "recommendation", header: text.columns.recommendation, cell: (item) => item.recommendation },
    { id: "command", header: text.columns.command, cell: (item) => item.command ? <code className="inline-code">{item.command}</code> : "-" }
  ];
  const sessionColumns: Array<VirtualColumn<AuthSession>> = [
    { id: "user", header: text.columns.user, cell: (session) => session.username, sortValue: (session) => session.username },
    { id: "createdAt", header: text.columns.createdAt, cell: (session) => formatDate(session.createdAt), sortValue: (session) => session.createdAt },
    { id: "expiresAt", header: text.columns.expiresAt, cell: (session) => formatDate(session.expiresAt), sortValue: (session) => session.expiresAt },
    { id: "current", header: text.columns.current, cell: (session) => session.current ? text.yes : text.no, sortValue: (session) => session.current },
    { id: "actions", header: text.columns.actions, className: "row-actions", cell: (session) => <button className="mini-button" onClick={() => void revoke(session.id)}>{text.revoke}</button> }
  ];
  const tokenColumns: Array<VirtualColumn<ApiToken>> = [
    { id: "name", header: text.columns.name, cell: (token) => token.name, sortValue: (token) => token.name },
    { id: "role", header: text.columns.role, cell: (token) => token.role, sortValue: (token) => token.role },
    { id: "status", header: text.columns.status, cell: (token) => <StatusPill status={token.status} label={apiTokenStatusLabel(token, text)} />, sortValue: (token) => token.status },
    { id: "scopes", header: text.columns.scopes, cell: (token) => token.scopes.join(", ") },
    { id: "createdAt", header: text.columns.createdAt, cell: (token) => formatDate(token.createdAt), sortValue: (token) => token.createdAt },
    { id: "expiresAt", header: text.columns.expiresAt, cell: (token) => formatApiTokenExpiry(token, text), sortValue: (token) => token.expiresAt },
    { id: "lastUsed", header: text.columns.lastUsed, cell: (token) => token.lastUsedAt ? formatDate(token.lastUsedAt) : "-", sortValue: (token) => token.lastUsedAt },
    { id: "actions", header: text.columns.actions, className: "row-actions", cell: (token) => <button className="mini-button" onClick={() => void revokeToken(token.id)}>{text.revoke}</button> }
  ];

  return (
    <main className="page-stack">
      <div className="page-heading"><div><h1>{text.title}</h1><p>{text.subtitle}</p></div></div>
      {error ? <div className="form-error">{error}</div> : null}
      <div className="security-grid">
        <section className="table-panel"><div className="panel-title">{text.cookie}</div><StatusPill status={posture?.cookieSecure ? "secure" : "warn"} /></section>
        <section className="table-panel"><div className="panel-title">{text.ipAllowlist}</div><StatusPill status={posture?.ipAllowlistEnabled ? "secure" : "warn"} /></section>
        <section className="table-panel"><div className="panel-title">{text.connectors}</div><strong>{posture?.connectorCount ?? 0}</strong></section>
        <section className="table-panel"><div className="panel-title">{text.users}</div><strong>{posture?.userCount ?? 0}</strong></section>
        <section className="table-panel"><div className="panel-title">{text.tasks}</div><strong>{posture?.taskCount ?? 0}</strong></section>
      </div>
      <section className="table-panel"><div className="panel-title">{text.managedRoots}</div>{posture?.managedRoots.map((item) => <code className="path-code" key={item}>{item}</code>)}</section>
      <section className="table-panel"><div className="panel-title">{text.logRoots}</div>{posture?.logRoots.map((item) => <code className="path-code" key={item}>{item}</code>)}</section>
      <section className="table-panel"><div className="panel-title">{text.ipAllowlist}</div>{posture?.ipAllowlist.length ? posture.ipAllowlist.map((item) => <code className="path-code" key={item}>{item}</code>) : <p className="muted-text">{text.notEnabled}</p>}</section>
      <section className="table-panel"><div className="panel-title">{text.snapshots}</div><strong>{posture?.backupCount ?? 0}</strong></section>
      <section className="table-panel">
        <div className="panel-title">{text.checks}</div>
        <VirtualTable tableId="security-checks" rows={posture?.checks ?? []} columns={checkColumns} getRowKey={(check) => check.id} height={320} />
      </section>
      <section className="table-panel">
        <div className="panel-title">{text.hardening}</div>
        <VirtualTable tableId="security-hardening" rows={hardeningPlan?.items ?? []} columns={hardeningColumns} getRowKey={(item) => item.id} height={360} />
      </section>
      <section className="table-panel">
        <div className="panel-title">{text.mfa}</div>
        <div className="inline-form wrap"><button type="button" onClick={() => void beginTotp()}>{text.generateSecret}</button><input value={totpCode} onChange={(event) => setTotpCode(event.target.value)} inputMode="numeric" maxLength={6} placeholder={text.code} /><button type="button" onClick={() => void confirmTotp()}>{text.confirmEnable}</button><button type="button" onClick={() => void disableTotp()}>{text.disable}</button></div>
        {totpSecret ? <code className="path-code">{totpSecret}</code> : null}
        {totpUri ? <code className="path-code">{totpUri}</code> : null}
      </section>
      <section className="table-panel">
        <div className="panel-title">{text.sessions}</div>
        <VirtualTable tableId="security-sessions" rows={sessions} columns={sessionColumns} getRowKey={(session) => session.id} height={320} />
      </section>
      <section className="table-panel">
        <div className="panel-title">{text.apiToken}</div>
        <div className="inline-form wrap"><input value={tokenName} onChange={(event) => setTokenName(event.target.value)} placeholder={text.tokenName} /><input value={tokenDays} onChange={(event) => setTokenDays(event.target.value)} inputMode="numeric" placeholder={text.tokenDays} /><button type="button" onClick={() => void createToken()}>{text.create}</button></div>
        <div className="scope-grid">{ApiTokenScopes.map((scope) => <label className="compact-check" key={scope}><input type="checkbox" checked={tokenScopes.includes(scope)} onChange={() => toggleScope(scope)} />{scope}</label>)}</div>
        {newTokenSecret ? <code className="path-code">{newTokenSecret}</code> : null}
        {attentionTokens.length ? <p className="notice">{text.attention(attentionTokens.length)}</p> : null}
        <VirtualTable tableId="security-api-tokens" rows={apiTokens} columns={tokenColumns} getRowKey={(token) => token.id} />
      </section>
      <section className="table-panel"><div className="panel-title">{text.recommendations}</div>{posture?.recommendations.length ? posture.recommendations.map((item) => <p className="notice" key={item}>{item}</p>) : <p className="muted-text">{text.none}</p>}</section>
      <SecuritySettingsPanel />
      <WebAuthnPanel locale={locale} />
    </main>
  );
}

function apiTokenStatusLabel(token: ApiToken, text: typeof pageText["zh-CN"]["security"]): string {
  if (token.status === "expired") {
    return text.tokenExpired;
  }
  if (token.status === "expiring") {
    return text.tokenExpiring;
  }
  return text.tokenNormal;
}

function formatApiTokenExpiry(token: ApiToken, text: typeof pageText["zh-CN"]["security"]): string {
  if (!token.expiresAt) {
    return text.neverExpires;
  }
  if (token.status === "expired") {
    return `${formatDate(token.expiresAt)} (${text.expiredSuffix})`;
  }
  if (typeof token.daysUntilExpiry === "number" && token.daysUntilExpiry <= 7) {
    return `${formatDate(token.expiresAt)} (${text.daysLeft(Math.max(token.daysUntilExpiry, 0))})`;
  }
  return formatDate(token.expiresAt);
}
