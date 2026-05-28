# 快速开始

## Docker 部署（推荐）

```bash
# 克隆仓库
git clone https://github.com/GodKillerIsVery666/lxpanel.git
cd lxpanel

# 使用 Docker Compose 启动
docker compose -f deploy/compose.yml up -d
```

访问 `http://localhost:7080` 即可。

## 源码运行

```bash
# 安装依赖
npm install

# 构建
npm run build

# 启动开发服务
npm run dev
```

默认 API 地址 `http://127.0.0.1:7080`，前端 Vite 开发地址 `http://127.0.0.1:5173`。

## 离线安装

参考 `docs/deployment.md` 的离线安装章节。

## 首次使用

1. 打开面板地址，进入初始化页面。
2. 设置管理员账号密码。
3. 开始使用。
