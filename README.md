# LXPanel

LXPanel 是一个从零开始搭建的轻量服务器运维面板原型，目标参考宝塔面板与 1Panel 的实用性，同时采用类似 gmssh 的思路：把远程连接类高负载能力逐步下放给本地连接器，面板服务端优先保持轻量、安全、可审计。

## 当前能力

- 管理员首次初始化，无默认密码。
- scrypt 密码哈希、HttpOnly SameSite Cookie、登录限速、会话服务端存储。
- 主机概览、进程列表、服务列表和 Linux systemd 服务动作入口。
- 主机资产：支持手动登记主机，并把未绑定的连接器自动展示为发现主机。
- Docker 状态、容器列表、镜像列表和容器启动/停止/重启动作入口。
- 应用商店基础：内置 Nginx、Redis、PostgreSQL Docker Compose 模板，支持渲染部署记录和启动/停止/重启。
- 受控文件管理：默认只允许访问配置的根目录，支持目录浏览、文本读取/保存、创建目录和删除条目。
- 受控日志目录浏览与尾部读取，适合快速排查服务日志。
- 多用户与 RBAC：`owner`、`operator`、`viewer` 三档角色。
- API Token：支持脚本、CI 和第三方系统通过 `Authorization: Bearer lxpat_...` 调用接口，Token 只展示一次明文，支持作用域选择并可撤销。
- 受控任务运行器：使用参数化命令执行维护任务，记录运行历史。
- 计划任务与自动备份：按固定间隔运行维护任务、生成面板状态快照，并支持下载、校验、二次确认恢复和保留最近 100 份快照。
- 资源告警：按 CPU、内存、磁盘阈值自动检查，保留最近告警历史，支持手动检查、确认与审计。
- 监控趋势与通知渠道：调度器采样本机资源曲线，告警可投递到 HTTP/HTTPS Webhook，并支持出站目标白名单与 URL 脱敏展示。
- 可配置状态存储：默认使用 JSON 文件，生产可切换到 SQLite，并自动从已有 `state.json` 导入初始状态。
- 连接器登记、心跳令牌与命令队列，为本地客户端分担远程连接负载预留协议。
- 轻量连接器 agent：`scripts/lxpanel-connector.mjs` 可用令牌心跳、轮询命令并在本机 allowlist 内参数化执行。
- 审计日志：支持筛选、CSV/JSONL 导出和保留清理；安全态势页结构化检查会话密钥、HTTPS Cookie、IP 白名单、备份、状态存储、Docker socket 与 SSH 配置；CI、类型检查和单元测试。

## 本地运行

```powershell
npm install
npm run build
npm run dev
```

默认 API 地址是 `http://127.0.0.1:7080`，前端地址是 `http://127.0.0.1:5173`。
如果只运行 `npm run dev:web`，需要另开终端先运行 `npm run dev:api`，否则 Vite 的 `/api` 代理会出现 `ECONNREFUSED 127.0.0.1:7080`。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `LXPANEL_HOST` | `127.0.0.1` | API 监听地址 |
| `LXPANEL_PORT` | `7080` | API 监听端口 |
| `LXPANEL_DATA_DIR` | `./data` | 状态与审计数据目录 |
| `LXPANEL_STATE_STORE` | `json` | 状态存储驱动，可选 `json` 或 `sqlite` |
| `LXPANEL_STATE_SQLITE_PATH` | `LXPANEL_DATA_DIR/lxpanel.db` | SQLite 状态库路径；也兼容 `LXPANEL_DATABASE_PATH` |
| `LXPANEL_SESSION_SECRET` | 开发默认值 | 生产环境必须设置强随机值 |
| `LXPANEL_COOKIE_SECURE` | `false` | HTTPS 部署时设为 `true` |
| `LXPANEL_ALLOWED_ORIGINS` | Vite 本地地址 | CORS 白名单，分号或逗号分隔 |
| `LXPANEL_IP_ALLOWLIST` | 空 | 面板访问源 IP 白名单，分号或逗号分隔 |
| `LXPANEL_WEBHOOK_ALLOWLIST` | 空 | Webhook 出站主机白名单，支持 `*.example.com`，为空表示不限制 |
| `LXPANEL_WEB_ROOT` | `apps/web/dist` | API 进程直接托管前端静态文件的目录 |
| `LXPANEL_FILE_ROOTS` | 当前用户主目录 | 允许文件管理器访问的根目录 |
| `LXPANEL_LOG_ROOTS` | `./data` 和系统日志目录 | 允许日志查看器访问的根目录 |

启用 SQLite 时，服务首次启动会在数据库为空且 `LXPANEL_DATA_DIR/state.json` 存在时导入旧状态文件，但不会删除原 JSON 文件，方便回滚和人工核对。Node 当前会对内置 `node:sqlite` 输出实验特性警告，生产部署建议先在预发环境验证运行时版本。

## 验证

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm run smoke
```

## 角色权限

| 角色 | 能力 |
| --- | --- |
| `owner` | 用户管理、备份、全部运维动作 |
| `operator` | 主机、应用、通知、服务/Docker 动作、任务运行、常规运维 |
| `viewer` | 只读查看概览、主机、监控、告警、文件、日志、审计等信息 |

## API Token

API Token 可在安全页创建，用于自动化调用。Token 明文只在创建时显示一次，服务端仅保存哈希；创建时可选择作用域，撤销后立即失效。

```powershell
curl.exe -H "Authorization: Bearer lxpat_xxx" http://127.0.0.1:7080/api/system/overview
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
