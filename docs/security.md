# 安全基线

## 已实现

- 无默认管理员密码，首次访问必须初始化。
- 密码使用 Node 内置 `scrypt` 派生并带随机盐。
- 支持 TOTP 双因素认证，登录时只在密码校验通过后要求 6 位动态码。
- 会话 Cookie 使用 HMAC 签名，服务端只保存会话哈希。
- `owner` 可以查看活动会话并强制撤销。
- API Token 使用 `lxpat_` 前缀，服务端只保存 SHA-256 哈希，创建后明文只展示一次，调用时同时受用户角色和 Token 作用域限制，并记录最近使用时间、到期状态和即将到期提醒；平台治理接口独立使用 `platform:read`、`platform:write` 作用域。
- 审批中心保存高风险操作审批单，`backup.restore`、`audit.prune`、`security.remediate` 与 `resource.access` 必须携带已批准、未过期且未消费的审批单 ID；审批单支持配置所需批准人数，记录每次批准/驳回意见，并向通知渠道发送系统事件。平台治理页可登记资源级审批策略，后续高风险路由可统一消费。
- 登录接口有速率限制。
- 所有响应带基础安全头，写请求会校验 Origin/Fetch Metadata，降低 Cookie 认证下的 CSRF 风险。
- 可通过 `LXPANEL_IP_ALLOWLIST` 限制允许访问面板的源 IP。
- 状态备份恢复需要服务端确认短语和审批单，会先生成恢复前快照，并清空恢复后会话，避免旧快照中的会话继续有效；备份页可校验文件大小、SHA-256 和备份格式，并可把快照复制到受控文件系统或 S3 兼容远程目标，S3 secret key 加密保存。
- 数据库连接 URL 新写入时可用 `LXPANEL_SESSION_SECRET` 派生密钥加密保存，接口只返回脱敏地址；数据库备份通过参数化 dump 调用执行，支持 PostgreSQL、MySQL、MariaDB，并记录手动备份、计划备份和恢复演练结果。
- 文件目录访问、文本写入、建目录和删除均限制在 `LXPANEL_FILE_ROOTS` 内，写操作至少需要 `operator` 角色并记录审计。
- 服务控制只允许合法 systemd service 名称。
- Docker 容器动作只接受受限 ID/名称字符，至少需要 `operator` 角色，并记录审计。
- 日志查看限制在 `LXPANEL_LOG_ROOTS` 内，只读取文件尾部，避免一次性加载超大日志。
- RBAC 将用户分为 `owner`、`operator`、`viewer`，高风险动作至少需要 `operator`。
- 用户管理和备份创建仅允许 `owner`。
- 任务运行器不使用 shell 拼接，工作目录限制在 `LXPANEL_FILE_ROOTS`。
- 应用商店只允许内置 Docker Compose 模板，变量禁止换行和控制字符，动作通过参数化 `docker compose` 执行；模板展示来源、签名和验证状态，部署健康检查不会执行任意用户输入命令。
- 通知渠道仅支持 HTTP/HTTPS Webhook，创建、测试、删除均需要 `operator` 并记录审计；可通过 `LXPANEL_WEBHOOK_ALLOWLIST` 限制出站目标，接口返回会脱敏 Webhook URL，服务端状态中加密保存新渠道 URL，`owner` 可执行密钥迁移/重加密。
- 主机资产写操作需要 `operator`，viewer 只能只读查看。
- 审计日志记录登录、初始化、连接器创建、审批和服务动作，新写入事件带哈希链字段，并支持筛选、分页查询、CSV/JSONL 导出、签名 manifest 包、完整性校验、合规统计和带审批的按保留天数清理。
- 安全态势页输出结构化检查项，覆盖会话密钥、HTTPS Cookie、IP 白名单、状态存储、备份、Docker socket 和 SSH 基础配置，并提供防火墙访问网段、SSH 密码/root 登录、Docker socket 权限边界的加固计划。
- 安全态势页会检查 API Token 到期风险，提示已过期、7 天内到期或未设置到期时间的自动化密钥。
- 主机组、批量命令、SSH 会话请求和 Web 终端代理都通过连接器命令队列排队，连接器 agent 默认只执行 allowlist 中的命令，使用 `execFile` 参数数组，不通过 shell 拼接；连接器心跳上报的监控指标只写入数值样本，不接受任意执行载荷。
- 平台许可证和模板仓库当前用于商业治理和交付记录，生产强校验应进一步接入离线签名验签与模板索引签名校验。
- 平台治理页的自动化安全修复默认支持 dry-run 记录，实际高风险修复应配合审批单和连接器 allowlist 执行。

## 生产部署要求

1. 设置强随机 `LXPANEL_SESSION_SECRET`。
2. 放在 HTTPS 反向代理后，并设置 `LXPANEL_COOKIE_SECURE=true`。
3. 明确配置 `LXPANEL_ALLOWED_ORIGINS`。
4. 将 `LXPANEL_FILE_ROOTS` 收敛到必要目录。
5. 将 `LXPANEL_LOG_ROOTS` 收敛到必要日志目录。
6. 配置 `LXPANEL_IP_ALLOWLIST`，只允许管理网络访问。
7. 使用独立低权限用户运行 API 服务，谨慎授予 Docker socket 权限。
8. Webhook URL 可能包含令牌，应限制可配置人员，配置 `LXPANEL_WEBHOOK_ALLOWLIST`，并优先使用内网通知入口；更换 `LXPANEL_SESSION_SECRET` 后应在通知页输入旧密钥执行密钥迁移/重加密。
9. 使用应用商店前确认 Docker socket 权限边界，生产环境建议只开放给可信 operator。
10. API Token 应设置合理有效期，并保存在 CI/自动化系统的密钥管理中；安全页出现即将到期或已过期提醒时应及时轮换，泄露后立即撤销。
11. 对备份恢复和审计清理使用短有效期审批单，生产环境建议配置至少两人审批，操作完成后确认审批单已变为 `used`。
12. 恢复备份前先执行备份校验，生产恢复前仍建议离线复制备份文件，并配置至少一个远程备份目标。
13. 数据库连接 URL 属于高敏感信息，生产环境必须设置强 `LXPANEL_SESSION_SECRET`，限制数据库管理页访问角色，并定期执行计划备份和恢复演练确认备份可用。
14. S3 兼容备份目标应使用最小权限访问密钥，仅允许写入指定 bucket/prefix，必要时单独配置生命周期和不可变保留。
15. 连接器 agent 运行账号应使用最小权限，并将 `LXPANEL_CONNECTOR_ALLOW_COMMANDS` 收敛到真实需要的命令集合。
16. 资源访问策略和资源审批策略上线前应先用平台治理页的访问评估验证 owner、operator、viewer 和自动化 Token 的实际授权。
17. Web 终端代理只应开放给可信 operator，并通过连接器 allowlist 限制 `terminal.open`、`terminal.input`、`terminal.close` 的实际处理逻辑。

## 后续强化

- 资源级审批策略强制执行和审批单二次确认。
- 连接器端到端命令签名。
- API Token 创建时二次确认和到期通知。
- 审计导出压缩包和第三方验签工具。
- WebSocket 终端交互通道的最小权限隔离。
- 商业许可证和模板仓库的离线签名验签。
