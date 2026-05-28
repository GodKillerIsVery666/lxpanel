import { ApiTokenScopes, type ApiToken, type ApiTokenScope, type ApiTokenStatus, type AuthSession, type AuthUser, type CreatedApiToken, type CreateApiToken, type CreateUser, type IdentityProvider, type OidcCallback, type Role } from "@lxpanel/shared";
import { hashPassword, randomToken, sha256, verifyPassword } from "../../lib/crypto.js";
import type { StateStore } from "../../lib/stateStore.js";
import { buildTotpUri, generateTotpSecret, verifyTotpCode } from "../../lib/totp.js";
import type { ApiTokenRecord, PanelState, UserRecord } from "../state/panelState.js";

const sessionTtlMs = 1000 * 60 * 60 * 12;
const apiTokenExpiryWarningMs = 1000 * 60 * 60 * 24 * 7;
const oneDayMs = 1000 * 60 * 60 * 24;

export type LoginVerification = { status: "ok"; user: AuthUser } | { status: "totp_required" } | null;

export interface TotpSetupResult {
  secret: string;
  uri: string;
}

export interface ApiTokenExpirySummary {
  total: number;
  active: number;
  expiring: number;
  expired: number;
  withoutExpiry: number;
  warningDays: number;
}

export interface OidcLoginResult {
  user: AuthUser;
  provider: IdentityProvider;
  created: boolean;
  subject: string;
}

export class AuthStore {
  constructor(private readonly store: StateStore<PanelState>) {}

  async hasUsers(): Promise<boolean> {
    const state = await this.store.read();
    return state.users.length > 0;
  }

  async createInitialAdmin(username: string, password: string): Promise<AuthUser> {
    const passwordHash = await hashPassword(password);
    return this.store.update((state) => {
      if (state.users.length > 0) {
        throw new Error("初始化已完成。");
      }
      const now = new Date().toISOString();
      const user: UserRecord = {
        id: randomToken(12),
        username,
        role: "owner",
        passwordHash,
        authProvider: "local",
        createdAt: now
      };
      return { data: { ...state, users: [user] }, result: toAuthUser(user) };
    });
  }

  async listUsers(): Promise<AuthUser[]> {
    const state = await this.store.read();
    return state.users.map(toAuthUser);
  }

  async countUsers(): Promise<number> {
    const state = await this.store.read();
    return state.users.length;
  }

  async createUser(input: CreateUser): Promise<AuthUser> {
    const passwordHash = await hashPassword(input.password);
    return this.store.update((state) => {
      if (state.users.some((user) => user.username === input.username)) {
        throw new Error("用户名已存在。");
      }
      const now = new Date().toISOString();
      const user: UserRecord = {
        id: randomToken(12),
        username: input.username,
        role: input.role,
        passwordHash,
        authProvider: "local",
        createdAt: now
      };
      return { data: { ...state, users: [...state.users, user] }, result: toAuthUser(user) };
    });
  }

  async updateUserRole(userId: string, role: Role): Promise<AuthUser> {
    return this.store.update((state) => {
      const user = state.users.find((item) => item.id === userId);
      if (!user) {
        throw new Error("用户不存在。");
      }
      if (user.role === "owner" && role !== "owner" && countOwners(state.users) <= 1) {
        throw new Error("至少保留一个 owner。 ");
      }
      const updated = { ...user, role };
      return {
        data: { ...state, users: state.users.map((item) => item.id === userId ? updated : item) },
        result: toAuthUser(updated)
      };
    });
  }

