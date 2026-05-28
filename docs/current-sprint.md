# 当前 Sprint 计划

> 创建日期: 2026-05-28
> 状态: ✅ 全部完成

## Sprint 目标

从 v1.0 GA 生产就绪状态推进到 v1.1 社区生态扩展，重点攻克 **社区基建**、**集成扩展** 和 **监控增强** 三类任务。

## 完成情况

| 项目 | 状态 | 说明 |
|------|------|------|
| 开源协议与贡献指南 | ✅ | MIT License + CONTRIBUTING.md + CODE_OF_CONDUCT.md |
| GitHub Issue 模板 | ✅ | bug_report + feature_request + config.yml |
| 项目 Wiki | ✅ | 6 页基础 Wiki（架构、快速开始、部署、API、连接器） |
| Ansible Playbook | ✅ | 面板 + 连接器部署 playbook |
| 邮件通知渠道 (SMTP) | ✅ | 内置 net/tls SMTP 客户端，无额外依赖 |
| WebAuthn 通行密钥 | ✅ | FIDO2 注册/登录/凭据管理完整流程 |
| 操作审计重放 API | ✅ | GET /api/audit/replay |
| 自定义告警规则引擎 | ✅ | JSON 条件表达式 + CRUD |
| WebSocket 压缩 | ✅ | permessage-deflate 扩展协商 |
| Route test 修复 | ✅ | 类型错误修复 + 测试完善 |

---

# 下一阶段：v1.2 生产增强与体验优化计划表

> 预计工时：4-6 周

## P0 — 关键修复与增强

### 1. 状态存储迁移向导
- [ ] Web UI 引导从 JSON → SQLite 迁移
- [ ] 迁移前数据完整性校验
- [ ] 迁移回滚能力

### 2. 前端性能优化
- [ ] 路由级代码分割（懒加载）
- [ ] 大数据列表虚拟滚动优化
- [ ] 首屏加载指标优化

### 3. 安全增强
- [ ] 速率限制精细化配置（Web UI）
- [ ] IP 白名单管理界面
- [ ] 审计日志加密存储选项

## P1 — 体验优化

### 4. 移动端适配完善
- [ ] 所有页面移动端响应式验证
- [ ] 触摸操作优化
- [ ] 移动端顶部栏折叠菜单

### 5. 通知中心
- [ ] 页面内通知面板（下拉/弹出）
- [ ] 未读通知计数徽标
- [ ] 通知历史持久化

### 6. 向导式初始化
- [ ] 首次运行向导（管理员创建、基础配置）
- [ ] Docker 部署检查清单
- [ ] 连接器注册引导

## P2 — 扩展功能

### 7. Grafana 面板增强
- [ ] 更丰富的监控仪表盘模板
- [ ] 面板数据源直连支持

### 8. Terraform Provider 完善
- [ ] 从骨架升级到可用 provider
- [ ] 覆盖主机、用户、备份资源
- [ ] 发布到 Terraform Registry

### 9. 国际化翻译补充
- [ ] 后端错误消息双语化完成度审计
- [ ] 前端缺失文案补充
- [ ] 日语/韩语初步支持评估

## 时间线

```
Week 1-2: P0 状态迁移 + 前端性能优化
Week 3:   P0 安全增强
Week 4:   P1 移动端适配 + 通知中心
Week 5:   P2 Grafana + Terraform
Week 6:   P2 国际化 + 综合测试
```

## 验收标准

- [ ] `npm run test` 全部通过
- [ ] `npm run lint` 无错误
- [ ] `npm run typecheck` 通过
- [ ] `npm run build` 成功
- [ ] Lighthouse 评分 ≥ 85
- [ ] 移动端所有核心页面可用
