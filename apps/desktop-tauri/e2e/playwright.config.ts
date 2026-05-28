import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1280, height: 800 },
    actionTimeout: 10000,
    headless: true
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" }
    }
  ],
  webServer: [
    {
      command: "npm run dev -w @lxpanel/api",
      port: 7080,
      reuseExistingServer: true,
      timeout: 30000
    },
    {
      command: "npm run dev -w @lxpanel/web",
      port: 5173,
      reuseExistingServer: true,
      timeout: 30000
    }
  ]
});
