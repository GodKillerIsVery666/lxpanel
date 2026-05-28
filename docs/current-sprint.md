# 当前 Sprint 计划

> 创建日期: 2026-05-28
> 基于 `docs/roadmap.md` v1.1 社区生态扩展计划表

## Sprint 目标

从 v1.0 GA 生产就绪状态推进到 v1.1 社区生态扩展，重点攻克 **社区基建**、**集成扩展** 和 **监控增强** 三类任务。

---

## P0 — 必须完成（社区基建）

### 1. 开源协议与贡献指南

- [ ] 选择开源协议（推荐 AGPLv3 或 Apache 2.0），创建 `LICENSE` 文件
- [ ] 创建 `CONTRIBUTING.md`：PR 流程、代码风格、测试要求、Commit 规范
- [ ] 创建 `CODE_OF_CONDUCT.md`：参与者公约
- [ ] 更新 `README.md`：添加协议徽章、贡献入口、社区链接

**文件**: `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`  
**估算**: 1 天

### 2. GitHub Issue 模板

- [ ] 创建 `.github/ISSUE_TEMPLATE/bug_report.md`：Bug 报告模板（环境、复现步骤、预期/实际行为）
- [ ] 创建 `.github/ISSUE_TEMPLATE/feature_request.md`：功能请求模板（场景、方案、备选）
- [ ] 创建 `.github/ISSUE_TEMPLATE/config.yml`：模板选择配置

**文件**: `.github/ISSUE_TEMPLATE/*.md`  
**估算**: 0.5 天

### 3. 项目 Wiki 基础页

- [ ] 创建 GitHub Wiki Home：项目概述、架构图（Mermaid）
- [ ] 创建「快速开始」页：Docker / 源码 / 离线安装
- [ ] 创建「API 概览」页：认证方式、常用端点
- [ ] 创建「部署指南」页：生产拓补、反向代理、HTTPS 配置

**估算**: 1 天

---

## P1 — 重要功能（集成扩展）

### 4. 邮件通知渠道（SMTP）

- [ ] `apps/api/src/modules/notifications/` 新增 `emailChannel.ts`
  - 支持 SMTP 配置（host、port、username、password、from）
  - 连接 URL 加密保存（复用现有通知加密机制）
  - 支持 HTML 模板渲染
- [ ] 前端通知页增加「邮件」渠道类型表单
- [ ] 后端注册邮件通知处理器到 `NotificationService`
- [ ] 测试：单元测试 + 集成测试（含发送失败重试）

**模块**: `notifications`  
**文件**: `apps/api/src/modules/notifications/emailChannel.ts`, 前端通知表单  
**估算**: 3 天

### 5. Ansible Playbook

- [ ] 创建 `deploy/ansible/playbook.yml`：面板安装 + 配置
- [ ] 创建 `deploy/ansible/connector.yml`：连接器部署
- [ ] 支持变量化配置（host、port、session_secret、data_dir）
- [ ] 支持 Docker Compose 部署模式和裸机部署模式
- [ ] 编写 `deploy/ansible/README.md`

**文件**: `deploy/ansible/*`  
**估算**: 2 天

### 6. WebAuthn 通行密钥（FIDO2）

- [ ] 后端：`apps/api/src/modules/auth/` 新增 `webauthn.ts`
  - Registration（公钥注册）
  - Authentication（无密码登录）
  - 凭据管理（列出、撤销）
  - 与现有 session/Cookie 体系集成
- [ ] 前端登录页增加「通行密钥登录」按钮
- [ ] 安全页增加「安全密钥管理」面板

**模块**: `auth`  
**估算**: 4 天

---

## P2 — 增强优化

### 7. 操作审计重放 API

- [ ] `GET /api/audit/replay?from=&to=&eventTypes=`：按时间范围导出
- [ ] 支持 JSONL / 压缩包格式
- [ ] 前端审计页增加「导出回放包」入口
- [ ] 测试：校验时间范围、事件过滤、压缩输出

**模块**: `audit`  
**估算**: 2 天

### 8. 自定义告警规则引擎

- [ ] 后端：`apps/api/src/modules/alerts/` 新增 `ruleEngine.ts`
  - 支持 JSON 规则表达式（条件 + 阈值 + 聚合窗口）
  - 内置指标数据源（CPU、内存、磁盘、连接器心跳）
  - 规则 CRUD 管理
- [ ] 前端告警页增加「自定义规则」Tab
- [ ] 调度器定期评估规则并触发告警
- [ ] 测试：规则评估、边界条件、表达式解析

**模块**: `alerts`  
**估算**: 5 天

### 9. WebSocket 压缩

- [ ] 终端 WebSocket 启用 `permessage-deflate` 扩展
- [ ] 审计流 WebSocket 启用压缩
- [ ] 性能测试：对比压缩前后带宽消耗

**模块**: `platform`（终端）、`audit`（审计流）  
**估算**: 1 天

### 10. Route test approvalId 修复

- [ ] 修复审计路由 `approvalId` Zod 校验
- [ ] 更新 `apps/api/tests/` 下审计相关测试用例
- [ ] 修复测试数据不完整问题

**文件**: `apps/api/tests/` 审计测试  
**估算**: 0.5 天

---

## 时间线

```
Week 1: P0 社区基建 (LICENSE + Issue 模板 + Wiki)
Week 2: P1 邮件通知渠道
Week 3: P1 Ansible Playbook
Week 4: P1 WebAuthn 通行密钥
Week 5: P2 告警规则引擎 + 其他 P2
```

## 验收标准

- [ ] `npm run test` 全部通过
- [ ] `npm run lint` 无错误
- [ ] `npm run typecheck` 通过
- [ ] `npm run build` 成功
- [ ] 新增模块测试覆盖率 ≥ 80%
- [ ] 前端新增页面/表单 i18n 中英文覆盖
