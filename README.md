# LXPanel

LXPanel 是一个从零开始搭建的轻量服务器运维面板原型，目标参考宝塔面板与 1Panel 的实用性，同时采用类似 gmssh 的思路：把远程连接类高负载能力逐步下放给本地连接器，面板服务端优先保持轻量、安全、可审计。

## 当前能力

- 管理员首次初始化，无默认密码。
- scrypt 密码哈希、HttpOnly SameSite Cookie、登录限速、会话服务端存储。
- 主机概览、进程列表、服务列表和 Linux systemd 服务动作入口。
- 主机资产：支持手动登记主机、主机组、标签目标、连接器批量命令和 SSH 会话命令排队，并把未绑定的连接器自动展示为发现主机。
- Docker 状态、容器列表、镜像列表和容器启动/停止/重启动作入口。
- 应用商店基础：内置 Nginx、Redis、PostgreSQL Docker Compose 模板，展示模板来源、签名和验证状态，支持私有模板仓库 index 拉取、签名验签、模板导入、渲染部署记录、启动/停止/重启、变量升级、健康检查和上一版本回滚。
- 受控文件管理：默认只允许访问配置的根目录，支持目录浏览、文本读取/保存、创建目录和删除条目。
- 受控日志目录浏览与尾部读取，适合快速排查服务日志。
- 多用户与 RBAC：`owner`、`operator`、`viewer` 三档角色。
- API Token：支持脚本、CI 和第三方系统通过 `Authorization: Bearer lxpat_...` 调用接口，Token 只展示一次明文，支持作用域选择、到期状态提醒并可撤销，已覆盖数据库、平台治理等读写作用域。
- 审批中心：备份恢复、审计清理等高风险操作必须消费已批准、未过期、一次性使用的审批单；支持多级审批阈值和系统事件通知。
- 受控任务运行器：使用参数化命令执行维护任务，记录运行历史。
- 计划任务与自动备份：按固定间隔运行维护任务、生成面板状态快照，并支持下载、SHA-256 完整性校验、带审批恢复、远程文件系统/S3 兼容对象存储同步和保留最近 100 份快照。
- 数据库管理：登记 PostgreSQL、MySQL、MariaDB 连接，服务端加密保存连接 URL，前端只显示脱敏地址，并提供手动备份、计划备份、备份保留天数、过期 dump 清理和恢复演练入口。
- 资源告警：按 CPU、内存、磁盘阈值自动检查，保留最近告警历史，支持手动检查、确认、静默窗口、Prometheus exporter 与审计。
- 监控趋势与通知渠道：调度器采样本机资源曲线，告警可投递到 HTTP/HTTPS Webhook，并支持出站目标白名单、URL 脱敏展示、服务端加密保存和密钥迁移/重加密。
- 可配置状态存储：默认使用 JSON 文件，生产可切换到 SQLite，并自动从已有 `state.json` 导入初始状态。
- 连接器登记、心跳令牌与命令队列：面板下发命令会附带 HMAC-SHA256 签名，内置 agent 领取后验签，回传结果也会签名，降低中间人篡改和错连风险。
- 连接器版本治理：agent 心跳会上报版本，平台可计算最低支持版本、推荐版本、灰度通道和升级目标，并可按连接器或 rollout 比例排队 `agent.upgrade` 控制命令。
- 连接器发行治理：平台输出 stable/candidate 发行通道、制品 URL、SHA-256、签名标记、manifest SHA-256 和安装校验命令，为 agent 灰度升级和离线交付提供可核对清单。
- 轻量连接器 agent：`scripts/lxpanel-connector.mjs` 可用令牌心跳、上报远端主机指标、轮询命令、验签、响应升级控制命令并在本机 allowlist 内参数化执行。
- 审计日志：支持筛选、分页查询、CSV/JSONL 导出、签名 manifest 包、tar 签名包下载、哈希链完整性校验、合规统计、细粒度保留策略评估和带审批的保留清理；安全态势页结构化检查会话密钥、HTTPS Cookie、IP 白名单、备份、状态存储、Docker socket 与 SSH 配置，并提供防火墙、SSH、Docker socket 加固计划；CI、类型检查、单元测试和 E2E smoke。
- 备份加密与密钥轮换：可在平台治理中启用 AES-256-GCM 状态快照加密，备份记录保存算法、provider 和 keyVersion，校验/恢复会自动解密并验证 SHA-256；平台提供密钥轮换计划和版本提升接口。
- 企业身份与 OIDC 完整登录闭环：平台治理支持 OIDC 身份源配置、授权 URL 生成、state 签名校验、code flow callback、id_token claim 验证、用户自动创建/更新（含 email/displayName/externalSubject）、域名白名单和默认角色分配，以及本地 owner break-glass 保留。
- 连接器多平台制品流水线：`npm run package:connectors` 为 win32-x64/linux-x64/darwin-arm64 生成 tar.gz 包，附带 HMAC-SHA256 签名、SHA256SUMS 校验文件和 GitHub release 风格的 manifest.json，与 `package:release` 和 `diagnose:release` 衔接。
- 数据库 dump 加密：启用备份加密策略后，数据库备份 dump 以 AES-256-GCM 加密 envelope 写入，备份记录保存算法、provider 和 keyVersion，恢复演练会临时解密再运行，所有临时文件在完成后清理。
- 审计保留执行编排：平台提供执行 API，dry-run 模式预览可清理事件和归档包，审批后自动执行 `auditLog.prune` 和归档导出，返回标准化执行报告。
- 插件沙箱运行时：沙箱 API 返回禁止网络/文件系统/服务端直接访问的约束，超时控制在毫秒级，执行结果和 scope 评估写审计链。
- 桌面/移动客户端评估：`GET /api/platform/client-application-plan` 输出现行客户端形态和 Tauri/PWA 候选方案的成本与风险分析。
- 平台治理：提供多租户工作空间、租户级报表导出、资源级访问策略、资源审批强制执行与可视化预检、WebSocket 终端流式通道、终端审计回放、模板仓库导入验签与快照回滚、许可证离线验签与租户配额、内置离线许可证签发脚本、自动化安全修复 dry-run、SQLite 状态归档查询、容量计划、升级向导、高可用部署计划、离线安装向导、诊断包、SDK 示例、前端可访问性/国际化检查和覆盖全部业务路由的 OpenAPI 3.1 JSON/Webhook 摘要；OpenAPI 路径包含 requestBody、query 参数、错误模型和关键响应 schema。
- 易用性体验：侧边栏按场景分组，支持功能搜索、可执行动作的全局命令面板、收藏入口、最近访问、页面记忆、语言、表格密度和列显示偏好；Shell、导航、平台、主机、应用、备份、数据库、安全和审计关键页面已接入中英文资源，主机、应用部署、备份、数据库、安全和审计等大列表支持搜索、排序、虚拟滚动和列配置。

