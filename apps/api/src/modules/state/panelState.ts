import type { Role } from "@lxpanel/shared";

export interface UserRecord {
  id: string;
  username: string;
  role: Role;
  passwordHash: string;
  totpSecret?: string;
  totpEnabled?: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface SessionRecord {
  id?: string;
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
  scheduleEnabled?: boolean;
  scheduleEveryMinutes?: number;
  nextRunAt?: string;
  scheduleUpdatedAt?: string;
  scheduleUpdatedBy?: string;
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
  sha256?: string;
}

export interface BackupScheduleRecord {
  enabled: boolean;
  everyHours: number;
  nextRunAt?: string;
  lastRunAt?: string;
  lastStatus?: "success" | "failed";
  updatedAt?: string;
  updatedBy?: string;
}

export interface PanelState {
  users: UserRecord[];
  sessions: SessionRecord[];
  connectors: ConnectorRecord[];
  tasks?: TaskRecord[];
  taskRuns?: TaskRunRecord[];
  backups?: BackupRecord[];
  backupSchedule?: BackupScheduleRecord;
}

export function createInitialPanelState(): PanelState {
  return {
    users: [],
    sessions: [],
    connectors: [],
    tasks: [],
    taskRuns: [],
    backups: [],
    backupSchedule: { enabled: false, everyHours: 24 }
  };
}
