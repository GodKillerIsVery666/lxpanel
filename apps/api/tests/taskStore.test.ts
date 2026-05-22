import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JsonStore } from "../src/lib/jsonStore.js";
import { createInitialPanelState, type PanelState } from "../src/modules/state/panelState.js";
import { TaskStore } from "../src/modules/tasks/taskStore.js";

describe("任务运行器", () => {
  it("创建并运行受控任务", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-task-"));
    const taskStore = new TaskStore(new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState), [root]);
    const task = await taskStore.createTask({ name: "node-version", command: process.execPath, args: ["-e", "console.log('ok')"], cwd: root, timeoutSeconds: 10 }, "admin");

    const run = await taskStore.runTask(task.id, "admin");

    expect(run.status).toBe("success");
    expect(run.stdoutTail.trim()).toBe("ok");
    await expect(taskStore.listRuns()).resolves.toHaveLength(1);
  });

  it("拒绝根目录外工作目录", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-task-root-"));
    const outside = await mkdtemp(join(tmpdir(), "lxpanel-task-outside-"));
    const taskStore = new TaskStore(new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState), [root]);

    await expect(taskStore.createTask({ name: "bad", command: process.execPath, args: [], cwd: outside, timeoutSeconds: 10 }, "admin")).rejects.toThrow("路径不在允许的管理目录内");
  });

  it("运行到期的计划任务并推进下次运行时间", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-task-schedule-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const taskStore = new TaskStore(store, [root]);
    const task = await taskStore.createTask({ name: "scheduled", command: process.execPath, args: ["-e", "console.log('scheduled')"], cwd: root, timeoutSeconds: 10, scheduleEnabled: true, scheduleEveryMinutes: 5 }, "admin");
    const now = new Date("2026-05-22T09:00:00.000Z");
    await store.update((state) => ({
      data: { ...state, tasks: (state.tasks ?? []).map((item) => item.id === task.id ? { ...item, nextRunAt: "2026-05-22T08:59:00.000Z" } : item) },
      result: undefined
    }));

    const runs = await taskStore.runDueScheduledTasks(now);
    const updated = (await taskStore.listTasks()).find((item) => item.id === task.id);

    expect(runs).toHaveLength(1);
    expect(runs[0]?.stdoutTail.trim()).toBe("scheduled");
    expect(updated?.nextRunAt).toBe("2026-05-22T09:05:00.000Z");
  });
});