## 本地运行

```powershell
npm install
npm run build
npm run dev
```

默认 API 地址是 `http://127.0.0.1:7080`，前端地址是 `http://127.0.0.1:5173`。
如果只运行 `npm run dev:web`，需要另开终端先运行 `npm run dev:api`，否则 Vite 的 `/api` 代理会出现 `ECONNREFUSED 127.0.0.1:7080`。

## 客户端形态

当前 LXPanel 有浏览器 Web 客户端，由 `apps/web` 构建并可由 API 进程直接托管；还没有独立桌面客户端或移动 App。`scripts/lxpanel-connector.mjs` 是部署在受管服务器上的轻量连接器 agent，用于心跳、命令领取、终端代理和升级控制，不是用户桌面客户端。后续若要做 Electron/Tauri 桌面端或移动端，可以复用现有 OpenAPI、Cookie/API Token 权限模型和平台治理接口。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `LXPANEL_HOST` | `127.0.0.1` | API 监听地址 |
| `LXPANEL_PORT` | `7080` | API 监听端口 |
| `LXPANEL_DATA_DIR` | `./data` | 状态与审计数据目录 |
| `LXPANEL_STATE_STORE` | `json` | 状态存储驱动，可选 `json` 或 `sqlite` |
| `LXPANEL_STATE_SQLITE_PATH` | `LXPANEL_DATA_DIR/lxpanel.db` | SQLite 状态库路径；也兼容 `LXPANEL_DATABASE_PATH` |
| `LXPANEL_SESSION_SECRET` | 开发默认值 | 生产环境必须设置强随机值；同时用于派生通知 URL、远程备份密钥和加密状态备份的本地密钥 |
| `LXPANEL_COOKIE_SECURE` | `false` | HTTPS 部署时设为 `true` |
| `LXPANEL_ALLOWED_ORIGINS` | Vite 本地地址 | CORS 白名单，分号或逗号分隔 |
| `LXPANEL_IP_ALLOWLIST` | 空 | 面板访问源 IP 白名单，分号或逗号分隔 |
| `LXPANEL_WEBHOOK_ALLOWLIST` | 空 | Webhook 出站主机白名单，支持 `*.example.com`，为空表示不限制 |
| `LXPANEL_WEB_ROOT` | `apps/web/dist` | API 进程直接托管前端静态文件的目录 |
| `LXPANEL_FILE_ROOTS` | 当前用户主目录 | 允许文件管理器访问的根目录 |
| `LXPANEL_LOG_ROOTS` | `./data` 和系统日志目录 | 允许日志查看器访问的根目录 |

