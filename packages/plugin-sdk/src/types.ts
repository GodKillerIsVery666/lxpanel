import type { ApiTokenScope, PluginManifest } from "@lxpanel/shared";

/** 插件定义（扩展 PluginManifest，添加开发时元数据） */
export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  entryPoint: string;
  permissions: ApiTokenScope[];
  signature?: string;
  source?: string;
  capabilities?: PluginCapabilities;
  enabled: boolean;
}

/** 插件能力声明 */
export interface PluginCapabilities {
  /** 是否需要网络访问（默认 false） */
  network?: boolean;
  /** 是否需要文件系统访问（默认 false） */
  filesystem?: boolean;
  /** 超时毫秒（默认 1000） */
  timeoutMs?: number;
  /** 支持的钩子列表 */
  hooks?: Array<"beforeRequest" | "afterResponse" | "onAlert" | "onAudit">;
}

/** 将插件定义转换为 API 可接受的 manifest */
export function toPluginManifest(def: PluginDefinition): Omit<PluginManifest, "createdAt" | "updatedAt" | "updatedBy"> {
  return {
    id: def.id,
    name: def.name,
    version: def.version,
    description: def.description,
    entryPoint: def.entryPoint,
    permissions: def.permissions,
    signature: def.signature,
    source: def.source,
    enabled: def.enabled
  };
}
