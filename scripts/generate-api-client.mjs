#!/usr/bin/env node
/**
 * 从 OpenAPI JSON 自动生成 TypeScript API 客户端。
 * 输出到 apps/web/src/api/generated.ts。
 *
 * 用法：node scripts/generate-api-client.mjs [--watch]
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const apiUrl = process.env.LXPANEL_API_URL ?? "http://127.0.0.1:7080";
const outputPath = join(root, "apps", "web", "src", "api", "generated.ts");

async function generate(): Promise<void> {
  console.log(`Fetching OpenAPI from ${apiUrl}/api/platform/openapi.json ...`);
  const response = await fetch(`${apiUrl}/api/platform/openapi.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAPI: ${response.status}`);
  }
  const spec = await response.json() as { paths: Record<string, Record<string, unknown>>; components?: { schemas?: Record<string, unknown> } };

  const lines: string[] = [
    "// 自动生成的 API 客户端 — 由 scripts/generate-api-client.mjs 生成",
    "// 请勿手动编辑",
    "// 生成时间: " + new Date().toISOString(),
    "",
    'import { z } from "zod";',
    'import type { ApiClient } from "./client.js";',
    "",
  ];

  // 生成方法定义
  const methodNames: string[] = [];
  for (const [path, methods] of Object.entries(spec.paths ?? {})) {
    for (const [method, _operation] of Object.entries(methods as Record<string, unknown>)) {
      const operationName = path
        .replace(/\/api\//, "")
        .replace(/\/$/u, "")
        .replace(/\{([^}]+)\}/g, (_match, param) => `By${capitalize(param)}`)
        .replace(/[/-]/g, "_")
        .replace(/_{2,}/g, "_")
        .replace(/^_|_$/g, "");
      const fnName = `${method.toLowerCase()}${capitalize(operationName)}`;
      methodNames.push(fnName);
      lines.push(`  ${fnName}(params?: Record<string, unknown>): Promise<unknown>;`);
    }
  }

  const output = [
    "export interface GeneratedClient {",
    ...lines,
    "}",
    "",
    `export const generatedMethods = ${JSON.stringify(methodNames, null, 2)};`,
    "",
  ].join("\n");

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output, "utf8");
  console.log(`Generated ${methodNames.length} API methods -> ${outputPath}`);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

generate().catch((error) => {
  console.error("Generation failed:", error);
  process.exit(1);
});
