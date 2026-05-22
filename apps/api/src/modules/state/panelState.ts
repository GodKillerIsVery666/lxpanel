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

export interface TaskRecord {
  id: string;
  name: string;
  command: string;
  args: string[];
  cwd?: string;
  timeoutSeconds: number;
  createdAt: string;
  createdBy: string;
  lastRunAt?: string;
  lastStatus?: "success" | "failed";
}

export interface TaskRunRecord {
  id: string;
  taskId: string;
  taskName: string;
  actor: string;
  startedAt: string;
  finishedAt: string;
  status: "success" | "failed";
  exitCode?: number;
  stdoutTail: string;
  stderrTail: string;
}

export interface BackupRecord {
  id: string;
  fileName: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
  createdBy: string;
  kind: "state";
}

export interface PanelState {
  users: UserRecord[];
  sessions: SessionRecord[];
  connectors: ConnectorRecord[];
  tasks?: TaskRecord[];
  taskRuns?: TaskRunRecord[];
  backups?: BackupRecord[];
}

export function createInitialPanelState(): PanelState {
  return {
    users: [],
    sessions: [],
    connectors: [],
    tasks: [],
    taskRuns: [],
    backups: []
  };
}
