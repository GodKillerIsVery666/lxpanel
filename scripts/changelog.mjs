#!/usr/bin/env node
/**
 * API 变更日志生成器
 * 从 git log 提取 API 相关提交，生成用户友好的变更日志。
 *
 * 用法: node scripts/changelog.mjs [--from v0.2.0 --to HEAD]
 */
import { execSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const from = args.find((a) => a.startsWith("--from="))?.split("=")[1] ?? "HEAD~20";
const to = args.find((a) => a.startsWith("--to="))?.split("=")[1] ?? "HEAD";

const log = execSync(`git log ${from}..${to} --oneline --no-decorate`, { cwd: root, encoding: "utf8" });
const lines = log.split("\n").filter(Boolean);

const categories: Record<string, string[]> = {
  "✨ 新功能": [],
  "🔒 安全": [],
  "🐛 修复": [],
  "📚 文档": [],
  "🔧 运维": [],
  "🛠 其他": []
};

for (const line of lines) {
  const msg = line.replace(/^[a-f0-9]+\s+/u, "");
  if (/add|新增|增加|feature|support/i.test(msg)) categories["✨ 新功能"].push(msg);
  else if (/security|cve|xss|csrf|auth|oidc|token|加密/i.test(msg)) categories["🔒 安全"].push(msg);
  else if (/fix|bug|修复|修复|error|issue/i.test(msg)) categories["🐛 修复"].push(msg);
  else if (/doc|文档|readme|guide|deploy/i.test(msg)) categories["📚 文档"].push(msg);
  else if (/ci|cd|docker|helm|k8s|action|workflow/i.test(msg)) categories["🔧 运维"].push(msg);
  else categories["🛠 其他"].push(msg);
}

const changelog = [
  "# 变更日志",
  `> 生成时间: ${new Date().toISOString()}`,
  `> 范围: ${from} → ${to}`,
  "",
  ...Object.entries(categories).flatMap(([cat, items]) =>
    items.length > 0 ? [`## ${cat}`, ...items.map((i) => `- ${i}`), ""] : []
  )
].join("\n");

const outputPath = join(root, "docs", "CHANGELOG.md");
await writeFile(outputPath, changelog, "utf8");
console.log(`Changelog written to ${outputPath} (${lines.length} commits)`);
