import type { PluginDefinition } from "./types.js";

/**
 * 定义插件 manifest 的辅助函数。
 * 提供类型推断和默认值。
 */
export function definePlugin(def: PluginDefinition): PluginDefinition {
  return {
    capabilities: { network: false, filesystem: false, timeoutMs: 1000, hooks: [] },
    ...def,
    capabilities: {
      network: false,
      filesystem: false,
      timeoutMs: 1000,
      hooks: [],
      ...def.capabilities
    }
  };
}
