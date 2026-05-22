import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { StateStore } from "./stateStore.js";

export class JsonStore<TData extends object> implements StateStore<TData> {
  constructor(
    private readonly filePath: string,
    private readonly createInitial: () => TData
  ) {}

  async read(): Promise<TData> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw) as TData;
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return this.cloneInitial();
      }
      console.error("[json-store] 读取状态失败", error);
      throw error;
    }
  }

  async write(data: TData): Promise<void> {
    try {
      await mkdir(dirname(this.filePath), { recursive: true });
      const tempPath = `${this.filePath}.${process.pid}.tmp`;
      await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
      await rename(tempPath, this.filePath);
    } catch (error) {
      console.error("[json-store] 写入状态失败", error);
      throw error;
    }
  }

  async update<TResult>(mutator: (data: TData) => Promise<{ data: TData; result: TResult }> | { data: TData; result: TResult }): Promise<TResult> {
    const current = await this.read();
    const next = await mutator(current);
    await this.write(next.data);
    return next.result;
  }

  private cloneInitial(): TData {
    return JSON.parse(JSON.stringify(this.createInitial())) as TData;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
