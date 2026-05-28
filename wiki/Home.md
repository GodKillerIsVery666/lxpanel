# LXPanel 维基

欢迎来到 LXPanel 维基！这里包含架构、部署、开发和使用指南。

## 快速导航

- [架构概览](architecture)
- [快速开始](getting-started)
- [部署指南](deployment-guide)
- [API 概览](api-overview)
- [连接器配置](connector-setup)

## 项目简介

LXPanel 是一个轻量服务器运维面板，目标参考宝塔面板与 1Panel 的实用性，同时采用连接器架构把远程负载下放给本地 agent。

## 技术栈

- **后端**: TypeScript + Fastify + Zod
- **前端**: TypeScript + React + Vite
- **状态存储**: JSON 文件 / SQLite
- **桌面客户端**: Tauri
- **连接器 agent**: Node.js
