import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import type { CreateTask, PanelTask, TaskRun, UpdateTaskSchedule } from "@lxpanel/shared";
import { randomToken } from "../../lib/crypto.js";
import type { StateStore } from "../../lib/stateStore.js";
import { resolveManagedPath } from "../files/pathGuard.js";
import type { PanelState, TaskRecord, TaskRunRecord } from "../state/panelState.js";

const outputLimit = 12_000;

export class TaskStore {
  constructor(private readonly store: StateStore<PanelState>, private readonly fileRoots: readonly string[]) {}

  async listTasks(): Promise<PanelTask[]> {
    const state = await this.store.read();
    return (state.tasks ?? []).map(toTask);
  }

  async listRuns(): Promise<TaskRun[]> {
    const state = await this.store.read();
    return (state.taskRuns ?? []).slice(-100).reverse().map(toRun);
  }

  async countTasks(): Promise<number> {
    const state = await this.store.read();
    return (state.tasks ?? []).length;
  }

  async createTask(input: CreateTask, actor: string): Promise<PanelTask> {
    await this.validateTask(input);
    return this.store.update((state) => {
      const now = new Date().toISOString();
      const scheduleEveryMinutes = input.scheduleEveryMinutes;
      const scheduleEnabled = input.scheduleEnabled === true;
      const record: TaskRecord = {
        id: randomToken(12),
        name: input.name,
        command: input.command,
        args: input.args,
        ...(input.cwd ? { cwd: resolveManagedPath(input.cwd, this.fileRoots).path } : {}),
        timeoutSeconds: input.timeoutSeconds,
        createdAt: now,
        createdBy: actor,
        ...(scheduleEveryMinutes ? { scheduleEveryMinutes } : {}),
        ...(scheduleEnabled ? { scheduleEnabled, nextRunAt: nextRunAt(new Date(now), scheduleEveryMinutes ?? 60), scheduleUpdatedAt: now, scheduleUpdatedBy: actor } : {})
      };
      return { data: { ...state, tasks: [...(state.tasks ?? []), record] }, result: toTask(record) };
    });
  }

  async updateTaskSchedule(input: UpdateTaskSchedule, actor: string): Promise<PanelTask> {
    return this.store.update((state) => {
      const task = (state.tasks ?? []).find((item) => item.id === input.taskId);
      if (!task) {
        throw new Error("任务不存在。");
      }
      const now = new Date();
      const everyMinutes = input.everyMinutes ?? task.scheduleEveryMinutes;
      if (input.enabled && !everyMinutes) {
        throw new Error("启用计划时必须设置间隔。");
      }
      const updated: TaskRecord = {
        ...task,
        scheduleEnabled: input.enabled,
        ...(everyMinutes ? { scheduleEveryMinutes: everyMinutes } : {}),
        scheduleUpdatedAt: now.toISOString(),
        scheduleUpdatedBy: actor,
        ...(input.enabled && everyMinutes ? { nextRunAt: nextRunAt(now, everyMinutes) } : {})
      };
      if (!input.enabled) {
        delete updated.nextRunAt;
      }
      return {
        data: { ...state, tasks: (state.tasks ?? []).map((item) => item.id === input.taskId ? updated : item) },
        result: toTask(updated)
      };
    });
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.store.update((state) => ({
      data: { ...state, tasks: (state.tasks ?? []).filter((task) => task.id !== taskId) },
      result: undefined
    }));
  }

  async runTask(taskId: string, actor: string): Promise<TaskRun> {
    const state = await this.store.read();
    const task = (state.tasks ?? []).find((item) => item.id === taskId);
    if (!task) {
      throw new Error("任务不存在。");
    }
    const run = await executeTask(task, actor);
    await this.store.update((current) => ({
      data: {
        ...current,
        tasks: (current.tasks ?? []).map((item) => item.id === taskId ? { ...item, lastRunAt: run.finishedAt, lastStatus: run.status } : item),
        taskRuns: [...(current.taskRuns ?? []), run].slice(-200)
      },
      result: undefined
    }));
    return toRun(run);
  }

