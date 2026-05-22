import os from "node:os";
import type { ProcessInfo, ServiceInfo, SystemOverview } from "@lxpanel/shared";
import { runCommand } from "../../lib/command.js";

export function getSystemOverview(): SystemOverview {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const cpus = os.cpus();
  const loadAverage = normalizeLoad(os.loadavg());
  const networkInterfaces = Object.entries(os.networkInterfaces()).flatMap(([name, values]) => (
    values ?? []
  ).map((value) => ({
    name,
    address: value.address,
    family: value.family,
    internal: value.internal
  })));

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    uptimeSeconds: os.uptime(),
    loadAverage,
    cpu: {
      model: cpus[0]?.model ?? "unknown",
      cores: cpus.length,
      usagePercent: Math.min(100, Math.round((loadAverage[0] / Math.max(1, cpus.length)) * 100))
    },
    memory: {
      totalBytes,
      freeBytes,
      usedPercent: Math.round(((totalBytes - freeBytes) / Math.max(1, totalBytes)) * 100)
    },
    networkInterfaces
  };
}

export async function listProcesses(): Promise<ProcessInfo[]> {
  if (process.platform === "win32") {
    return listWindowsProcesses();
  }
  const { stdout } = await runCommand("ps", ["-eo", "pid,comm,%cpu,%mem,rss", "--sort=-%cpu"], 5_000);
  return stdout.split("\n").slice(1, 81).map(parseUnixProcess).filter((item): item is ProcessInfo => Boolean(item));
}

export async function listServices(): Promise<ServiceInfo[]> {
  if (process.platform === "win32") {
    return listWindowsServices();
  }
  const { stdout } = await runCommand("systemctl", ["list-units", "--type=service", "--all", "--no-legend", "--no-pager"], 5_000);
  return stdout.split("\n").slice(0, 120).map(parseSystemdService).filter((item): item is ServiceInfo => Boolean(item));
}

export async function runServiceAction(name: string, action: "start" | "stop" | "restart"): Promise<void> {
  if (!/^[A-Za-z0-9_.@:-]+\.service$/u.test(name)) {
    throw new Error("服务名称不合法。");
  }
  if (process.platform === "win32") {
    throw new Error("当前首版仅支持在 Linux systemd 上控制服务。");
  }
  await runCommand("systemctl", [action, name], 15_000);
}

function normalizeLoad(value: number[]): [number, number, number] {
  return [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0];
}

function parseUnixProcess(line: string): ProcessInfo | null {
  const parts = line.trim().split(/\s+/u);
  if (parts.length < 5) {
    return null;
  }
  const pid = Number.parseInt(parts[0] ?? "", 10);
  const rssKb = Number.parseFloat(parts[4] ?? "0");
  return {
    pid,
    name: parts[1] ?? "unknown",
    cpuPercent: Number.parseFloat(parts[2] ?? "0"),
    memoryPercent: Number.parseFloat(parts[3] ?? "0"),
    memoryMb: Math.round((rssKb / 1024) * 10) / 10
  };
}

function parseSystemdService(line: string): ServiceInfo | null {
  const parts = line.trim().split(/\s+/u);
  if (parts.length < 4) {
    return null;
  }
  return {
    name: parts[0] ?? "unknown.service",
    state: parts[3] ?? "unknown",
    description: parts.slice(4).join(" ") || undefined
  };
}

async function listWindowsProcesses(): Promise<ProcessInfo[]> {
  const script = "Get-Process | Sort-Object CPU -Descending | Select-Object -First 80 Id,ProcessName,CPU,WorkingSet64 | ConvertTo-Json -Compress";
  const { stdout } = await runCommand("powershell.exe", ["-NoProfile", "-Command", script], 8_000);
  const parsed = JSON.parse(stdout || "[]") as Array<{ Id: number; ProcessName: string; CPU?: number; WorkingSet64?: number }>;
  return parsed.map((item) => ({
    pid: item.Id,
    name: item.ProcessName,
    cpuPercent: Math.round((item.CPU ?? 0) * 10) / 10,
    memoryMb: Math.round(((item.WorkingSet64 ?? 0) / 1024 / 1024) * 10) / 10
  }));
}

async function listWindowsServices(): Promise<ServiceInfo[]> {
  const script = "Get-Service | Select-Object -First 120 Name,Status,DisplayName | ConvertTo-Json -Compress";
  const { stdout } = await runCommand("powershell.exe", ["-NoProfile", "-Command", script], 8_000);
  const parsed = JSON.parse(stdout || "[]") as Array<{ Name: string; Status: string; DisplayName?: string }>;
  return parsed.map((item) => ({
    name: item.Name,
    state: item.Status,
    description: item.DisplayName
  }));
}
