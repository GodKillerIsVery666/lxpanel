import type { Role } from "@lxpanel/shared";

export interface UserRecord {
  id: string;
  username: string;
  role: Role;
  passwordHash: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface SessionRecord {
  idHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface ConnectorRecord {
  id: string;
  name: string;
  description?: string;
  capabilities: string[];
  tokenHash: string;
  createdAt: string;
  lastSeenAt?: string;
}

export interface PanelState {
  users: UserRecord[];
  sessions: SessionRecord[];
  connectors: ConnectorRecord[];
}

export function createInitialPanelState(): PanelState {
  return {
    users: [],
    sessions: [],
    connectors: []
  };
}
