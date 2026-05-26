# 安全基线

## 已实现

- 无默认管理员密码，首次访问必须初始化。
- 密码使用 Node 内置 `scrypt` 派生并带随机盐。
- 支持 TOTP 双因素认证，登录时只在密码校验通过后要求 6 位动态码。
- 会话 Cookie 使用 HMAC 签名，服务端只保存会话哈希。
- `owner` 可以查看活动会话并强制撤销。
- API Token 使用 `lxpat_` 前缀，服务端只保存 SHA-256 哈希，创建后明文只展示一次，调用时仍沿用用户角色权限并记录最近使用时间。
- 登录接口有速率限制。
- 所有响应带基础安全头，写请求会校验 Origin/Fetch Metadata，降低 Cookie 认证下的 CSRF 风险。
- 可通过 `LXPANEL_IP_ALLOWLIST` 限制允许访问面板的源 IP。
- 状态备份恢复需要服务端确认短语，会先生成恢复前快照，并清空恢复后会话，避免旧快照中的会话继续有效。
- 文件目录访问、文本写入、建目录和删除均限制在 `LXPANEL_FILE_ROOTS` 内，写操作至少需要 `operator` 角色并记录审计。
- 服务控制只允许合法 systemd service 名称。
- Docker 容器动作只接受受限 ID/名称字符，至少需要 `operator` 角色，并记录审计。
- 日志查看限制在 `LXPANEL_LOG_ROOTS` 内，只读取文件尾部，避免一次性加载超大日志。
- RBAC 将用户分为 `owner`、`operator`、`viewer`，高风险动作至少需要 `operator`。
- 用户管理和备份创建仅允许 `owner`。
- 任务运行器不使用 shell 拼接，工作目录限制在 `LXPANEL_FILE_ROOTS`。
- 应用商店只允许内置 Docker Compose 模板，变量禁止换行和控制字符，动作通过参数化 `docker compose` 执行。
- 通知渠道仅支持 HTTP/HTTPS Webhook，创建、测试、删除均需要 `operator` 并记录审计。
- 主机资产写操作需要 `operator`，viewer 只能只读查看。
- 审计日志记录登录、初始化、连接器创建和服务动作。
- 安全态势页输出结构化检查项，覆盖会话密钥、HTTPS Cookie、IP 白名单、状态存储、备份、Docker socket 和 SSH 基础配置。
- 连接器 agent 默认只执行 allowlist 中的命令，使用 `execFile` 参数数组，不通过 shell 拼接。

## 生产部署要求

1. 设置强随机 `LXPANEL_SESSION_SECRET`。
2. 放在 HTTPS 反向代理后，并设置 `LXPANEL_COOKIE_SECURE=true`。
3. 明确配置 `LXPANEL_ALLOWED_ORIGINS`。
4. 将 `LXPANEL_FILE_ROOTS` 收敛到必要目录。
5. 将 `LXPANEL_LOG_ROOTS` 收敛到必要日志目录。
6. 配置 `LXPANEL_IP_ALLOWLIST`，只允许管理网络访问。
7. 使用独立低权限用户运行 API 服务，谨慎授予 Docker socket 权限。
8. Webhook URL 可能包含令牌，应限制可配置人员并优先使用内网通知入口。
9. 使用应用商店前确认 Docker socket 权限边界，生产环境建议只开放给可信 operator。
10. API Token 应设置合理有效期，并保存在 CI/自动化系统的密钥管理中；泄露后立即在安全页撤销。
11. 连接器 agent 运行账号应使用最小权限，并将 `LXPANEL_CONNECTOR_ALLOW_COMMANDS` 收敛到真实需要的命令集合。

## 后续强化

- 更细粒度的资源级 RBAC 权限。
- 数据库存储与备份。
- 操作二次确认与审批。
- 连接器端到端命令签名。
- Webhook 出站域名白名单与通知密钥加密保存。
- API Token 细粒度作用域、创建时二次确认和到期提醒。
