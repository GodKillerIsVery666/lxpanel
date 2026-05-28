# LXPanel v1.0 部署文档

## 系统要求

| 组件 | 最低配置 | 推荐配置 |
|------|----------|----------|
| CPU | 1 核 | 2 核 |
| 内存 | 512MB | 2GB |
| 磁盘 | 1GB 可用 | 10GB |
| Node.js | 20.x | 24.x |
| 数据库 (可选) | SQLite | PostgreSQL 16+ |

## 快速安装 (Docker)

```bash
# 1. 创建数据目录
mkdir -p /opt/lxpanel/data

# 2. 启动
docker compose -f deploy/compose.yml up -d

# 3. 访问 http://localhost:7080
```

## Docker Compose 配置

参考 `deploy/compose.yml`，支持以下环境变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `LXPANEL_PORT` | `7080` | API 监听端口 |
| `LXPANEL_SESSION_SECRET` | `dev-...` | **生产必须修改** |
| `LXPANEL_DATA_DIR` | `./data` | 状态存储目录 |
| `LXPANEL_STATE_STORE` | `json` | 状态存储驱动 (`json` / `sqlite`) |
| `LXPANEL_ALLOWED_ORIGINS` | `http://localhost:5173` | CORS 允许源 |
| `LXPANEL_LOG_LEVEL` | `info` | 日志级别 |
| `LXPANEL_REDIS_URL` | (空) | Redis 缓存 URL (可选) |

## Kubernetes (Helm)

```bash
# 添加仓库
helm repo add lxpanel https://charts.lxpanel.io

# 安装
helm install lxpanel lxpanel/lxpanel \
  --set sessionSecret="your-strong-secret" \
  --set persistence.enabled=true

# 查看状态
kubectl get pods -l app.kubernetes.io/name=lxpanel
```

## 裸机安装

```bash
# 1. 下载发布包
wget https://github.com/your-org/lxpanel/releases/latest/download/lxpanel.tar.gz
tar xzf lxpanel.tar.gz
cd lxpanel

# 2. 安装依赖
npm ci --production

# 3. 配置环境变量
cp deploy/lxpanel.env.example .env
# 编辑 .env，设置 LXPANEL_SESSION_SECRET 等

# 4. 初始化并启动
npm run build
NODE_ENV=production node apps/api/dist/server.js &

# 5. 配置反向代理 (Nginx)
# 参考 deploy/nginx/
```

## 升级

```bash
# 1. 备份当前状态
cp data/state.json data/state.json.bak

# 2. 停止服务
systemctl stop lxpanel

# 3. 解压新版本
tar xzf lxpanel-v1.0.0.tar.gz -C /opt/lxpanel --strip-components=1

# 4. 运行迁移
node scripts/migrate-state.mjs

# 5. 启动服务
systemctl start lxpanel
```

## 故障排除

| 问题 | 排查步骤 |
|------|----------|
| API 无法启动 | 检查 `LXPANEL_PORT` 是否被占用，`lsof -i :7080` |
| 状态文件损坏 | 恢复备份 `data/state.json.bak` |
| OIDC 登录失败 | 检查 `jwksUri` 和 `clientSecret` 配置 |
| 连接器离线 | 检查连接器 Token 和网络连通性 |
| 数据库备份失败 | 确认 pg_dump/mysqldump 已安装 |

## 健康检查端点

```
GET /api/health      -> 应用基本信息
GET /api/health/live -> 存活探针 (始终 200)
GET /api/health/ready -> 就绪探针 (检查 data 目录可写)
```
