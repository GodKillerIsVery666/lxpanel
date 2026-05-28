# 当前 Sprint 计划

> 创建日期: 2026-05-28
> 状态: ✅ v1.1 + v1.2 全部完成

## Sprint 目标

完成 v1.1 社区生态扩展和 v1.2 生产增强与体验优化。

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

---

# 下一阶段：v1.3 社区运营与合规增强

> 预计工时：4-6 周

## P0 — 关键事项

### 1. 单元测试覆盖率提升
- [ ] 前端组件测试（Vitest + React Testing Library）
- [ ] 后端新增模块测试（SMTP/WebAuthn/告警规则/审计重放）
- [ ] CI 集成测试覆盖率门禁

### 2. 前端 UI 完善
- [ ] WebAuthn 前端登录注册 UI
- [ ] 自定义告警规则前端管理页面
- [ ] SMTP 邮件通知前端配置表单

### 3. 文档深化
- [ ] API 文档补充新端点
- [ ] 架构文档补充 v1.2 新增模块
- [ ] Wiki 补充安全设置、迁移向导说明

## P1 — 社区运营

### 4. GitHub Discussions 配置
- [ ] 配置 Discussions 分类（Q&A / Ideas / Show & Tell）
- [ ] 创建社区健康文件（SECURITY.md、SUPPORT.md）

### 5. CI 增强
- [ ] 自动发布 GitHub Release
- [ ] Docker 镜像自动构建
- [ ] 代码覆盖率报告

### 6. 新手引导
- [ ] README 添加贡献者徽章和统计
- [ ] 创建示例项目和教程链接

## P2 — 合规增强

### 7. GDPR / 数据合规
- [ ] 数据保留策略可视化
- [ ] 用户数据导出 API
- [ ] 隐私政策文档

### 8. 审计增强
- [ ] 审计事件签名链可视化
- [ ] 合规报告导出增强

## 时间线

```
Week 1-2: P0 测试覆盖 + UI 完善
Week 3:   P0 文档深化
Week 4:   P1 社区运营 + CI
Week 5-6: P2 合规增强
```
