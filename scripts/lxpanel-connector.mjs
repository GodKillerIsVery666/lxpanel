#!/usr/bin/env node
import { execFile } from "node:child_process";
import { hostname } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const panelUrl = readRequiredEnv("LXPANEL_URL").replace(/\/$/u, "");
const token = readRequiredEnv("LXPANEL_CONNECTOR_TOKEN");
const connectorName = process.env.LXPANEL_CONNECTOR_NAME ?? hostname();
const pollIntervalMs = parsePositiveInt(process.env.LXPANEL_CONNECTOR_POLL_MS ?? "5000");
const commandTimeoutMs = parsePositiveInt(process.env.LXPANEL_CONNECTOR_COMMAND_TIMEOUT_MS ?? "60000");
const allowedCommands = parseList(process.env.LXPANEL_CONNECTOR_ALLOW_COMMANDS ?? "hostname,uptime,whoami");

console.log(`[lxpanel-connector] start name=${connectorName} url=${panelUrl} allowed=${allowedCommands.join(",") || "none"}`);

while (true) {
  try {
    await heartbeat();
    const commands = await pollCommands();
    for (const command of commands) {
      await runAndReport(command);
    }
  } catch (error) {
    console.error("[lxpanel-connector] loop failed", error instanceof Error ? error.message : String(error));
  }
  await delay(pollIntervalMs);
}

async function heartbeat() {
  await request("/api/connectors/heartbeat", {
    method: "POST",
    body: { capabilities: ["metrics", "command-runner", "ssh-client-offload"], version: "node-agent-0.1" }
  });
}

async function pollCommands() {
  const response = await request("/api/connectors/commands/poll", { method: "GET" });
  return Array.isArray(response.commands) ? response.commands : [];
}

async function runAndReport(command) {
  const startedAt = Date.now();
  if (!allowedCommands.includes(command.command)) {
    await report(command.id, {
      status: "failed",
      exitCode: 126,
      stdoutTail: "",
      stderrTail: `command not allowed: ${command.command}`
    });
    return;
  }
  try {
    const result = await execFileAsync(command.command, command.args ?? [], {
      timeout: commandTimeoutMs,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });
    await report(command.id, {
      status: "success",
      exitCode: 0,
      stdoutTail: tail(result.stdout),
      stderrTail: tail(result.stderr)
    });
  } catch (error) {
    const exitCode = typeof error?.code === "number" ? error.code : 1;
    const stdout = typeof error?.stdout === "string" ? error.stdout : "";
    const stderr = typeof error?.stderr === "string" ? error.stderr : error instanceof Error ? error.message : String(error);
    await report(command.id, {
      status: "failed",
      exitCode,
      stdoutTail: tail(stdout),
      stderrTail: tail(`${stderr}\nfinished in ${Date.now() - startedAt}ms`)
    });
  }
}

async function report(commandId, result) {
  await request("/api/connectors/commands/result", {
    method: "POST",
    body: { commandId, ...result }
  });
}

async function request(path, options) {
  const response = await fetch(`${panelUrl}${path}`, {
    method: options.method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });
  if (!response.ok) {
    throw new Error(`${options.method} ${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[lxpanel-connector] missing ${name}`);
    process.exit(1);
  }
  return value;
}

function parseList(value) {
  return value.split(/[;,]/u).map((item) => item.trim()).filter(Boolean);
}

function parsePositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`invalid positive integer: ${value}`);
  }
  return parsed;
}

function tail(value, maxLength = 16_000) {
  return value.length > maxLength ? value.slice(-maxLength) : value;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
