# Contributing to LXPanel

感谢您对 LXPanel 的关注！我们欢迎社区贡献，无论是 Bug 修复、功能改进、文档完善还是问题反馈。

## 行为准则

本项目采用 [Contributor Covenant 行为准则](CODE_OF_CONDUCT.md)。请确保所有交流尊重、包容、专业。

## 如何贡献

### 报告 Bug

1. 搜索已有 [Issues](https://github.com/GodKillerIsVery666/lxpanel/issues) 确认是否已被报告。
2. 使用 Bug Report 模板创建 Issue，详细描述：
   - 运行环境（OS、Node 版本、浏览器版本）
   - 复现步骤
   - 预期行为与实际行为
   - 日志或截图（如有）

### 提交功能请求

1. 使用 Feature Request 模板创建 Issue。
2. 清晰描述使用场景、预期行为和备选方案。

### Pull Request 流程

1. **Fork** 仓库并创建你的功能分支：`git checkout -b feat/your-feature`
2. **Commit** 修改，遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：
   - `feat:` 新功能
   - `fix:` Bug 修复
   - `docs:` 文档变更
   - `style:` 代码格式
   - `refactor:` 代码重构
   - `test:` 测试相关
   - `chore:` 构建/工具链
3. 确保代码通过所有检查：
   ```bash
   npm run lint          # ESLint 检查
   npm run typecheck     # TypeScript 类型检查
   npm run test          # 单元测试
   npm run build         # 生产构建
   ```
4. 提交 PR 到 `main` 分支，清晰描述变更内容。

### 代码规范

- 严格 TypeScript，禁止使用 `any`
- 模块职责单一，文件不超过 300 行
- 所有外部调用（API、DB、文件 IO）必须有 try-catch 错误处理
- 前端组件使用 React + TypeScript，样式使用全局 CSS 类
- 新增 API 路由必须附带 Zod 校验和测试

### 开发环境

```bash
npm install
npm run build
npm run dev
```

## 项目结构

```
apps/
  api/          # Fastify 后端 API
  web/          # React + Vite 前端
  desktop-tauri/ # Tauri 桌面客户端
packages/
  shared/       # 共享类型与契约
scripts/        # 构建、CI、工具脚本
deploy/         # 部署配置
docs/           # 文档
```

## 测试

- 后端：`vitest`，路由层测试在 `apps/api/tests/`
- 前端：暂无独立单元测试（计划中）
- E2E：`npm run e2e`（Playwright）
- Smoke：`npm run smoke`