  async resetPassword(userId: string, password: string): Promise<void> {
    const passwordHash = await hashPassword(password);
    await this.store.update((state) => {
      if (!state.users.some((item) => item.id === userId)) {
        throw new Error("用户不存在。");
      }
      return {
        data: { ...state, users: state.users.map((item) => item.id === userId ? { ...item, passwordHash } : item) },
        result: undefined
      };
    });
  }

  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const state = await this.store.read();
    const user = state.users.find((item) => item.id === userId);
    if (!user) {
      throw new Error("用户不存在。");
    }
    const verified = await verifyPassword(currentPassword, user.passwordHash);
    if (!verified) {
      throw new Error("当前密码不正确。");
    }
    await this.resetPassword(userId, newPassword);
  }

  async deleteUser(userId: string): Promise<void> {
    await this.store.update((state) => {
      const user = state.users.find((item) => item.id === userId);
      if (!user) {
        throw new Error("用户不存在。");
      }
      if (user.role === "owner" && countOwners(state.users) <= 1) {
        throw new Error("至少保留一个 owner。 ");
      }
      return {
        data: {
          ...state,
          users: state.users.filter((item) => item.id !== userId),
          sessions: state.sessions.filter((session) => session.userId !== userId),
          apiTokens: (state.apiTokens ?? []).filter((token) => token.userId !== userId)
        },
        result: undefined
      };
    });
  }

  async verifyLogin(username: string, password: string, totpCode?: string): Promise<LoginVerification> {
    const state = await this.store.read();
    const user = state.users.find((item) => item.username === username);
    if (!user) {
      return null;
    }
    const verified = await verifyPassword(password, user.passwordHash);
    if (!verified) {
      return null;
    }
    if (user.totpEnabled) {
      if (!user.totpSecret || !totpCode || !verifyTotpCode(user.totpSecret, totpCode)) {
        return { status: "totp_required" };
      }
    }
    const updatedUser: UserRecord = { ...user, lastLoginAt: new Date().toISOString() };
    await this.store.write({
      ...state,
      users: state.users.map((item) => item.id === user.id ? updatedUser : item)
    });
    return { status: "ok", user: toAuthUser(updatedUser) };
  }

  async completeOidcLogin(input: OidcCallback): Promise<OidcLoginResult> {
    const state = await this.store.read();
    const provider = state.identityProvider;
    if (!provider?.enabled) {
      throw new Error("OIDC 身份源未启用。");
    }
    const claims = await resolveOidcClaims(input, provider);
    validateOidcClaims(provider, claims);
    const subject = requiredClaim(claims, provider.claimMappings.subject);
    const email = optionalClaim(claims, provider.claimMappings.email);
    const displayName = optionalClaim(claims, provider.claimMappings.name) ?? email ?? subject;
    const profile = { ...(email ? { email } : {}), ...(displayName ? { displayName } : {}) };
    assertAllowedEmailDomain(email, provider.allowedEmailDomains ?? []);

    return this.store.update((current) => {
      const existing = current.users.find((user) => user.authProvider === "oidc" && user.externalSubject === subject)
        ?? current.users.find((user) => email && user.authProvider === "oidc" && user.email?.toLowerCase() === email.toLowerCase());
      if (!existing && provider.autoCreateUsers === false) {
        throw new Error("OIDC 用户自动创建未启用。");
      }
      const now = new Date().toISOString();
      const updated: UserRecord = existing ? {
        ...existing,
        ...profile,
        authProvider: "oidc",
        externalSubject: subject,
        lastLoginAt: now
      } : {
        id: randomToken(12),
        username: uniqueOidcUsername(current.users, email ?? displayName, subject),
        role: provider.defaultRole ?? "viewer",
        passwordHash: "oidc$disabled",
        ...profile,
        authProvider: "oidc",
        externalSubject: subject,
        createdAt: now,
        lastLoginAt: now
      };
      return {
        data: { ...current, users: existing ? current.users.map((user) => user.id === existing.id ? updated : user) : [...current.users, updated] },
        result: { user: toAuthUser(updated), provider: toPublicProvider(provider), created: !existing, subject }
      };
    });
  }

  async createSession(userId: string): Promise<string> {
    const rawSessionId = randomToken(32);
    const sessionId = randomToken(10);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + sessionTtlMs).toISOString();
    await this.store.update((state) => ({
      data: {
        ...state,
        sessions: [
          ...state.sessions.filter((session) => new Date(session.expiresAt).getTime() > Date.now()),
          {
            id: sessionId,
            idHash: sha256(rawSessionId),
            userId,
            createdAt: now.toISOString(),
            expiresAt
          }
        ]
      },
      result: undefined
    }));
    return rawSessionId;
  }

  async getUserBySession(rawSessionId: string): Promise<AuthUser | null> {
    const state = await this.store.read();
    const now = Date.now();
    const session = state.sessions.find((item) => item.idHash === sha256(rawSessionId));
    if (!session || new Date(session.expiresAt).getTime() <= now) {
      return null;
    }
    const user = state.users.find((item) => item.id === session.userId);
    return user ? toAuthUser(user) : null;
  }

  async createApiToken(user: AuthUser, input: CreateApiToken): Promise<CreatedApiToken> {
    const secret = `lxpat_${randomToken(32)}`;
    return this.store.update((state) => {
      const now = new Date();
      const record: ApiTokenRecord = {
        id: randomToken(12),
        name: input.name,
        userId: user.id,
        role: user.role,
        scopes: normalizeScopes(input.scopes),
        tokenHash: sha256(secret),
        createdAt: now.toISOString(),
        ...(input.expiresInDays ? { expiresAt: new Date(now.getTime() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString() } : {})
      };
      return { data: { ...state, apiTokens: [...(state.apiTokens ?? []), record] }, result: { token: toApiToken(record, user), secret } };
    });
  }

  async listApiTokens(userId: string): Promise<ApiToken[]> {
    const state = await this.store.read();
    return (state.apiTokens ?? [])
      .filter((token) => token.userId === userId)
      .map((token) => toApiToken(token, state.users.find((user) => user.id === token.userId)))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async summarizeApiTokenExpiry(): Promise<ApiTokenExpirySummary> {
    const state = await this.store.read();
    const tokens = state.apiTokens ?? [];
    const summary: ApiTokenExpirySummary = {
      total: tokens.length,
      active: 0,
      expiring: 0,
      expired: 0,
      withoutExpiry: 0,
      warningDays: Math.ceil(apiTokenExpiryWarningMs / oneDayMs)
    };
    for (const token of tokens) {
      if (!token.expiresAt) {
        summary.withoutExpiry += 1;
      }
      const status = getApiTokenStatus(token.expiresAt);
      summary[status] += 1;
    }
    return summary;
  }

  async revokeApiToken(userId: string, tokenId: string): Promise<boolean> {
    return this.store.update((state) => {
      const tokens = state.apiTokens ?? [];
      const nextTokens = tokens.filter((token) => !(token.id === tokenId && token.userId === userId));
      return { data: { ...state, apiTokens: nextTokens }, result: nextTokens.length !== tokens.length };
    });
  }

  async getUserByApiToken(secret: string): Promise<AuthUser | null> {
    if (!secret.startsWith("lxpat_")) {
      return null;
    }
    const tokenHash = sha256(secret);
    return this.store.update((state) => {
      const now = Date.now();
      const token = (state.apiTokens ?? []).find((item) => item.tokenHash === tokenHash);
      if (!token || (token.expiresAt && new Date(token.expiresAt).getTime() <= now)) {
        return { data: state, result: null };
      }
      const user = state.users.find((item) => item.id === token.userId);
      if (!user) {
        return { data: state, result: null };
      }
      const usedAt = new Date().toISOString();
      return {
        data: { ...state, apiTokens: (state.apiTokens ?? []).map((item) => item.id === token.id ? { ...item, lastUsedAt: usedAt } : item) },
        result: { ...toAuthUser({ ...user, role: lowerRole(user.role, token.role) }), tokenScopes: normalizeScopes(token.scopes) }
      };
    });
  }

  async deleteSession(rawSessionId: string): Promise<void> {
    const idHash = sha256(rawSessionId);
    await this.store.update((state) => ({
      data: { ...state, sessions: state.sessions.filter((item) => item.idHash !== idHash) },
      result: undefined
    }));
  }

  async listSessions(currentRawSessionId?: string): Promise<AuthSession[]> {
    const state = await this.store.read();
    const currentHash = currentRawSessionId ? sha256(currentRawSessionId) : "";
    return state.sessions
      .filter((session) => new Date(session.expiresAt).getTime() > Date.now())
      .map((session) => {
        const user = state.users.find((item) => item.id === session.userId);
        return {
          id: session.id ?? session.idHash.slice(0, 12),
          userId: session.userId,
          username: user?.username ?? "unknown",
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          ...(session.idHash === currentHash ? { current: true } : {})
        };
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async deleteSessionByPublicId(sessionId: string): Promise<void> {
    await this.store.update((state) => ({
      data: { ...state, sessions: state.sessions.filter((session) => (session.id ?? session.idHash.slice(0, 12)) !== sessionId) },
      result: undefined
    }));
  }

  async beginTotpSetup(userId: string): Promise<TotpSetupResult> {
    const secret = generateTotpSecret();
    return this.store.update((state) => {
      const user = state.users.find((item) => item.id === userId);
      if (!user) {
        throw new Error("用户不存在。");
      }
      const updated = { ...user, totpSecret: secret, totpEnabled: false };
      return {
        data: { ...state, users: state.users.map((item) => item.id === userId ? updated : item) },
        result: { secret, uri: buildTotpUri(secret, user.username) }
      };
    });
  }

  async confirmTotp(userId: string, code: string): Promise<AuthUser> {
    return this.store.update((state) => {
      const user = state.users.find((item) => item.id === userId);
      if (!user?.totpSecret) {
        throw new Error("请先开始 TOTP 设置。");
      }
      if (!verifyTotpCode(user.totpSecret, code)) {
        throw new Error("TOTP 验证码不正确。");
      }
      const updated = { ...user, totpEnabled: true };
      return {
        data: { ...state, users: state.users.map((item) => item.id === userId ? updated : item) },
        result: toAuthUser(updated)
      };
    });
  }

  async disableTotp(userId: string, code: string): Promise<AuthUser> {
    return this.store.update((state) => {
      const user = state.users.find((item) => item.id === userId);
      if (!user) {
        throw new Error("用户不存在。");
      }
      if (user.totpEnabled && (!user.totpSecret || !verifyTotpCode(user.totpSecret, code))) {
        throw new Error("TOTP 验证码不正确。");
      }
      const updated: UserRecord = { ...user, totpEnabled: false };
      delete updated.totpSecret;
      return {
        data: { ...state, users: state.users.map((item) => item.id === userId ? updated : item) },
        result: toAuthUser(updated)
      };
    });
  }
}

function countOwners(users: UserRecord[]): number {
  return users.filter((user) => user.role === "owner").length;
}

function toApiToken(token: ApiTokenRecord, user: Pick<AuthUser, "id" | "username"> | UserRecord | undefined): ApiToken {
  const status = getApiTokenStatus(token.expiresAt);
  const daysUntilExpiry = token.expiresAt ? Math.ceil((new Date(token.expiresAt).getTime() - Date.now()) / oneDayMs) : undefined;
  return {
    id: token.id,
    name: token.name,
    userId: token.userId,
    username: user?.username ?? "unknown",
    role: token.role,
    scopes: normalizeScopes(token.scopes),
    status,
    createdAt: token.createdAt,
    ...(token.expiresAt ? { expiresAt: token.expiresAt } : {}),
    ...(typeof daysUntilExpiry === "number" ? { daysUntilExpiry } : {}),
    ...(token.lastUsedAt ? { lastUsedAt: token.lastUsedAt } : {})
  };
}

function getApiTokenStatus(expiresAt: string | undefined): ApiTokenStatus {
  if (!expiresAt) {
    return "active";
  }
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) {
    return "expired";
  }
  return remainingMs <= apiTokenExpiryWarningMs ? "expiring" : "active";
}

function lowerRole(left: Role, right: Role): Role {
  return roleRank(left) <= roleRank(right) ? left : right;
}

function roleRank(role: Role): number {
  return role === "owner" ? 3 : role === "operator" ? 2 : 1;
}

function normalizeScopes(scopes: ApiTokenScope[] | undefined): ApiTokenScope[] {
  return scopes && scopes.length > 0 ? scopes : [...ApiTokenScopes];
}

function toAuthUser(user: UserRecord): AuthUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,
    ...(user.email ? { email: user.email } : {}),
    ...(user.displayName ? { displayName: user.displayName } : {}),
    authProvider: user.authProvider ?? "local",
    totpEnabled: user.totpEnabled ?? false,
    ...(user.lastLoginAt ? { lastLoginAt: user.lastLoginAt } : {})
  };
}

async function resolveOidcClaims(input: OidcCallback, provider: NonNullable<PanelState["identityProvider"]>): Promise<Record<string, unknown>> {
  if (input.claims) {
    return input.claims;
  }
  if (input.idToken) {
    return decodeJwtPayload(input.idToken);
  }
  if (!provider.tokenEndpoint) {
    throw new Error("OIDC token endpoint 未配置。");
  }
  const body = new URLSearchParams({ grant_type: "authorization_code", code: input.code, redirect_uri: input.redirectUri ?? "/api/auth/oidc/callback", client_id: provider.clientId });
  if (provider.clientSecret) {
    body.set("client_secret", provider.clientSecret);
  }
  const response = await fetch(provider.tokenEndpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body });
  if (!response.ok) {
    throw new Error(`OIDC token 交换失败: ${response.status}`);
  }
  const payload = await response.json() as unknown;
  if (!isRecord(payload) || typeof payload.id_token !== "string") {
    throw new Error("OIDC token 响应缺少 id_token。");
  }
  return decodeJwtPayload(payload.id_token);
}

