import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export async function runCommand(file: string, args: readonly string[], timeoutMs = 5_000): Promise<CommandResult> {
  try {
    return await execFileAsync(file, [...args], {
      encoding: "utf8",
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });
  } catch (error) {
    console.error("[command] 外部命令执行失败", { file, args, error });
    throw error;
  }
}
