#!/usr/bin/env node
/**
 * 前端包体积分析脚本
 * 使用 Vite 的 bundle 分析输出。
 *
 * 用法: node scripts/bundle-analyze.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const distDir = join(root, "apps", "web", "dist", "assets");

if (!existsSync(distDir)) {
  console.error("请先运行 npm run build");
  process.exit(1);
}

const { readdir } = await import("node:fs/promises");
const files = await readdir(distDir);
const jsFiles = files.filter((f) => f.endsWith(".js"));
const cssFiles = files.filter((f) => f.endsWith(".css"));

console.log("\n=== 前端包体积分析 ===\n");
let totalGzip = 0;
let totalRaw = 0;

const { gzipSync } = await import("node:zlib");

for (const file of [...jsFiles, ...cssFiles]) {
  const content = readFileSync(join(distDir, file));
  const gzipped = gzipSync(content).length;
  const type = file.endsWith(".js") ? "JS" : "CSS";
  console.log(`  ${type} ${file.padEnd(50)} ${(content.length / 1024).toFixed(1)} KB (gzip: ${(gzipped / 1024).toFixed(1)} KB)`);
  totalRaw += content.length;
  totalGzip += gzipped;
}

console.log(`\n  总计: ${(totalRaw / 1024).toFixed(1)} KB (gzip: ${(totalGzip / 1024).toFixed(1)} KB)`);
console.log(`  目标: < 150 KB gzip ${totalGzip / 1024 < 150 ? "✅" : "❌"}`);
