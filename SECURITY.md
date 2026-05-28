# 安全策略

## 报告安全漏洞

LXPanel 重视安全性。如果您发现安全漏洞，请通过以下方式私下报告：

1. **不要** 公开提交 Issue。
2. 发送邮件至项目维护者（通过 GitHub 上的联系方式）。
3. 我们将在 48 小时内确认收到，并尽快修复。

## 安全最佳实践

- 生产环境必须设置强 `LXPANEL_SESSION_SECRET`
- 启用 HTTPS（设置 `LXPANEL_COOKIE_SECURE=true`）
- 配置 IP 白名单（`LXPANEL_IP_ALLOWLIST`）
- 定期更新依赖：`npm audit`
- 使用 API Token 时，授予最小必要作用域

## 支持版本

仅最新版本的 LXPanel 会收到安全更新。建议始终使用最新版本。
