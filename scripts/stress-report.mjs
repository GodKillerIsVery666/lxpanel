#!/usr/bin/env node
/**
 * 压力测试执行 & 报告生成器
 * 运行 stress-test.mjs 并生成 JSON 报告文件。
 *
 * 用法: node scripts/stress-report.mjs
 */
import { execSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const reportDir = join(root, "release", "benchmarks");
const scenarios = [
  { store: "json", hosts: 5000, events: 50000 },
  { store: "json", hosts: 10000, events: 100000 }
];

await mkdir(reportDir, { recursive: true });
const results = [];

for (const scenario of scenarios) {
  console.log(`\n=== 场景: ${scenario.store} / ${scenario.hosts} 主机 / ${scenario.events} 事件 ===`);
  try {
    const output = execSync(`node scripts/stress-test.mjs --store ${scenario.store} --hosts ${scenario.hosts} --events ${scenario.events}`, {
      cwd: root, timeout: 120_000, encoding: "utf8"
    });
    const lines = output.split("\n").filter((l) => l.includes("ms") || l.includes("MB") || l.includes("主机/秒"));
    results.push({ ...scenario, output: lines.join("\n"), status: "success" });
  } catch (error) {
    results.push({ ...scenario, error: String(error), status: "failed" });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  nodeVersion: process.version,
  platform: process.platform,
  results,
  summary: `Ran ${results.filter((r) => r.status === "success").length}/${results.length} scenarios`
};

await writeFile(join(reportDir, "stress-report.json"), JSON.stringify(report, null, 2), "utf8");
console.log(`\n报告已保存: ${join(reportDir, "stress-report.json")}`);
console.log(JSON.stringify(report.summary));
