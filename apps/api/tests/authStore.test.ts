import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JsonStore } from "../src/lib/jsonStore.js";
import { generateTotpCodeForTest } from "../src/lib/totp.js";
import { AuthStore } from "../src/modules/auth/authStore.js";
import { createInitialPanelState, type PanelState } from "../src/modules/state/panelState.js";

describe("用户与角色", () => {
  it("创建用户、改角色并拒绝移除最后 owner", async () => {
    const authStore = await createAuthStore();
    const owner = await authStore.createInitialAdmin("admin", "Admin-Password-2026");
    const operator = await authStore.createUser({ username: "ops", password: "Operator-Password-2026", role: "operator" });

    await expect(authStore.verifyLogin("ops", "Operator-Password-2026")).resolves.toMatchObject({ status: "ok", user: { username: "ops" } });
    await expect(authStore.updateUserRole(operator.id, "viewer")).resolves.toMatchObject({ role: "viewer" });
    await expect(authStore.updateUserRole(owner.id, "operator")).rejects.toThrow("至少保留一个 owner");
  });

  it("删除用户会清理其会话", async () => {
    const authStore = await createAuthStore();
    await authStore.createInitialAdmin("admin", "Admin-Password-2026");
    const user = await authStore.createUser({ username: "viewer", password: "Viewer-Password-2026", role: "viewer" });
    const session = await authStore.createSession(user.id);

    await authStore.deleteUser(user.id);

    await expect(authStore.getUserBySession(session)).resolves.toBeNull();
  });

  it("启用 TOTP 后登录需要验证码，并可列出会话", async () => {
    const authStore = await createAuthStore();
    const owner = await authStore.createInitialAdmin("admin", "Admin-Password-2026");
    const setup = await authStore.beginTotpSetup(owner.id);
    const code = generateTotpCodeForTest(setup.secret);

    await expect(authStore.confirmTotp(owner.id, code)).resolves.toMatchObject({ totpEnabled: true });
    await expect(authStore.verifyLogin("admin", "Admin-Password-2026")).resolves.toEqual({ status: "totp_required" });
    await expect(authStore.verifyLogin("admin", "Admin-Password-2026", code)).resolves.toMatchObject({ status: "ok" });

    const session = await authStore.createSession(owner.id);
    const sessions = await authStore.listSessions(session);
    expect(sessions[0]).toMatchObject({ username: "admin", current: true });
  });

  it("API Token 只返回一次明文并可撤销", async () => {
    const authStore = await createAuthStore();
    const owner = await authStore.createInitialAdmin("admin", "Admin-Password-2026");

    const created = await authStore.createApiToken(owner, { name: "ci", expiresInDays: 7 });

    expect(created.secret).toMatch(/^lxpat_/u);
    expect(created.token).toMatchObject({ name: "ci", username: "admin", role: "owner" });
    expect(created.token.scopes).toContain("system:read");
    await expect(authStore.getUserByApiToken(created.secret)).resolves.toMatchObject({ username: "admin" });

    const tokens = await authStore.listApiTokens(owner.id);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.name).toBe("ci");
    expect(tokens[0]?.scopes).toContain("system:read");
    expect(typeof tokens[0]?.lastUsedAt).toBe("string");
    expect(JSON.stringify(tokens)).not.toContain(created.secret);

    await expect(authStore.revokeApiToken(owner.id, created.token.id)).resolves.toBe(true);
    await expect(authStore.getUserByApiToken(created.secret)).resolves.toBeNull();
  });
});

async function createAuthStore(): Promise<AuthStore> {
  const root = await mkdtemp(join(tmpdir(), "lxpanel-auth-"));
  return new AuthStore(new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState));
}
