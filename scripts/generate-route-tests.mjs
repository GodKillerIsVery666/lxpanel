#!/usr/bin/env node
/**
 * 路由测试生成器 — 从 OpenAPI JSON 自动生成集成测试骨架。
 *
 * 用法: node scripts/generate-route-tests.mjs
 * 输出: apps/api/tests/generated-routes.test.ts
 */
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const apiUrl = process.env.LXPANEL_API_URL ?? "http://127.0.0.1:7080";
const outputPath = join(root, "apps", "api", "tests", "generated-routes.test.ts");

async function generate() {
  console.log(`Fetching OpenAPI from ${apiUrl}/api/platform/openapi.json ...`);
  const response = await fetch(`${apiUrl}/api/platform/openapi.json`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const spec = await response.json() as { paths: Record<string, Record<string, unknown>> };

  const lines: string[] = [
    "// 自动生成的集成测试 — 由 scripts/generate-route-tests.mjs 生成",
    'import { describe, it, expect, beforeAll, afterAll } from "vitest";',
    'import { buildApp, createServices } from "../src/server.js";',
    'import { loadConfig } from "../src/config/env.js";',
    "import type { FastifyInstance } from \"fastify\";",
    "",
    "let app: FastifyInstance;",
    "",
    'beforeAll(async () => {',
    '  const config = loadConfig({ ...process.env, LXPANEL_PORT: "0", LXPANEL_LOG_LEVEL: "silent" });',
    '  app = await buildApp(config);',
    '  await app.ready();',
    "});",
    "",
    'afterAll(async () => { await app.close(); });',
    "",
    'describe("Generated Route Tests", () => {',
  ];

  for (const [path, methods] of Object.entries(spec.paths ?? {})) {
    for (const method of Object.keys(methods as Record<string, unknown>)) {
      const testName = `${method.toUpperCase()} ${path}`.replace(/[{}]/g, "");
      lines.push(`  it("${testName} returns 200/401", async () => {`);
      lines.push(`    const res = await app.inject({ method: "${method.toUpperCase()}", url: "${path}" });`);
      lines.push(`    expect([200, 401, 403]).toContain(res.statusCode);`);
      lines.push("  });");
    }
  }

  lines.push("});\n");

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, lines.join("\n"), "utf8");
  console.log(`Generated ${lines.length} lines -> ${outputPath}`);
}

generate().catch((error) => { console.error(error); process.exit(1); });
