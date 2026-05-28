# 当前 Sprint 计划

> 创建日期: 2026-05-28
> 状态: ✅ v1.1 + v1.2 + v1.3 全部完成

## Sprint 目标

完成 v1.1 社区生态扩展、v1.2 生产增强与体验优化和 v1.3 社区运营与合规增强。

## 完成情况

### v1.1 社区生态扩展

| 项目 | 状态 | 交付 |
|------|------|------|
| 开源协议与贡献指南 | ✅ | MIT License + CONTRIBUTING.md + CODE_OF_CONDUCT.md |
| GitHub Issue 模板 | ✅ | bug_report + feature_request + config.yml |
| 项目 Wiki | ✅ | 6 页基础 Wiki |
| Ansible Playbook | ✅ | 面板 + 连接器 playbook |
| 邮件通知渠道 (SMTP) | ✅ | 内置 net/tls SMTP 客户端 |
| WebAuthn 通行密钥 | ✅ | FIDO2 注册/登录/凭据管理 |
| 操作审计重放 API | ✅ | GET /api/audit/replay |
| 自定义告警规则引擎 | ✅ | JSON 条件表达式 + CRUD |
| WebSocket 压缩 | ✅ | permessage-deflate 扩展协商 |
| Route test 修复 | ✅ | 类型错误修复 + 测试完善 |

### v1.2 生产增强与体验优化

| 项目 | 状态 | 交付 |
|------|------|------|
| 状态存储迁移向导 | ✅ | MigrationPage + StepWizard + API 端点 |
| 前端性能优化 | ✅ | React.lazy 路由级代码分割，20+ 独立 chunk |
| 安全增强 UI | ✅ | SecuritySettingsPanel (速率限制/IP白名单/审计加密) |
| 移动端适配完善 | ✅ | 触摸优化、打印样式、底部安全区 |
| 通知中心 | ✅ | NotificationCenter 下拉面板 + 未读计数 |
| Grafana 面板增强 | ✅ | CPU/内存/磁盘/告警/审计趋势面板 |
| Terraform Provider | ✅ | 完整 Go provider + 4 个资源 (host/backup/user/workspace) |
| 国际化补充 | ✅ | 中英文资源文件 + 多语言切换 |

### v1.3 社区运营与合规增强

| 项目 | 状态 | 交付 |
|------|------|------|
| 测试覆盖提升 | ✅ | emailChannelService + alertRuleEngine + webauthnService (99 tests pass) |
| 前端 UI 完善 | ✅ | WebAuthnPanel + CustomAlertRulesPanel + SmtpConfigForm |
| 社区文件 | ✅ | SECURITY.md + SUPPORT.md |
| CI 增强 | ✅ | 覆盖率门禁(60%) + 自动 Release workflow |
| GDPR 合规 | ✅ | 用户数据导出 + 保留策略 + 账户注销 API |
| 文档深化 | ✅ | API/架构文档补充、Wiki 更新 |

---

# 下一阶段：v1.4 生态集成与高级运维

> 预计工时：4-6 周

## P0 — 核心增强

### 1. 前端全面国际化
- [ ] i18n 资源文件覆盖所有 20+ 页面
- [ ] 实时切换语言无需刷新
- [ ] 后端错误消息双语化审计

### 2. 性能压测与优化
- [ ] 10000+ 并发主机场景压测
- [ ] API 响应时间 P99 < 100ms
- [ ] 状态存储读写性能优化

### 3. 高级审计功能
- [ ] 审计事件签名链可视化（前端）
- [ ] 合规报告导出 PDF
- [ ] 审计保留策略执行日志

## P1 — 生态集成

### 4. API SDK 发布
- [ ] TypeScript SDK npm 包
- [ ] Python SDK
- [ ] SDK 自动生成脚本完善

### 5. Prometheus 集成增强
- [ ] 自定义告警规则导出 Prometheus 规则文件
- [ ] 面板自身指标 exporter 优化

### 6. Webhook 生态
- [ ] 钉钉/企微/飞书通知渠道
- [ ] Webhook 重试策略

## P2 — 高级运维

### 7. 批量操作
- [ ] 批量主机命令执行 UI
- [ ] 批量应用部署
- [ ] 批量数据库备份

### 8. 巡检报告
- [ ] 定时生成 PDF 巡检报告
- [ ] 报告对比功能
- [ ] 邮件自动发送

## 时间线

```
Week 1-2: P0 国际化 + 性能优化
Week 3:   P0 高级审计
Week 4:   P1 API SDK + Prometheus
Week 5:   P1 Webhook 生态
Week 6:   P2 批量操作 + 巡检报告
```
