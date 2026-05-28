/**
 * @lxpanel/plugin-sdk — LXPanel 插件开发工具包
 *
 * 提供类型安全的插件 manifest 构建、权限声明和沙箱客户端。
 *
 * 使用示例：
 * ```typescript
 * import { definePlugin } from "@lxpanel/plugin-sdk";
 *
 * export default definePlugin({
 *   id: "my-plugin",
 *   name: "My Plugin",
 *   version: "1.0.0",
 *   entryPoint: "./handlers.js",
 *   permissions: ["platform:read", "hosts:read"],
 *   enabled: false
 * });
 * ```
 */

export { definePlugin } from "./definePlugin.js";
export { createSandboxClient } from "./sandboxClient.js";
export type { PluginDefinition, PluginCapabilities } from "./types.js";