function validateOidcClaims(provider: NonNullable<PanelState["identityProvider"]>, claims: Record<string, unknown>): void {
  if (optionalClaim(claims, "iss") && optionalClaim(claims, "iss") !== provider.issuerUrl) {
    throw new Error("OIDC issuer 不匹配。");
  }
  const audience = claims.aud;
  if (typeof audience === "string" && audience !== provider.clientId) {
    throw new Error("OIDC audience 不匹配。");
  }
  if (Array.isArray(audience) && !audience.includes(provider.clientId)) {
    throw new Error("OIDC audience 不匹配。");
  }
  if (typeof claims.exp === "number" && claims.exp * 1000 <= Date.now()) {
    throw new Error("OIDC id_token 已过期。");
  }
  requiredClaim(claims, provider.claimMappings.subject);
}

function requiredClaim(claims: Record<string, unknown>, key: string): string {
  const value = optionalClaim(claims, key);
  if (!value) {
    throw new Error(`OIDC claim 缺失: ${key}`);
  }
  return value;
}

function optionalClaim(claims: Record<string, unknown>, key: string): string | undefined {
  const value = claims[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function assertAllowedEmailDomain(email: string | undefined, domains: string[]): void {
  if (domains.length === 0 || !email) {
    return;
  }
  const domain = email.split("@").at(-1)?.toLowerCase() ?? "";
  if (!domains.map((item) => item.toLowerCase()).includes(domain)) {
    throw new Error("OIDC 用户邮箱域名不在允许范围内。");
  }
}

function uniqueOidcUsername(users: UserRecord[], preferred: string, subject: string): string {
  const base = sanitizeUsername(preferred) || `oidc-${sanitizeUsername(subject)}` || "oidc-user";
  let candidate = base;
  let index = 2;
  while (users.some((user) => user.username === candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  return candidate;
}

function sanitizeUsername(value: string): string {
  return value.toLowerCase().replace(/@.+$/u, "").replace(/[^a-z0-9_.-]/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 48);
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2 || !parts[1]) {
    throw new Error("OIDC id_token 格式不正确。");
  }
  const parsed = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("OIDC id_token payload 不正确。");
  }
  return parsed;
}

function toPublicProvider(provider: NonNullable<PanelState["identityProvider"]>): IdentityProvider {
  return {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    issuerUrl: provider.issuerUrl,
    authorizationEndpoint: provider.authorizationEndpoint,
    ...(provider.tokenEndpoint ? { tokenEndpoint: provider.tokenEndpoint } : {}),
    ...(provider.jwksUri ? { jwksUri: provider.jwksUri } : {}),
    clientId: provider.clientId,
    clientSecretConfigured: Boolean(provider.clientSecretConfigured || provider.clientSecret),
    scopes: provider.scopes,
    claimMappings: provider.claimMappings,
    autoCreateUsers: provider.autoCreateUsers ?? true,
    defaultRole: provider.defaultRole ?? "viewer",
    allowedEmailDomains: provider.allowedEmailDomains ?? [],
    requireMfa: provider.requireMfa,
    breakGlassLocalLogin: provider.breakGlassLocalLogin,
    enabled: provider.enabled,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
    updatedBy: provider.updatedBy
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
