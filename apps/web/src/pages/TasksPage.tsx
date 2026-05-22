import { useEffect, useState, type FormEvent } from "react";
import { Clock, PauseCircle, Play, RotateCw, Trash2 } from "lucide-react";
import type { PanelTask, TaskRun } from "@lxpanel/shared";
import { api } from "../api/client.js";
import { StatusPill } from "../components/StatusPill.js";
import { formatDate } from "../utils/format.js";

export function TasksPage(): JSX.Element {
  const [tasks, setTasks] = useState<PanelTask[]>([]);
  const [runs, setRuns] = useState<TaskRun[]>([]);
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [cwd, setCwd] = useState("");
  const [timeoutSeconds, setTimeoutSeconds] = useState(60);
  const [scheduleEveryMinutes, setScheduleEveryMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    try {
      const response = await api.tasks();
      setTasks(response.tasks);
      setRuns(response.runs);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败。");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    try {
      const interval = parsePositiveInt(scheduleEveryMinutes);
      await api.createTask({
        name,
        command,
        args: splitArgs(args),
        cwd: cwd || undefined,
        timeoutSeconds,
        ...(interval ? { scheduleEnabled: true, scheduleEveryMinutes: interval } : {})
      });
      setName("");
      setCommand("");
      setArgs("");
      setScheduleEveryMinutes("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建失败。");
    }
  }

  async function run(taskId: string): Promise<void> {
    try {
      await api.runTask(taskId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "运行失败。");
    }
  }

  async function remove(taskId: string): Promise<void> {
    try {
      await api.deleteTask(taskId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "删除失败。");
    }
  }

  async function toggleSchedule(task: PanelTask): Promise<void> {
    try {
      await api.updateTaskSchedule({ taskId: task.id, enabled: !task.scheduleEnabled, everyMinutes: task.scheduleEveryMinutes ?? 60 });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新计划失败。");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page-stack">
      <div className="page-heading"><div><h1>任务</h1><p>受控命令与维护动作</p></div><button className="icon-button" onClick={() => void load()} title="刷新"><RotateCw size={18} /></button></div>
      <form className="task-form" onSubmit={(event) => void submit(event)}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="任务名" />
        <input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="命令，例如 node.exe" />
        <input value={args} onChange={(event) => setArgs(event.target.value)} placeholder="参数，用空格分隔" />
        <input value={cwd} onChange={(event) => setCwd(event.target.value)} placeholder="工作目录，可选" />
        <input value={timeoutSeconds} onChange={(event) => setTimeoutSeconds(Number.parseInt(event.target.value, 10) || 60)} type="number" min={1} max={600} />
        <input value={scheduleEveryMinutes} onChange={(event) => setScheduleEveryMinutes(event.target.value)} type="number" min={1} max={10080} placeholder="自动间隔(分钟)" />
        <button type="submit">保存任务</button>
      </form>
      {error ? <div className="form-error">{error}</div> : null}
      <section className="table-panel"><div className="panel-title">任务列表</div><table><thead><tr><th>名称</th><th>命令</th><th>计划</th><th>最近状态</th><th>创建者</th><th>操作</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id}><td>{task.name}</td><td><code>{[task.command, ...task.args].join(" ")}</code></td><td>{task.scheduleEnabled ? <span>{task.scheduleEveryMinutes} 分钟 / {task.nextRunAt ? formatDate(task.nextRunAt) : "待计算"}</span> : <span className="muted-text">未启用</span>}</td><td>{task.lastStatus ? <StatusPill status={task.lastStatus} /> : "-"}</td><td>{task.createdBy}</td><td className="row-actions"><button title="运行" onClick={() => void run(task.id)}><Play size={15} /></button><button title={task.scheduleEnabled ? "暂停计划" : "启用计划"} onClick={() => void toggleSchedule(task)}>{task.scheduleEnabled ? <PauseCircle size={15} /> : <Clock size={15} />}</button><button title="删除" onClick={() => void remove(task.id)}><Trash2 size={15} /></button></td></tr>)}</tbody></table></section>
      <section className="table-panel"><div className="panel-title">运行记录</div><table><thead><tr><th>时间</th><th>任务</th><th>状态</th><th>输出</th></tr></thead><tbody>{runs.map((runItem) => <tr key={runItem.id}><td>{formatDate(runItem.finishedAt)}</td><td>{runItem.taskName}</td><td><StatusPill status={runItem.status} /></td><td><pre className="inline-log">{runItem.stdoutTail || runItem.stderrTail || "无输出"}</pre></td></tr>)}</tbody></table></section>
    </main>
  );
}

function splitArgs(value: string): string[] {
  return value.split(" ").map((item) => item.trim()).filter(Boolean);
}

function parsePositiveInt(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
