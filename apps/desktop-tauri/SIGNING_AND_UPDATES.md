# Windows 代码签名与自动更新

## 代码签名

### 获取证书

1. 从受信任 CA（如 DigiCert、Sectigo、Let's Encrypt）购买 **代码签名证书**。
2. 证书类型选择 **Extended Validation (EV)** 以最小化 Windows SmartScreen 拦截。
3. 将证书导出为 `.pfx` 格式，包含私钥。

### 签名配置

在 `src-tauri/tauri.conf.json` 中配置：

```json
{
  "bundle": {
    "windows": {
      "digestAlgorithm": "sha256",
      "certificateThumbprint": "YOUR_CERT_THUMBPRINT",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
}
```

### CI 中的代码签名 (GitHub Actions)

```yaml
- name: Sign Windows installer
  env:
    WINDOWS_CERT_PFX: ${{ secrets.WINDOWS_CERT_PFX }}
    WINDOWS_CERT_PASSWORD: ${{ secrets.WINDOWS_CERT_PASSWORD }}
  run: |
    echo "$WINDOWS_CERT_PFX" | base64 --decode > cert.pfx
    osslsigncode sign -pkcs12 cert.pfx -pass "$WINDOWS_CERT_PASSWORD" \
      -n "LXPanel Desktop" -i "https://lxpanel.io" \
      -ts http://timestamp.digicert.com \
      -in src-tauri/target/release/lxpanel-desktop.exe \
      -out signed-lxpanel-desktop.exe
```

## 自动更新

### Tauri 更新机制

Tauri 2 内置 `tauri-plugin-updater` 插件，支持：

- **检查更新**：启动时后台检查
- **下载安装包**：静默下载
- **重启应用**：下载完成后提示用户重启

### 更新服务器配置

在 `src-tauri/tauri.conf.json` 中：

```json
{
  "plugins": {
    "updater": {
      "pubkey": "YOUR_UPDATER_PUBLIC_KEY",
      "endpoints": [
        "https://update.lxpanel.io/api/updates/{{target}}/{{current_version}}"
      ]
    }
  }
}
```

### 后端更新端点

需要新增 API 端点：

```
GET /api/platform/desktop-updates?platform=win64&current_version=0.1.0
```

响应格式：

```json
{
  "version": "0.1.1",
  "notes": "修复已知问题，增强安全性",
  "pub_date": "2026-06-15T00:00:00Z",
  "platforms": {
    "win64": {
      "signature": "Base64(RSA-SHA256 of installer)",
      "url": "https://releases.lxpanel.io/lxpanel-desktop-0.1.1-x64.exe"
    }
  }
}
```

### 密钥生成

```bash
# 生成更新签名密钥对
cargo tauri signer generate -w ~/.tauri/lxpanel-updater.key
# 公钥用于配置，私钥用于签名安装包
```

## 验证清单

- [ ] 代码签名证书已采购并配置
- [ ] CI 流水线包含签名步骤
- [ ] 更新服务器端点已部署
- [ ] Tauri 更新公钥已配置
- [ ] 首次自动更新经过端到端测试
