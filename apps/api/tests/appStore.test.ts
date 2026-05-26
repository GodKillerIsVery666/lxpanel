import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JsonStore } from "../src/lib/jsonStore.js";
import { AppStore, type ComposeRunner } from "../src/modules/apps/appStore.js";
import { createInitialPanelState, type PanelState } from "../src/modules/state/panelState.js";

describe("应用商店", () => {
  it("根据模板创建 Docker Compose 部署记录", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-apps-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const appStore = new AppStore(store, root);

    const deployment = await appStore.createDeployment({ templateId: "redis", name: "redis-prod", variables: { REDIS_PORT: "6380", REDIS_PASSWORD: "secret" }, autoStart: false }, "admin");
    const compose = await readFile(deployment.composePath, "utf8");
    const deployments = await appStore.listDeployments();

    expect(deployment.status).toBe("created");
    expect(deployment.version).toBe(1);
    expect(compose).toContain("redis:7-alpine");
    expect(compose).toContain("6380:6379");
    expect(deployments[0]?.name).toBe("redis-prod");
  });

  it("运行 compose 动作并更新部署状态", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-apps-action-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const runner: ComposeRunner = (_composePath, action) => Promise.resolve({ stdout: `ok ${action}`, stderr: "" });
    const appStore = new AppStore(store, root, runner);
    const deployment = await appStore.createDeployment({ templateId: "nginx-static", name: "web-prod", variables: { HTTP_PORT: "8088" }, autoStart: false }, "admin");

    const running = await appStore.runAction({ deploymentId: deployment.id, action: "up" }, "admin");
    const stopped = await appStore.runAction({ deploymentId: deployment.id, action: "down" }, "admin");

    expect(running.status).toBe("running");
    expect(stopped.status).toBe("stopped");
    expect(stopped.lastOutputTail).toContain("ok down");
  });

  it("返回模板签名元数据并检查部署健康状态", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-apps-health-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const appStore = new AppStore(store, root);
    const template = appStore.listTemplates()[0];
    const deployment = await appStore.createDeployment({ templateId: "nginx-static", name: "web-health", variables: { HTTP_PORT: "8090" }, autoStart: false }, "admin");

    const health = await appStore.checkHealth(deployment.id);

    expect(template?.signature).toBeTruthy();
    expect(template?.verified).toBe(true);
    expect(health.status).toBe("unknown");
  });

  it("支持重渲染升级并回滚到上一版本", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpanel-apps-upgrade-"));
    const store = new JsonStore<PanelState>(join(root, "state.json"), createInitialPanelState);
    const appStore = new AppStore(store, root);
    const deployment = await appStore.createDeployment({ templateId: "nginx-static", name: "web-upgrade", variables: { HTTP_PORT: "8080" }, autoStart: false }, "admin");

    const upgraded = await appStore.updateDeployment({ deploymentId: deployment.id, variables: { HTTP_PORT: "8081" }, autoRestart: false }, "admin");
    const upgradedCompose = await readFile(upgraded.composePath, "utf8");
    const rolledBack = await appStore.rollbackDeployment({ deploymentId: deployment.id, autoRestart: false }, "admin");
    const rollbackCompose = await readFile(rolledBack.composePath, "utf8");

    expect(upgraded.version).toBe(2);
    expect(upgraded.revisionCount).toBe(1);
    expect(upgradedCompose).toContain("8081:80");
    expect(rolledBack.version).toBe(1);
    expect(rolledBack.revisionCount).toBe(0);
    expect(rollbackCompose).toContain("8080:80");
  });
});
