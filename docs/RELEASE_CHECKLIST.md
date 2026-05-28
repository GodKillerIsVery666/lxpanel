# v1.0.0 发布检查清单

## 前置检查
- [x] 所有测试通过: `npm run test`
- [x] Lint 通过: `npm run lint`
- [x] 类型检查通过: `npm run typecheck`
- [x] 生产构建成功: `npm run build`
- [x] E2E 烟测通过: `npm run smoke`
- [x] 发布包打包成功: `npm run package:release`
- [x] 发布诊断通过: `npm run diagnose:release`

## 安全
- [x] 安全审计通过: `node scripts/security-audit.mjs`
- [x] 依赖无已知 CVE: `npm audit` → 0 vulnerabilities
- [x] Dependabot 已配置

## 性能
- [x] 压力测试报告生成: `node scripts/stress-report.mjs`
- [x] 前端包体积 < 150 KB gzip: `node scripts/bundle-analyze.mjs`

## 文档
- [x] API 变更日志更新: `node scripts/changelog.mjs`
- [x] 部署文档已更新: `docs/deployment.md`
- [x] 路线图已更新

## 发布
- [x] 版本号升级: `package.json` version → `1.0.0`
- [ ] 创建 Git Tag: `git tag v1.0.0 && git push origin v1.0.0`
- [ ] Docker 镜像构建并推送
- [ ] GitHub Release 发布（含校验和和签名）
- [ ] 发布说明编写完成
