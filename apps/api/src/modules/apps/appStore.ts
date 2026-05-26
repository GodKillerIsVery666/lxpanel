import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppDeployment, AppDeploymentAction, CreateAppDeployment, RollbackAppDeployment, UpdateAppDeployment } from "@lxpanel/shared";
import { runCommand, type CommandResult } from "../../lib/command.js";
import { randomToken } from "../../lib/crypto.js";
import type { StateStore } from "../../lib/stateStore.js";
import type { AppDeploymentRecord, AppDeploymentRevisionRecord, PanelState } from "../state/panelState.js";
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
    return (state.appDeployments ?? []).slice().reverse().map(toPublicDeployment);
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
      version: 1,
      revisionCount: 0,
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
      return { data: { ...state, appDeployments: updated }, result: toPublicDeployment(result) };
    });
  }

  async updateDeployment(input: UpdateAppDeployment, actor: string): Promise<AppDeployment> {
    const state = await this.store.read();
    const deployment = (state.appDeployments ?? []).find((item) => item.id === input.deploymentId);
    if (!deployment) {
      throw new Error("应用部署不存在。");
    }
    const template = findTemplate(deployment.templateId);
    if (!template) {
      throw new Error("应用模板不存在。");
    }
    const variables = mergeVariables(template.variables, { ...deployment.variables, ...input.variables });
    validateVariables(variables);
    const currentVersion = deployment.version ?? 1;
    const revision = await this.saveRevision(deployment, actor);
    await writeFile(deployment.composePath, template.render(variables), "utf8");
    const updated = await this.store.update((current) => {
      const next = (current.appDeployments ?? []).map((item) => item.id === deployment.id
        ? {
          ...item,
          variables,
          version: currentVersion + 1,
          revisionCount: (item.revisions ?? []).length + 1,
          revisions: [...(item.revisions ?? []), revision].slice(-20),
          status: "created" as const,
          lastActionAt: new Date().toISOString(),
          lastActionBy: actor,
          lastOutputTail: `已渲染版本 v${currentVersion + 1}`
        }
        : item);
      const result = next.find((item) => item.id === deployment.id);
      if (!result) {
        throw new Error("应用部署不存在。");
      }
      return { data: { ...current, appDeployments: next }, result: toPublicDeployment(result) };
    });
    return input.autoRestart ? this.runAction({ deploymentId: updated.id, action: "restart" }, actor) : updated;
  }

  async rollbackDeployment(input: RollbackAppDeployment, actor: string): Promise<AppDeployment> {
    const state = await this.store.read();
    const deployment = (state.appDeployments ?? []).find((item) => item.id === input.deploymentId);
    const revision = deployment?.revisions?.at(-1);
    if (!deployment || !revision) {
      throw new Error("没有可回滚的应用修订。 ");
    }
    const compose = await readFile(revision.composePath, "utf8");
    await writeFile(deployment.composePath, compose, "utf8");
    const updated = await this.store.update((current) => {
      const next = (current.appDeployments ?? []).map((item) => {
        if (item.id !== deployment.id) {
          return item;
        }
        const revisions = (item.revisions ?? []).slice(0, -1);
        return {
          ...item,
          version: revision.version,
          revisionCount: revisions.length,
          revisions,
          variables: revision.variables,
          status: "created" as const,
          lastActionAt: new Date().toISOString(),
          lastActionBy: actor,
          lastOutputTail: `已回滚到 v${revision.version}`
        };
      });
      const result = next.find((item) => item.id === deployment.id);
      if (!result) {
        throw new Error("应用部署不存在。");
      }
      return { data: { ...current, appDeployments: next }, result: toPublicDeployment(result) };
    });
    return input.autoRestart ? this.runAction({ deploymentId: updated.id, action: "restart" }, actor) : updated;
  }

  private async findDeployment(deploymentId: string): Promise<AppDeploymentRecord> {
    const state = await this.store.read();
    const deployment = (state.appDeployments ?? []).find((item) => item.id === deploymentId);
    if (!deployment) {
      throw new Error("应用部署不存在。");
    }
    return deployment;
  }

  private async saveRevision(deployment: AppDeploymentRecord, actor: string): Promise<AppDeploymentRevisionRecord> {
    const version = deployment.version ?? 1;
    const revisionPath = deployment.composePath.replace(/docker-compose\.yml$/u, `docker-compose.v${version}.yml`);
    const compose = await readFile(deployment.composePath, "utf8");
    await writeFile(revisionPath, compose, "utf8");
    return { version, composePath: revisionPath, variables: deployment.variables, createdAt: new Date().toISOString(), createdBy: actor };
  }
}

function toPublicDeployment(deployment: AppDeploymentRecord): AppDeployment {
  return {
    id: deployment.id,
    name: deployment.name,
    templateId: deployment.templateId,
    templateName: deployment.templateName,
    status: deployment.status,
    version: deployment.version ?? 1,
    revisionCount: deployment.revisions?.length ?? deployment.revisionCount ?? 0,
    composePath: deployment.composePath,
    variables: deployment.variables,
    createdAt: deployment.createdAt,
    createdBy: deployment.createdBy,
    ...(deployment.lastActionAt ? { lastActionAt: deployment.lastActionAt } : {}),
    ...(deployment.lastActionBy ? { lastActionBy: deployment.lastActionBy } : {}),
    ...(deployment.lastOutputTail ? { lastOutputTail: deployment.lastOutputTail } : {})
  };
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
