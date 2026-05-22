import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const npmCommand = "npm";
const children = [];

function start(name, args) {
  const command = isWindows ? "cmd.exe" : npmCommand;
  const commandArgs = isWindows ? ["/d", "/s", "/c", [npmCommand, ...args].join(" ")] : args;
  const child = spawn(command, commandArgs, {
    stdio: "inherit",
    windowsHide: false
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    stopAll(child);
    if (signal) {
      console.error(`${name} stopped by ${signal}.`);
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
  return child;
}

function stopAll(except) {
  for (const child of children) {
    if (child !== except && !child.killed) {
      child.kill("SIGTERM");
    }
  }
}

let shuttingDown = false;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    stopAll();
  });
}

console.log("Starting LXPanel API at http://127.0.0.1:7080 and Web at http://127.0.0.1:5173");
start("api", ["run", "dev:api"]);
start("web", ["run", "dev:web"]);
