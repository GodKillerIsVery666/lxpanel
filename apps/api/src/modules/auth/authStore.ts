import type { AuthUser } from "@lxpanel/shared";
import { hashPassword, randomToken, sha256, verifyPassword } from "../../lib/crypto.js";
import type { JsonStore } from "../../lib/jsonStore.js";
import type { PanelState, UserRecord } from "../state/panelState.js";

const sessionTtlMs = 1000 * 60 * 60 * 12;

export class AuthStore {
  constructor(private readonly store: JsonStore<PanelState>) {}

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
        createdAt: now
      };
      return { data: { ...state, users: [user] }, result: toAuthUser(user) };
    });
  }

  async verifyLogin(username: string, password: string): Promise<AuthUser | null> {
    const state = await this.store.read();
    const user = state.users.find((item) => item.username === username);
    if (!user) {
      return null;
    }
    const verified = await verifyPassword(password, user.passwordHash);
    if (!verified) {
      return null;
    }
    const updatedUser: UserRecord = { ...user, lastLoginAt: new Date().toISOString() };
    await this.store.write({
      ...state,
      users: state.users.map((item) => item.id === user.id ? updatedUser : item)
    });
    return toAuthUser(updatedUser);
  }

  async createSession(userId: string): Promise<string> {
    const rawSessionId = randomToken(32);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + sessionTtlMs).toISOString();
    await this.store.update((state) => ({
      data: {
        ...state,
        sessions: [
          ...state.sessions.filter((session) => new Date(session.expiresAt).getTime() > Date.now()),
          {
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

  async deleteSession(rawSessionId: string): Promise<void> {
    const idHash = sha256(rawSessionId);
    await this.store.update((state) => ({
      data: { ...state, sessions: state.sessions.filter((item) => item.idHash !== idHash) },
      result: undefined
    }));
  }
}

function toAuthUser(user: UserRecord): AuthUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,
    ...(user.lastLoginAt ? { lastLoginAt: user.lastLoginAt } : {})
  };
}
