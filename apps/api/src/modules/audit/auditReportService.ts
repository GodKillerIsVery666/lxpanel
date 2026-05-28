/**
 * 审计 PDF 报告生成服务。
 * 使用纯字符串模板生成基本 PDF/TXT 合规报告，无需外部依赖。
 */
import type { ComplianceReport, AuditIntegrityReport } from "@lxpanel/shared";

export interface AuditReportInput {
  compliance: ComplianceReport;
  integrity: AuditIntegrityReport;
  generatedAt: string;
  period?: { from?: string; to?: string };
}

/**
 * 生成合规报告纯文本（可保存为 TXT 或用作 PDF 内容）。
 */
export function generateComplianceReportText(input: AuditReportInput): string {
  const lines: string[] = [];
  lines.push("=".repeat(60));
  lines.push("  LXPanel 审计合规报告");
  lines.push("=".repeat(60));
  lines.push(`生成时间: ${input.generatedAt}`);
  if (input.period?.from) {
    lines.push(`统计周期: ${input.period.from} ~ ${input.period.to ?? "现在"}`);
  }
  lines.push("");
  lines.push("--- 概览 ---");
  lines.push(`审计事件总数: ${input.compliance.totalEvents}`);
  lines.push(`拒绝事件: ${input.compliance.denied}`);
  lines.push(`错误事件: ${input.compliance.errors}`);
  lines.push("");

  lines.push("--- 按动作分类 ---");
  for (const item of input.compliance.actions) {
    lines.push(`  ${item.action}: ${item.count} 次`);
  }
  lines.push("");

  lines.push("--- 完整性校验 ---");
  lines.push(`校验时间: ${input.integrity.checkedAt}`);
  lines.push(`事件总数: ${input.integrity.total}`);
  lines.push(`状态: ${input.integrity.ok ? "✅ 通过" : "❌ 异常"}`);
  if (input.integrity.latestHash) {
    lines.push(`最新哈希: ${input.integrity.latestHash.slice(0, 16)}...`);
  }
  if (input.integrity.issues.length > 0) {
    lines.push("问题:");
    for (const issue of input.integrity.issues) {
      lines.push(`  - ${issue}`);
    }
  }
  lines.push("");
  lines.push("=".repeat(60));
  lines.push("  报告结束");
  lines.push("=".repeat(60));
  return lines.join("\n");
}

/**
 * 生成 HTML 格式合规报告（可用于浏览器查看或打印为 PDF）。
 */
export function generateComplianceReportHtml(input: AuditReportInput): string {
  const statusIcon = input.integrity.ok ? "✅" : "❌";
  const actionRows = input.compliance.actions.map((item) =>
    `<tr><td>${item.action}</td><td style="text-align:right">${item.count}</td></tr>`
  ).join("\n");
  const issueItems = input.integrity.issues.map((issue) =>
    `<li>${issue}</li>`
  ).join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>审计合规报告 - LXPanel</title>
<style>
body { font-family: 'Microsoft YaHei', sans-serif; margin: 40px; color: #333; }
h1 { color: #3a5a6e; border-bottom: 2px solid #3a5a6e; padding-bottom: 8px; }
table { border-collapse: collapse; width: 100%; margin: 16px 0; }
th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
th { background: #f5f3f1; }
.meta { color: #7a7570; font-size: 14px; }
.summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
.stat-card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; text-align: center; }
.stat-card strong { font-size: 28px; display: block; }
.ok { color: #3a6a5e; }
.issue { background: #fff0ee; border-left: 3px solid #bc4b3c; padding: 10px; }
</style></head>
<body>
<h1>LXPanel 审计合规报告</h1>
<p class="meta">生成时间: ${input.generatedAt}</p>
${input.period?.from ? `<p class="meta">统计周期: ${input.period.from} ~ ${input.period.to ?? "现在"}</p>` : ""}

<div class="summary">
<div class="stat-card"><span>审计事件</span><strong>${input.compliance.totalEvents}</strong></div>
<div class="stat-card"><span>拒绝事件</span><strong>${input.compliance.denied}</strong></div>
<div class="stat-card"><span>错误事件</span><strong>${input.compliance.errors}</strong></div>
</div>

<h2>按动作分类</h2>
<table><thead><tr><th>动作</th><th>次数</th></tr></thead><tbody>${actionRows}</tbody></table>

<h2>完整性校验</h2>
<div style="margin:16px 0">
<p><strong>校验时间:</strong> ${input.integrity.checkedAt}</p>
<p><strong>状态:</strong> <span class="${input.integrity.ok ? "ok" : ""}">${statusIcon} ${input.integrity.ok ? "通过" : "异常"}</span></p>
<p><strong>事件总数:</strong> ${input.integrity.total}</p>
${input.integrity.latestHash ? `<p><strong>最新哈希:</strong> <code>${input.integrity.latestHash.slice(0, 16)}...</code></p>` : ""}
</div>
${input.integrity.issues.length > 0 ? `<div class="issue"><strong>问题:</strong><ul>${issueItems}</ul></div>` : ""}
<hr>
<p class="meta">报告由 LXPanel 自动生成</p>
</body></html>`;
}
