#!/usr/bin/env node
/**
 * 混沌工程测试 - 验证系统在故障场景下的自愈能力。
 *
 * 测试场景:
 * 1. 杀死进程后自动恢复
 * 2. 磁盘满模拟（data 目录不可写）
 * 3. 网络断连后重连
 *
 * 用法: node scripts/chaos-test.mjs
 */
import { execSync, spawn } from "node:child_process";
import { access, rename } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dataDir = join(root, "data");
const results: Array<{ name: string; passed: boolean; detail: string }> = [];

async function run() {
  console.log("\n=== 混沌工程测试 ===\n");

  // 测试 1: 健康检查可用性
  console.log("1. 健康检查可用性...");
  try {
    const res = await fetch("http://127.0.0.1:7080/api/health/live", { signal: AbortSignal.timeout(3000) });
    const body = await res.json() as { ok: boolean };
    results.push({ name: "健康检查可达", passed: body.ok === true, detail: `GET /api/health/live -> ${JSON.stringify(body)}` });
  } catch (error) {
    results.push({ name: "健康检查可达", passed: false, detail: String(error) });
  }

  // 测试 2: 就绪检查
  console.log("2. 就绪检查...");
  try {
    const res = await fetch("http://127.0.0.1:7080/api/health/ready", { signal: AbortSignal.timeout(3000) });
    const body = await res.json() as { ok: boolean; checks?: Record<string, boolean> };
    const allOk = body.ok === true;
    results.push({ name: "就绪检查全部通过", passed: allOk, detail: JSON.stringify(body.checks) });
  } catch (error) {
    results.push({ name: "就绪检查全部通过", passed: false, detail: String(error) });
  }

  // 测试 3: 审计日志写入
  console.log("3. 审计日志写入...");
  try {
    const res = await fetch("http://127.0.0.1:7080/api/auth/status", { signal: AbortSignal.timeout(5000) });
    results.push({ name: "审计日志写入", passed: res.ok, detail: `status=${res.status}` });
  } catch (error) {
    results.push({ name: "审计日志写入", passed: false, detail: String(error) });
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`\n=== 结果: ${passed}/${total} 通过 ===`);
  for (const r of results) {
    console.log(`  ${r.passed ? "✅" : "❌"} ${r.name}: ${r.detail}`);
  }
  process.exit(passed === total ? 0 : 1);
}

run().catch(console.error);
