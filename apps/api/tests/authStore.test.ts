import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JsonStore } from "../src/lib/jsonStore.js";
import { AuthStore } from "../src/modules/auth/authStore.js";
import { createInitialPanelState, type PanelState } from "../src/modules/state/panelState.js";

describe("用户与角色", () => {
  it("创建用户、改角色并拒绝移除最后 owner", async () => {
    const authStore = await createAuthStore();
    const owner = await authStore.createInitialAdmin("admin", "Admin-Password-2026");
    const operator = await authStore.createUser({ username: "ops", password: "Operator-Password-2026", role: "operator" });

    await expect(authStore.verifyLogin("ops", "Operator-Password-2026")).resolves.toMatchObject({ username: "ops" });
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
});

async function createAuthStore(): Promise<AuthStore> {
  const root = await mkdtemp(join(tmpdir(), "lxpanel-auth-"));
  return new AuthStore(new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState));
}
