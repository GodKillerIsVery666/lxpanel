# 架构说明

LXPanel 首版采用 npm workspaces 管理三块代码：

- `apps/api`：Fastify API 服务，负责认证、RBAC、审计、系统信息、Docker、日志、任务、备份、文件目录与连接器协议。
- `apps/web`：Vite + React 前端，负责面板交互与状态展示。
- `packages/shared`：Zod Schema 与共享类型，确保前后端契约一致。

## 设计原则

1. 面板服务端只做必要控制面，避免把远程 SSH 和长时间任务全部压在中心服务上。
2. 外部命令使用 `execFile` 参数数组调用，禁止 shell 拼接。
3. 文件管理器必须经过受控根目录解析，支持目录列表、文本文件读写、建目录和删除；写操作进入审计日志。
4. 所有高风险操作进入审计日志，后续扩展到数据库与不可篡改日志。
5. Docker 管理只通过 `execFile` 调用参数化 CLI，不拼接 shell 命令；未安装或 daemon 不可用时返回状态而不是阻塞面板。
6. 日志查看与文件管理分离，日志根目录由 `LXPANEL_LOG_ROOTS` 独立收敛。
7. 连接器命令队列由面板写入、连接器领取并回传结果，避免面板主进程直接承担远程连接执行负载。
8. 任务运行器只使用 `execFile` 参数数组，并把工作目录限制在 `LXPANEL_FILE_ROOTS` 内。
9. 备份模块生成本地状态快照，备份文件保存在 `LXPANEL_DATA_DIR/backups`，默认保留最近 100 份并清理旧文件；恢复接口必须携带确认短语和审批单，恢复前会自动生成当前状态快照，恢复后清空会话。
10. 调度器随 API 进程启动，按状态中的计划触发受控任务和自动备份，执行结果写入运行历史与审计日志。
11. 生产部署提供 systemd、Docker Compose、Nginx 模板和独立低权限用户，面板本体默认只监听本机地址。
12. API 进程可直接托管 `apps/web/dist`，也可放在 Nginx 后面作为纯 API 服务。
13. 状态存储通过 `StateStore` 接口隔离，默认 JSON 文件便于开发和小型部署，生产可用 SQLite KV 存储；SQLite 启用时会从 legacy `state.json` 导入初始状态并保留原文件。
14. 资源告警通过调度器周期检查 CPU、内存和磁盘阈值，告警历史保存在面板状态内并进入审计日志，避免只在前端临时展示风险。
15. 主机资产独立于连接器状态保存，未绑定连接器会作为发现主机展示，便于从单机面板过渡到多主机管理。
16. 监控样本和通知投递记录随状态保存，调度器负责采样、告警、通知投递三段闭环。
17. 应用商店使用受控 Docker Compose 模板，不接受任意 YAML 输入；模板变量经过校验后写入 `LXPANEL_DATA_DIR/apps` 下的 compose 文件，再通过参数化 `docker compose` 命令执行动作。
18. API Token 复用认证中间件的 RBAC 判断，自动化请求通过 Bearer Token 进入同一套接口权限模型。
19. 安全态势接口输出结构化检查项，前端直接展示检查状态和建议，避免把生产风险只写在文档里。
20. API Token 在认证后会按路由映射校验作用域；Cookie 会话仍走原角色模型，自动化请求额外受 scope 约束。Token 列表会派生正常、即将到期和已过期状态，安全态势会提示到期风险。
21. Webhook 通知服务在创建、更新和投递前校验出站主机白名单，列表接口只返回脱敏 URL，新渠道 URL 使用会话密钥派生密钥后加密保存。
22. 审计日志支持结构化查询、CSV/JSONL 导出和按保留天数压缩写回。
23. 审批中心独立于具体业务模块保存审批单，高风险路由通过一次性消费审批单完成准入校验。
24. 备份校验会读取快照文件并检查大小、SHA-256、备份包格式和状态字段，恢复解析会保留后续新增的状态域。

## 状态存储

所有核心状态通过 `StateStore<PanelState>` 读写，认证、连接器、任务和备份模块只依赖接口，不直接关心底层介质。

- `JsonStore`：写入 `LXPANEL_DATA_DIR/state.json`，使用临时文件和 rename 保持单文件写入原子性。
- `SqliteStateStore`：写入 `LXPANEL_STATE_SQLITE_PATH`，启用 WAL，并在 `kv` 表中保存 `state` JSON 文档。这样先获得 SQLite 的文件锁、WAL 和后续迁移基础，同时保持备份恢复语义稳定。
- 迁移策略：当 `LXPANEL_STATE_STORE=sqlite` 且数据库尚无状态时，读取 legacy `state.json` 作为 seed，不删除原文件。

## 连接器方向

连接器使用一次性可见令牌登记，后续通过 Bearer Token 心跳、领取命令和回传结果。`scripts/lxpanel-connector.mjs` 是内置轻量 agent 参考实现，会心跳、轮询命令、使用 `execFile` 参数数组执行 allowlist 内命令并回传输出。远程连接、SSH 会话和批量任务可以由本地连接器执行，面板只负责授权、编排和展示结果。

## 资源告警

告警模块由 `AlertService` 负责阈值配置、当前资源检查、冷却窗口去重和告警确认。默认阈值为 CPU/内存 80% 警告、95% 严重，磁盘 85% 警告、95% 严重。调度器每轮 tick 会调用告警检查，新告警写入状态并追加审计事件；operator 以上角色可修改阈值、手动检查和确认告警，viewer 可只读查看历史。

## 监控与通知

`MonitoringService` 每分钟保留一条本机资源样本，最近 1440 条样本随状态存储，用于前端展示趋势曲线。`NotificationService` 目前支持 HTTP/HTTPS Webhook，按告警级别过滤投递，并保存最近 300 条投递记录；调度器会在产生新告警后自动调用通知服务。Webhook URL 新写入时加密保存，旧明文状态保持兼容读取。

## 应用商店

`AppStore` 暴露模板列表、部署记录和部署动作。首批模板覆盖 Nginx、Redis、PostgreSQL，部署时只渲染内置模板变量，生成的 `docker-compose.yml` 落在数据目录下。启动、停止、重启统一调用 `docker compose -f <composePath> ...` 参数数组，并把执行结果写回部署记录和审计日志。

## 自动化访问

API Token 由 `AuthStore` 生成并保存在 `PanelState.apiTokens` 中，状态内只保存哈希、归属用户、角色快照、创建时间、过期时间和最近使用时间。认证中间件先尝试 Cookie 会话，再尝试 `Authorization: Bearer lxpat_...`；Token 成功认证后返回的用户角色不会高于当前用户角色，避免用户降权后旧 Token 继续拥有旧权限。Token 到期状态由读取时派生，不写回状态文件；过期 Token 会拒绝认证，7 天内到期或未设置有效期的 Token 会进入安全巡检提醒。
