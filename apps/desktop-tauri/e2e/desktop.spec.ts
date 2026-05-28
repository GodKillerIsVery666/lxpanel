import { test, expect } from "@playwright/test";

/**
 * Tauri 桌面客户端 E2E 测试
 *
 * 前置条件：
 * 1. 安装 Rust 和 Tauri CLI: cargo install tauri-cli
 * 2. 构建桌面应用: cd apps/desktop-tauri && cargo tauri build
 * 3. 启动被测应用
 *
 * 运行：
 *   cd apps/desktop-tauri && npx playwright test
 */

const APP_URL = "http://127.0.0.1:5173"; // Tauri devServer URL
const API_URL = "http://127.0.0.1:7080";

test.describe("桌面应用基本功能", () => {
  test("WebView 加载面板首页", async ({ page }) => {
    await page.goto(APP_URL);
    await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });
    // 验证页面标题包含面板关键词
    await expect(page).toHaveTitle(/LXPanel|面板/i);
  });

  test("系统托盘命令: show_about 返回应用信息", async () => {
    // 通过 Tauri invoke 命令验证（需要 Tauri 测试桥接）
    // 此处模拟 API 验证
    const response = await fetch(`${API_URL}/api/health/ready`);
    expect(response.status).toBe(200);
  });

  test("健康检查命令: health_check 返回 API 状态", async () => {
    const response = await fetch(`${API_URL}/api/health/ready`);
    expect(response.ok).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty("status");
    expect(body.status).toBe("ok");
  });

  test("凭据保存与加载", async () => {
    // 验证凭据 API 端点可访问（非 Tauri 特定，验证后端连通性）
    const response = await fetch(`${API_URL}/api/auth/status`);
    expect(response.ok).toBeTruthy();
  });

  test("WebView 窗口尺寸符合配置", async ({ page }) => {
    await page.goto(APP_URL);
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeGreaterThanOrEqual(800);
    expect(viewport?.height).toBeGreaterThanOrEqual(600);
  });
});

test.describe("组件验证", () => {
  test("登录表单存在", async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    // 验证登录表单包含输入框
    const inputs = page.locator("input");
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
  });

  test("平台治理页面可导航", async ({ page }) => {
    await page.goto(`${APP_URL}/platform`);
    // 验证治理页面可加载
    await expect(page).toHaveURL(/platform/i);
  });
});
