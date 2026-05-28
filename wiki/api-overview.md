# API 概览

## 认证

LXPanel 支持两种认证方式：

1. **Cookie（浏览器）**: 登录后服务端设置 HttpOnly Session Cookie。
2. **Bearer Token（脚本/CI）**: `Authorization: Bearer lxpat_xxx`。

## 常用端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |
| GET | `/api/auth/status` | 当前会话状态 |
| GET | `/api/users` | 用户列表 |
| GET | `/api/hosts` | 主机列表 |
| GET | `/api/monitoring/samples` | 监控样本 |
| GET | `/api/audit/events` | 审计事件 |

## OpenAPI 文档

启动服务后访问 `/api/docs` 可查看 Swagger UI。

完整 OpenAPI JSON 位于 `/api/platform/openapi.json`。
