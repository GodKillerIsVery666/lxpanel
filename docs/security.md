# 安全基线

## 已实现

- 无默认管理员密码，首次访问必须初始化。
- 密码使用 Node 内置 `scrypt` 派生并带随机盐。
- 会话 Cookie 使用 HMAC 签名，服务端只保存会话哈希。
- 登录接口有速率限制。
- 文件目录访问限制在 `LXPANEL_FILE_ROOTS` 内。
- 服务控制只允许合法 systemd service 名称。
- Docker 容器动作只接受受限 ID/名称字符，并记录审计。
- 日志查看限制在 `LXPANEL_LOG_ROOTS` 内，只读取文件尾部，避免一次性加载超大日志。
- 审计日志记录登录、初始化、连接器创建和服务动作。

## 生产部署要求

1. 设置强随机 `LXPANEL_SESSION_SECRET`。
2. 放在 HTTPS 反向代理后，并设置 `LXPANEL_COOKIE_SECURE=true`。
3. 明确配置 `LXPANEL_ALLOWED_ORIGINS`。
4. 将 `LXPANEL_FILE_ROOTS` 收敛到必要目录。
5. 将 `LXPANEL_LOG_ROOTS` 收敛到必要日志目录。
6. 使用独立低权限用户运行 API 服务，谨慎授予 Docker socket 权限。

## 后续强化

- TOTP 双因素认证。
- RBAC 权限模型。
- 数据库存储与备份。
- 操作二次确认与审批。
- 连接器端到端命令签名。