启用 SQLite 时，服务首次启动会在数据库为空且 `LXPANEL_DATA_DIR/state.json` 存在时导入旧状态文件，但不会删除原 JSON 文件，方便回滚和人工核对。Node 当前会对内置 `node:sqlite` 输出实验特性警告，生产部署建议先在预发环境验证运行时版本。

通知 Webhook URL、远程备份访问密钥和启用策略后的状态备份会用 `LXPANEL_SESSION_SECRET` 派生密钥保护。旧版本明文通知渠道仍可读取；通知页提供密钥迁移/重加密操作，生产环境更换会话密钥后可输入旧密钥把已有渠道重加密到当前密钥。

## 验证

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm run smoke
npm run e2e
npm run diagnose:release -- --json
npm run license:issue -- --help
```

升级旧状态文件时可先备份并补齐新增字段：

```powershell
node scripts/migrate-state.mjs data/state.json
```

## 角色权限

| 角色 | 能力 |
| --- | --- |
| `owner` | 用户管理、备份、全部运维动作 |
| `operator` | 主机、应用、通知、服务/Docker 动作、任务运行、常规运维 |
| `viewer` | 只读查看概览、主机、监控、告警、文件、日志、审计等信息 |

## API Token

API Token 可在安全页创建，用于自动化调用。Token 明文只在创建时显示一次，服务端仅保存哈希；创建时可选择作用域，安全页会标记正常、即将到期和已过期状态，撤销后立即失效。

```powershell
curl.exe -H "Authorization: Bearer lxpat_xxx" http://127.0.0.1:7080/api/system/overview
```

## 审批中心

审批页可创建 `backup.restore`、`audit.prune`、`security.remediate` 和 `resource.access` 审批单。审批单到期后不可使用，达到要求批准人数后只能消费一次；备份恢复的审批目标是备份 ID，审计清理的审批目标是保留天数字符串，例如 `30d`。平台治理页可登记资源级审批策略，数据库备份、主机批量命令和应用高风险动作会按策略强制消费 `resource.access` 审批单，目标格式为 `workspace:resourceType:resourceId:action`。

## 备份恢复

备份页支持对快照执行完整性校验，检查文件大小、SHA-256、备份格式和状态字段。启用备份加密策略后，本地状态快照以 AES-256-GCM 加密写入，校验和恢复会使用当前密钥解密并继续验证格式。恢复会保留用户、Token、连接器、任务、告警、静默规则、主机组、监控、通知、应用部署、远程备份目标、数据库连接、资源策略、安全修复、商业治理配置和审批等状态字段，但会清空会话。远程目标支持文件系统路径和 S3 兼容对象存储，同步时会复制快照并写入 `.sha256` 校验文件。

## 平台治理

平台页面面向商业交付场景，集中展示工作空间、租户报表、连接器版本策略、发行清单、灰度升级计划、企业 SSO 就绪度、备份加密与密钥轮换、审计保留策略、插件权限评估、高可用计划、资源级访问策略、资源审批策略与预检、WebSocket 终端流、终端回放、模板仓库验签导入与回滚、许可证验签与配额、审计完整性、签名包下载、合规统计、安全修复 dry-run、状态归档与查询、数据库备份清理、容量建议、升级前检查、离线安装向导、诊断包、SDK 示例、前端质量清单和 OpenAPI/Webhook 事件摘要。`owner` 与 `operator` 可使用治理写接口，自动化调用需要 `platform:read` 或 `platform:write` 作用域。

离线许可证可通过本地脚本签发：

```powershell
npm run license:issue -- --private-key .\license.key --licensed-to Acme --plan team --machine-code xxxx --expires-at 2027-01-01T00:00:00.000Z
```

## Linux 服务安装

```sh
npm ci
npm run build
sudo sh scripts/install-linux.sh
```

安装脚本会创建 `lxpanel` 系统用户、`/var/lib/lxpanel` 数据目录、`/etc/lxpanel/lxpanel.env` 和 systemd 服务模板。首次启动前必须编辑 `LXPANEL_SESSION_SECRET`、`LXPANEL_ALLOWED_ORIGINS`、`LXPANEL_IP_ALLOWLIST` 等生产配置。

## Docker Compose

```sh
cd deploy
docker compose up -d --build
```

Compose 模板默认把 API 和前端放在同一个容器内运行，并持久化 `/var/lib/lxpanel`。生产环境务必替换 `LXPANEL_SESSION_SECRET`，并按管理网络配置 `LXPANEL_IP_ALLOWLIST`。

## 连接器 Agent

在面板的连接器页创建令牌后，可在目标主机运行轻量 agent。默认只允许 `hostname`、`uptime`、`whoami`，需要远程 SSH/运维命令时通过 allowlist 显式放行。
连接器心跳可附带 `metrics` 字段上报远端主机 CPU、内存、磁盘样本；平台终端代理会通过 `terminal.open`、`terminal.input`、`terminal.close` 命令交给连接器执行，浏览器侧可连接 `/api/platform/terminal-sessions/ws` 接收会话快照和输出广播。命令领取响应包含 `signaturePayload` 与 `signature`，内置 agent 会用令牌派生的 HMAC 密钥校验后再执行，并对结果回传签名。

离线交付或客户现场可生成自诊断报告：

```powershell
npm run diagnose:release -- --output release\diagnostics.json
```

```powershell
$env:LXPANEL_URL="http://127.0.0.1:7080"
$env:LXPANEL_CONNECTOR_TOKEN="创建连接器时显示的一次性令牌"
$env:LXPANEL_CONNECTOR_ALLOW_COMMANDS="hostname;uptime;whoami;ssh"
node scripts/lxpanel-connector.mjs
```

## 发布包

```sh
npm run build
npm run package:release
```

发布包会输出到 `release/lxpanel-<version>.tar.gz`，旁边生成 `.sha256` 校验文件。Nginx 反向代理示例位于 `deploy/nginx/lxpanel.conf`。

## 文档

- [docs/architecture.md](docs/architecture.md)
- [docs/security.md](docs/security.md)
- [docs/roadmap.md](docs/roadmap.md)
