# 架构概览

## 系统架构

```mermaid
graph TB
    subgraph Browser["浏览器 / Tauri 桌面端"]
        Web["React 前端 (Vite)"]
    end

    subgraph Server["面板服务器"]
        API["Fastify API 服务"]
        State["状态存储 (JSON/SQLite)"]
        Scheduler["调度器"]
        Audit["审计日志"]
    end

    subgraph Connector["受管服务器"]
        Agent["lxpanel-connector agent"]
        Docker["Docker 容器"]
        System["系统指标"]
    end

    Browser -->|HTTP/WebSocket| API
    API --> State
    API --> Audit
    API -->|命令队列| Agent
    Agent -->|心跳 + 指标| API
    Scheduler -->|定时任务| API
```

## 核心模块

| 模块 | 职责 |
|------|------|
| `apps/api` | Fastify HTTP 服务，提供 REST API 和静态文件托管 |
| `apps/web` | React 前端工作台 |
| `apps/desktop-tauri` | Tauri 桌面托盘客户端 |
| `packages/shared` | 前后端共享的类型定义 |
| `scripts/lxpanel-connector.mjs` | 受管服务器上的轻量 agent |

## 数据流

1. 用户通过浏览器或桌面客户端访问面板。
2. API 服务处理请求，读写状态存储和审计日志。
3. 连接器 agent 定期心跳上报指标、领取命令。
4. 调度器在后台执行计划任务（备份、归档、告警检查）。
