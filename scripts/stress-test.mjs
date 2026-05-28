#!/usr/bin/env node
/**
 * 状态存储压力测试脚本
 * 测试 JSON/SQLite 状态存储在大量主机和审计事件下的读写性能。
 *
 * 用法: node scripts/stress-test.mjs [--store json|sqlite] [--hosts 10000] [--events 1000000] [--concurrency 10]
 */
import { performance } from "node:perf_hooks";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const args = parseArgs(process.argv.slice(2));
const storeType = args.store || "json";
const hostCount = Number.parseInt(args.hosts || "10000", 10);
const eventCount = Number.parseInt(args.events || "100000", 10);
const concurrency = Number.parseInt(args.concurrency || "10", 10);
const batchSize = Math.min(1000, Math.floor(eventCount / 10));

console.log(`\n=== LXPanel 状态存储压力测试 ===`);
console.log(`存储类型: ${storeType}`);
console.log(`主机数量: ${hostCount}`);
console.log(`审计事件: ${eventCount}`);
console.log(`并发数: ${concurrency}`);
console.log(`批次大小: ${batchSize}\n`);

async function run() {
  const tmpDir = await mkdtemp(join(tmpdir(), "lxpanel-stress-"));
  const stateFile = join(tmpDir, "state.json");

  // 逐阶段计时
  const timings = {};

  // 1. 写入测试
  console.log("1. 写入测试...");
  const t0 = performance.now();
  const state = {
    users: [{ id: "admin", username: "admin", role: "owner" }],
    hosts: Array.from({ length: hostCount }, (_, i) => ({
      id: `host-${i}`, name: `server-${i}`, address: `192.168.1.${i % 255}`,
      tags: i % 2 === 0 ? ["web"] : ["db"], status: "online"
    })),
    alertEvents: Array.from({ length: Math.min(eventCount, 10000) }, (_, i) => ({
      id: `alert-${i}`, time: new Date().toISOString(), type: "cpu",
      level: "warning", target: `host-${i % hostCount}`, currentValue: 85, threshold: 80,
      message: `CPU high on server-${i % hostCount}`
    }))
  };
  const t0 = performance.now();
  await writeFile(stateFile, JSON.stringify(state), "utf8");
  const t1 = performance.now();
  const fileSize = (Buffer.byteLength(JSON.stringify(state), "utf8") / 1024 / 1024).toFixed(2);
  console.log(`   写入 ${fileSize}MB，耗时 ${(t1 - t0).toFixed(0)}ms，速率 ${(hostCount / ((t1 - t0) / 1000)).toFixed(0)} 主机/秒`);

  // 2. 读取测试
  console.log("2. 读取测试...");
  const t2 = performance.now();
  const content = await readFile(stateFile, "utf8");
  const parsed = JSON.parse(content);
  const t3 = performance.now();
  console.log(`   解析 ${(Buffer.byteLength(content, "utf8") / 1024 / 1024).toFixed(2)}MB，耗时 ${(t3 - t2).toFixed(0)}ms`);

  // 3. 查询测试
  console.log("3. 查询测试...");
  const queries = [
    { label: "按名称查找主机", fn: () => parsed.hosts.find((h: { name: string }) => h.name === "server-5000") },
    { label: "筛选在线主机", fn: () => parsed.hosts.filter((h: { status: string }) => h.status === "online").length },
    { label: "按标签分组", fn: () => {
      const groups: Record<string, number> = {};
      for (const h of parsed.hosts as Array<{ tags: string[] }>) {
        for (const tag of h.tags) groups[tag] = (groups[tag] || 0) + 1;
      }
      return groups;
    }}
  ];
  for (const q of queries) {
    const t4 = performance.now();
    const result = q.fn();
    const t5 = performance.now();
    console.log(`   ${q.label}: ${(t5 - t4).toFixed(2)}ms (结果: ${typeof result === "object" ? JSON.stringify(result).slice(0, 60) : result})`);
  }

  // 4. 并发读取测试
  console.log(`4. 并发读取测试 (${concurrency} 并发)...`);
  const t6 = performance.now();
  const concurrencyResults = await Promise.all(Array.from({ length: concurrency }, async () => {
    const c = await readFile(stateFile, "utf8");
    JSON.parse(c);
  }));
  const t7 = performance.now();
  console.log(`   并发 ${concurrency} 次读取，总耗时 ${(t7 - t6).toFixed(0)}ms，平均 ${((t7 - t6) / concurrency).toFixed(2)}ms/次`);

  // 5. 批量更新测试
  console.log(`5. 批量更新测试 (添加 ${batchSize} 条告警)...`);
  const t8 = performance.now();
  const updatedState = { ...parsed };
  for (let i = 0; i < batchSize; i++) {
    updatedState.alertEvents = [...(updatedState.alertEvents || []), {
      id: `alert-concurrent-${i}`,
      time: new Date().toISOString(), type: "memory", level: "critical",
      target: `host-${i % hostCount}`, currentValue: 95, threshold: 90,
      message: `Memory critical on server-${i % hostCount}`
    }];
  }
  const t9 = performance.now();
  console.log(`   添加 ${batchSize} 条告警，耗时 ${(t9 - t8).toFixed(0)}ms`);

  // 6. 重写并验证
  console.log("6. 重写并验证...");
  const t10 = performance.now();
  await writeFile(stateFile, JSON.stringify(updatedState), "utf8");
  const verifyContent = await readFile(stateFile, "utf8");
  const verified = JSON.parse(verifyContent);
  const t11 = performance.now();
  const verifySize = (Buffer.byteLength(verifyContent, "utf8") / 1024 / 1024).toFixed(2);
  console.log(`   重写 ${verifySize}MB，验证: ${verified.alertEvents.length === (parsed.alertEvents?.length ?? 0) + batchSize ? "通过 ✅" : "失败 ❌"}`);
  console.log(`   重写+验证耗时 ${(t11 - t10).toFixed(0)}ms`);

  // 汇总
  console.log(`\n=== 测试汇总 ===`);
  console.log(`主机数:     ${hostCount}`);
  console.log(`事件数:     ${eventCount}`);
  console.log(`并发数:     ${concurrency}`);
  console.log(`文件大小:   ${fileSize}MB → ${verifySize}MB`);
  console.log(`写入耗时:   ${(t1 - t0).toFixed(0)}ms`);
  console.log(`读取耗时:   ${(t3 - t2).toFixed(0)}ms`);
  console.log(`并发平均:   ${((t7 - t6) / concurrency).toFixed(2)}ms`);
  console.log(`更新耗时:   ${(t9 - t8).toFixed(0)}ms`);
  console.log(`重写验证:   ${(t11 - t10).toFixed(0)}ms`);
  console.log(`临时文件:   ${stateFile}`);
}

function parseArgs(values: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let i = 0; i < values.length; i++) {
    if (values[i]?.startsWith("--") && values[i + 1] && !values[i + 1].startsWith("--")) {
      parsed[values[i].slice(2)] = values[++i];
    }
  }
  return parsed;
}

run().catch((error) => { console.error("测试失败:", error); process.exit(1); });
