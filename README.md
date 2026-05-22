# LXPanel

LXPanel 是一个从零开始搭建的轻量服务器运维面板原型，目标参考宝塔面板与 1Panel 的实用性，同时采用类似 gmssh 的思路：把远程连接类高负载能力逐步下放给本地连接器，面板服务端优先保持轻量、安全、可审计。

## 当前能力

- 管理员首次初始化，无默认密码。
- scrypt 密码哈希、HttpOnly SameSite Cookie、登录限速、会话服务端存储。
- 主机概览、进程列表、服务列表和 Linux systemd 服务动作入口。
- 受控文件目录浏览，默认只允许访问配置的根目录。
- 连接器登记与心跳令牌，为本地客户端分担远程连接负载预留协议。
- 审计日志、安全态势页、CI、类型检查和单元测试。

## 本地运行

```powershell
npm install
npm run build
npm run dev:api
npm run dev:web
```

默认 API 地址是 `http://127.0.0.1:7080`，前端地址是 `http://127.0.0.1:5173`。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `LXPANEL_HOST` | `127.0.0.1` | API 监听地址 |
| `LXPANEL_PORT` | `7080` | API 监听端口 |
| `LXPANEL_DATA_DIR` | `./data` | 状态与审计数据目录 |
| `LXPANEL_SESSION_SECRET` | 开发默认值 | 生产环境必须设置强随机值 |
| `LXPANEL_COOKIE_SECURE` | `false` | HTTPS 部署时设为 `true` |
| `LXPANEL_ALLOWED_ORIGINS` | Vite 本地地址 | CORS 白名单，分号或逗号分隔 |
| `LXPANEL_FILE_ROOTS` | 当前用户主目录 | 允许文件管理器访问的根目录 |

## 验证

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm run smoke
```

## 文档

- [docs/architecture.md](docs/architecture.md)
- [docs/security.md](docs/security.md)
- [docs/roadmap.md](docs/roadmap.md)