  async runDueScheduledTasks(now = new Date()): Promise<TaskRun[]> {
    const state = await this.store.read();
    const dueTasks = (state.tasks ?? []).filter((task) => task.scheduleEnabled && task.scheduleEveryMinutes && isDue(task.nextRunAt, now));
    const runs: TaskRun[] = [];
    for (const task of dueTasks) {
      await this.store.update((current) => ({
        data: {
          ...current,
          tasks: (current.tasks ?? []).map((item) => item.id === task.id && item.scheduleEveryMinutes
            ? { ...item, nextRunAt: nextRunAt(now, item.scheduleEveryMinutes) }
            : item)
        },
        result: undefined
      }));
      runs.push(await this.runTask(task.id, "scheduler"));
    }
    return runs;
  }

  private async validateTask(input: CreateTask): Promise<void> {
    if (input.command.includes("..")) {
      throw new Error("命令路径不允许包含上级目录。 ");
    }
    if (input.cwd) {
      const managed = resolveManagedPath(input.cwd, this.fileRoots);
      const info = await stat(managed.path);
      if (!info.isDirectory()) {
        throw new Error("工作目录不是目录。");
      }
    }
  }
}

function executeTask(task: TaskRecord, actor: string): Promise<TaskRunRecord> {
  const startedAt = new Date().toISOString();
  return new Promise((resolve) => {
    execFile(task.command, task.args, {
      cwd: task.cwd,
      timeout: task.timeoutSeconds * 1000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
      encoding: "utf8"
    }, (error, stdout, stderr) => {
      const exitCode = readExitCode(error);
      const status = error ? "failed" : "success";
      resolve({
        id: randomToken(12),
        taskId: task.id,
        taskName: task.name,
        actor,
        startedAt,
        finishedAt: new Date().toISOString(),
        status,
        ...(typeof exitCode === "number" ? { exitCode } : {}),
        stdoutTail: tailOutput(stdout),
        stderrTail: tailOutput(stderr || (error instanceof Error ? error.message : ""))
      });
    });
  });
}

function readExitCode(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "number") {
    return error.code;
  }
  return error ? 1 : 0;
}

function tailOutput(output: string): string {
  return output.length > outputLimit ? output.slice(-outputLimit) : output;
}

function toTask(record: TaskRecord): PanelTask {
  return {
    id: record.id,
    name: record.name,
    command: record.command,
    args: record.args,
    ...(record.cwd ? { cwd: record.cwd } : {}),
    timeoutSeconds: record.timeoutSeconds,
    createdAt: record.createdAt,
    createdBy: record.createdBy,
    ...(record.lastRunAt ? { lastRunAt: record.lastRunAt } : {}),
    ...(record.lastStatus ? { lastStatus: record.lastStatus } : {}),
    ...(record.scheduleEnabled !== undefined ? { scheduleEnabled: record.scheduleEnabled } : {}),
    ...(record.scheduleEveryMinutes ? { scheduleEveryMinutes: record.scheduleEveryMinutes } : {}),
    ...(record.nextRunAt ? { nextRunAt: record.nextRunAt } : {}),
    ...(record.scheduleUpdatedAt ? { scheduleUpdatedAt: record.scheduleUpdatedAt } : {}),
    ...(record.scheduleUpdatedBy ? { scheduleUpdatedBy: record.scheduleUpdatedBy } : {})
  };
}

function toRun(record: TaskRunRecord): TaskRun {
  return { ...record };
}

function isDue(nextRun: string | undefined, now: Date): boolean {
  return Boolean(nextRun && new Date(nextRun).getTime() <= now.getTime());
}

function nextRunAt(from: Date, everyMinutes: number): string {
  return new Date(from.getTime() + everyMinutes * 60_000).toISOString();
}
