# Ansible 部署说明

## 前置要求

- Ansible >= 2.15
- 目标服务器：Linux (Ubuntu 22.04 / CentOS 7+)
- Python >= 3.8
- SSH 密钥认证已配置

## 安装面板

```bash
# 编辑 inventory
cat > inventory.ini <<EOF
[panel]
your-server ansible_host=192.168.1.100 ansible_user=root
EOF

# 运行 playbook
ansible-playbook -i inventory.ini playbook.yml \
  -e lxpanel_session_secret="your-strong-secret"
```

## 安装连接器

```bash
ansible-playbook -i inventory.ini connector.yml \
  -e lxpanel_server_url="http://panel:7080" \
  -e lxpanel_connector_token="your-token"
```

## 变量说明

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `lxpanel_version` | `latest` | 面板版本 |
| `lxpanel_host` | `0.0.0.0` | 监听地址 |
| `lxpanel_port` | `7080` | 监听端口 |
| `lxpanel_data_dir` | `/opt/lxpanel/data` | 数据目录 |
| `lxpanel_session_secret` | 必填 | 会话密钥 |
| `lxpanel_deploy_method` | `docker` | 部署方式: docker / bare |
| `lxpanel_server_url` | — | 面板地址（连接器用） |
| `lxpanel_connector_token` | — | 连接器令牌 |
