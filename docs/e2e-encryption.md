# 端到端加密通信

面板与连接器之间的通信目前基于 HMAC-SHA256 签名，为满足更高安全等级的需求，可升级为 mTLS 或 Noise 协议。

## mTLS（双向 TLS）

### 架构
```
面板 (API Server)  ← mTLS → 连接器 (Agent)
  │                          │
  ├ 服务端证书                ├ 客户端证书
  └ CA 签名                  └ CA 签名
```

### 配置步骤

1. **生成 CA 证书**
```bash
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 -out ca.crt \
  -subj "/CN=LXPanel Internal CA"
```

2. **签发面板服务端证书**
```bash
openssl genrsa -out panel.key 2048
openssl req -new -key panel.key -out panel.csr -subj "/CN=lxpanel-server"
openssl x509 -req -in panel.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out panel.crt -days 365 -sha256
```

3. **签发连接器客户端证书**
```bash
openssl genrsa -out connector.key 2048
openssl req -new -key connector.key -out connector.csr -subj "/CN=connector-1"
openssl x509 -req -in connector.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out connector.crt -days 365 -sha256
```

4. **面板端配置** (`LXPANEL_` 环境变量)
```env
LXPANEL_TLS_ENABLED=true
LXPANEL_TLS_CERT=./certs/panel.crt
LXPANEL_TLS_KEY=./certs/panel.key
LXPANEL_TLS_CA=./certs/ca.crt
LXPANEL_TLS_REQUIRE_CLIENT_CERT=true
```

5. **连接器端配置**
```env
LXPANEL_CONNECTOR_TLS_CERT=./certs/connector.crt
LXPANEL_CONNECTOR_TLS_KEY=./certs/connector.key
LXPANEL_CONNECTOR_TLS_CA=./certs/ca.crt
```

## Noise 协议（轻量替代方案）

对于资源受限的环境，可以使用 Noise 协议替代 mTLS：

- **协议**: Noise_XX_25519_AESGCM_SHA256
- **密钥交换**: Curve25519 ECDH
- **加密**: AES-256-GCM
- **握手**: 一次往返 (1-RTT)

### 集成方式

连接器在心跳握手时携带 Noise 公钥，面板回复其公钥并完成密钥派生。后续命令使用派生密钥进行 AEAD 加密。

## 安全建议

1. **证书轮换**: 建议每 90 天轮换一次证书
2. **吊销列表**: 维护 CRL 以便吊销泄露的客户端证书
3. **密钥保护**: 私钥文件权限设为 600（仅所有者可读）
4. **HSTS**: 启用 HTTP Strict-Transport-Security
5. **回退策略**: 不支持降级到明文，连接失败即断开
