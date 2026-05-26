import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppDeployment, AppDeploymentAction, CreateAppDeployment } from "@lxpanel/shared";
import { runCommand, type CommandResult } from "../../lib/command.js";
import { randomToken } from "../../lib/crypto.js";
import type { StateStore } from "../../lib/stateStore.js";
import type { AppDeploymentRecord, PanelState } from "../state/panelState.js";
import { findTemplate, publicTemplates } from "./appCatalog.js";

const outputLimit = 12_000;

export type ComposeRunner = (composePath: string, action: AppDeploymentAction["action"]) => Promise<CommandResult>;

const defaultComposeRunner: ComposeRunner = (composePath, action) => {
  const args = action === "up"
    ? ["compose", "-f", composePath, "up", "-d"]
    : ["compose", "-f", composePath, action];
  return runCommand("docker", args, 60_000);
};

export class AppStore {
  constructor(
    private readonly store: StateStore<PanelState>,
    private readonly dataDir: string,
    private readonly composeRunner: ComposeRunner = defaultComposeRunner
  ) {}

  listTemplates() {
    return publicTemplates();
  }

  async listDeployments(): Promise<AppDeployment[]> {
    const state = await this.store.read();
    return (state.appDeployments ?? []).slice().reverse();
  }

  async createDeployment(input: CreateAppDeployment, actor: string): Promise<AppDeployment> {
    const template = findTemplate(input.templateId);
    if (!template) {
      throw new Error("应用模板不存在。");
    }
    const variables = mergeVariables(template.variables, input.variables);
    validateVariables(variables);
    const id = randomToken(12);
    const appDir = join(this.dataDir, "apps", `${sanitizeName(input.name)}-${id}`);
    const composePath = join(appDir, "docker-compose.yml");
    await mkdir(appDir, { recursive: true });
    await writeFile(composePath, template.render(variables), "utf8");
    const now = new Date().toISOString();
    const deployment: AppDeploymentRecord = {
      id,
      name: input.name,
      templateId: template.id,
      templateName: template.name,
      status: "created",
      composePath,
      variables,
      createdAt: now,
      createdBy: actor
    };
    await this.store.update((state) => ({
      data: { ...state, appDeployments: [...(state.appDeployments ?? []), deployment] },
      result: undefined
    }));
    if (input.autoStart) {
      return this.runAction({ deploymentId: id, action: "up" }, actor);
    }
    return deployment;
  }

  async runAction(input: AppDeploymentAction, actor: string): Promise<AppDeployment> {
    const deployment = await this.findDeployment(input.deploymentId);
    let status: AppDeployment["status"] = input.action === "down" ? "stopped" : "running";
    let outputTail = "";
    try {
      const result = await this.composeRunner(deployment.composePath, input.action);
      outputTail = tailOutput(`${result.stdout}\n${result.stderr}`.trim());
    } catch (error) {
      status = "failed";
      outputTail = tailOutput(error instanceof Error ? error.message : String(error));
    }
    return this.store.update((state) => {
      const updated = (state.appDeployments ?? []).map((item) => item.id === deployment.id
        ? { ...item, status, lastActionAt: new Date().toISOString(), lastActionBy: actor, ...(outputTail ? { lastOutputTail: outputTail } : {}) }
        : item);
      const result = updated.find((item) => item.id === deployment.id);
      if (!result) {
        throw new Error("应用部署不存在。");
      }
      return { data: { ...state, appDeployments: updated }, result };
    });
  }

  private async findDeployment(deploymentId: string): Promise<AppDeployment> {
    const state = await this.store.read();
    const deployment = (state.appDeployments ?? []).find((item) => item.id === deploymentId);
    if (!deployment) {
      throw new Error("应用部署不存在。");
    }
    return deployment;
  }
}

function mergeVariables(variables: Array<{ key: string; defaultValue: string; required: boolean }>, input: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const variable of variables) {
    const value = input[variable.key] ?? variable.defaultValue;
    if (variable.required && !value) {
      throw new Error(`缺少应用变量: ${variable.key}`);
    }
    result[variable.key] = value;
  }
  return result;
}

function validateVariables(variables: Record<string, string>): void {
  for (const [key, value] of Object.entries(variables)) {
    if (/[^A-Z0-9_]/u.test(key) || /[\r\n\0]/u.test(value)) {
      throw new Error("应用变量不合法。");
    }
  }
}

function sanitizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_.-]/gu, "-").slice(0, 48) || "app";
}

function tailOutput(value: string): string {
  return value.length > outputLimit ? value.slice(-outputLimit) : value;
}
