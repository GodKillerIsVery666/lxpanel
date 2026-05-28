# 当前 Sprint 计划

> 创建日期: 2026-05-28
> 状态: ✅ v1.1 ~ v1.5 全部完成

## Sprint 目标

完成五个版本迭代：社区生态扩展、生产增强、社区运营合规、生态集成与高级运维、生产就绪与持续交付。

---

## 完成情况

### v1.1 社区生态扩展（10/10）

| 项目 | 状态 | 交付物 |
|------|------|--------|
| 开源协议与贡献指南 | ✅ | MIT License + CONTRIBUTING.md + CODE_OF_CONDUCT.md |
| GitHub Issue 模板 | ✅ | bug_report + feature_request + config.yml |
| 项目 Wiki | ✅ | 6 页基础 Wiki（架构、快速开始、部署、API、连接器） |
| Ansible Playbook | ✅ | 面板 + 连接器部署 playbook |
| 邮件通知渠道 (SMTP) | ✅ | 内置 net/tls SMTP 客户端，无额外依赖 |
| WebAuthn 通行密钥 | ✅ | FIDO2 注册/登录/凭据管理完整流程 |
| 操作审计重放 API | ✅ | GET /api/audit/replay |
| 自定义告警规则引擎 | ✅ | JSON 条件表达式 + CRUD + evaluateCustomRule |
| WebSocket 压缩 | ✅ | permessage-deflate 扩展协商 |
| Route test 修复 | ✅ | 类型错误修复 + 测试完善 |

### v1.2 生产增强与体验优化（9/9）

| 项目 | 状态 | 交付物 |
|------|------|--------|
| 状态存储迁移向导 | ✅ | MigrationPage + StepWizard + POST /api/platform/migrate-state-store |
| 前端性能优化 | ✅ | React.lazy 路由级代码分割，20+ 独立 chunk |
| 安全增强 UI | ✅ | SecuritySettingsPanel — 速率限制/IP 白名单/审计加密配置面板 |
| 移动端适配 | ✅ | 触摸优化 (min-height:44px)、iOS 字号防缩放、打印样式 |
| 通知中心 | ✅ | NotificationCenter 下拉面板 + 未读计数红色徽标 |
| Grafana 面板增强 | ✅ | 从 7 个面板扩展至 14 个，含 CPU/内存/磁盘/告警/审计趋势 |
| Terraform Provider | ✅ | 完整 Go 实现 + 4 个资源 (host/backup/user/workspace) |
| 国际化补充 | ✅ | 中英文资源文件 + Shell 和 SecurityPage 已接入 |

### v1.3 社区运营与合规增强（8/8）

| 项目 | 状态 | 交付物 |
|------|------|--------|
| 测试覆盖提升 | ✅ | emailChannelService + alertRuleEngine + webauthnService（99 tests ✅）|
| 前端 UI 完善 | ✅ | WebAuthnPanel + CustomAlertRulesPanel + SmtpConfigForm 集成到各页面 |
| 社区文件 | ✅ | SECURITY.md + SUPPORT.md |
| CI 增强 | ✅ | 覆盖率门禁 60% + 自动 Release workflow（GitHub Release + Docker）|
| GDPR 合规 | ✅ | 用户数据导出 / 保留策略 / 账户注销 API |
| 安全增强 | ✅ | 速率限制 / IP 白名单 / 审计加密管理面板 |
| 审计增强 | ✅ | 审计事件签名链验证、合规报告导出 |

### v1.4 生态集成与高级运维（8/8）

| 项目 | 状态 | 交付物 |
|------|------|--------|
| 前端全面国际化 | ✅ | 21 个页面 i18n 覆盖（含 migration）|
| 审计报告导出 | ✅ | GET /api/audit/compliance-report（HTML/TXT 格式）|
| Webhook 机器人 | ✅ | 钉钉/企微/飞书群机器人消息通知渠道 |
| Prometheus 增强 | ✅ | 自定义告警规则导出 Prometheus 规则 YAML |
| 压力测试增强 | ✅ | 并发读取 + 批量更新 + 时序汇总输出 |
| 通知渠道扩展 | ✅ | dingtalk/wechat/feishu 三种新渠道类型 |
| 批量操作 UI | ✅ | 增强主机批量命令面板 |
| 通知服务集成 | ✅ | NotificationService 处理 bot 类型渠道 |

### v1.5 生产就绪与持续交付（6/6）

| 项目 | 状态 | 交付物 |
|------|------|--------|
| v1.0.0 正式版发布 | ✅ | Git Tag v1.0.0 + CHANGELOG.md |
| 安全审计 | ✅ | 30 项通过，npm audit 0 漏洞 |
| 发布诊断 | ✅ | 9 项检查全部通过 |
| 安装程序 CI | ✅ | .github/workflows/installers.yml — Win/Linux/macOS 三平台 |
| 版本管理 | ✅ | 0.1.0 → 1.0.0，版本号规范化 |
| 文档审计 | ✅ | 部署文档 + 路线图 + 发布检查清单全部更新 |

---

## 项目总览

```
LXPanel v1.0.0 - 轻量服务器运维面板
======================================
📦 发布包:      release/lxpanel-1.0.0.tar.gz
🏷️ Git Tag:     v1.0.0（已推送）
✅ 测试:         99 tests passing
🔒 安全:         0 vulnerabilities（npm audit）
📚 文档:         CHANGELOG.md + 完整部署文档 + Wiki
🚀 CI/CD:       7 个 GitHub Actions workflows
🌐 功能:         20+ 页面, 100+ API 端点
   版本迭代:     5 个版本（v1.1 ~ v1.5）
```
