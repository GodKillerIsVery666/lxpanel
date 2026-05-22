# 架构说明

LXPanel 首版采用 npm workspaces 管理三块代码：

- `apps/api`：Fastify API 服务，负责认证、RBAC、审计、系统信息、Docker、日志、任务、备份、文件目录与连接器协议。
- `apps/web`：Vite + React 前端，负责面板交互与状态展示。
- `packages/shared`：Zod Schema 与共享类型，确保前后端契约一致。

## 设计原则

1. 面板服务端只做必要控制面，避免把远程 SSH 和长时间任务全部压在中心服务上。
2. 外部命令使用 `execFile` 参数数组调用，禁止 shell 拼接。
3. 文件管理器必须经过受控根目录解析，默认只读目录列表。
4. 所有高风险操作进入审计日志，后续扩展到数据库与不可篡改日志。
5. Docker 管理只通过 `execFile` 调用参数化 CLI，不拼接 shell 命令；未安装或 daemon 不可用时返回状态而不是阻塞面板。
6. 日志查看与文件管理分离，日志根目录由 `LXPANEL_LOG_ROOTS` 独立收敛。
7. 任务运行器只使用 `execFile` 参数数组，并把工作目录限制在 `LXPANEL_FILE_ROOTS` 内。
8. 备份模块生成本地状态快照，备份文件保存在 `LXPANEL_DATA_DIR/backups`，默认保留最近 100 份并清理旧文件；恢复前会自动生成当前状态快照，恢复后清空会话。
9. 调度器随 API 进程启动，按状态中的计划触发受控任务和自动备份，执行结果写入运行历史与审计日志。
10. 生产部署提供 systemd、Docker Compose、Nginx 模板和独立低权限用户，面板本体默认只监听本机地址。
11. API 进程可直接托管 `apps/web/dist`，也可放在 Nginx 后面作为纯 API 服务。

## 连接器方向

连接器使用一次性可见令牌登记，后续通过 Bearer Token 心跳。远程连接、SSH 会话和批量任务可以由本地连接器执行，面板只负责授权、编排和展示结果。
