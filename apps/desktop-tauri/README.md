# LXPanel Desktop (Tauri MVP)

桌面托盘客户端，提供系统托盘常驻、WebView 面板入口和系统通知。

## 前置要求

- [Rust](https://rustup.rs/) (edition 2021)
- Node.js ≥ 20
- 系统依赖: [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)

## 快速开始

```bash
# 安装依赖并启动开发模式
cd apps/desktop-tauri
npm install
npm run dev
```

## 构建安装包

```bash
npm run build
# 产物位于 src-tauri/target/release/bundle/
```

## 功能范围 (MVP)

| 功能 | 状态 |
|------|------|
| 系统托盘常驻 | ✅ |
| WebView 加载面板 Web | ✅ |
| 托盘菜单：打开/关于/退出 | ✅ |
| 通知接收 | ⬜ |
| 自动更新 | ⬜ |
| Windows 代码签名 | ⬜ |
