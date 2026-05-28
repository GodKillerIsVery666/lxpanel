# Terraform Provider for LXPanel

通过 Terraform 管理 LXPanel 面板的配置资源。

## 支持的资源

```
lxpanel_host           - 管理主机资产
lxpanel_user           - 管理面板用户
lxpanel_backup_target  - 管理远程备份目标
lxpanel_workspace      - 管理工作空间
lxpanel_license        - 管理商业许可证
```

## 快速开始

```hcl
provider "lxpanel" {
  endpoint = "http://127.0.0.1:7080"
  api_token = var.lxpanel_api_token
}

resource "lxpanel_host" "web_server" {
  name      = "web-01"
  address   = "192.168.1.100"
  tags      = ["web", "production"]
  workspace = "default"
}

resource "lxpanel_backup_target" "s3_backup" {
  name     = "Production S3"
  type     = "s3"
  endpoint = "https://s3.amazonaws.com"
  bucket   = "lxpanel-backups"
  region   = "us-east-1"
}
```

## 开发

```bash
# 本地构建
go build -o terraform-provider-lxpanel

# 安装到本地 Terraform
cp terraform-provider-lxpanel ~/.terraform.d/plugins/
```

## API 对应关系

| Terraform 资源 | API 端点 |
|----------------|----------|
| lxpanel_host | POST /api/hosts |
| lxpanel_user | POST /api/users |
| lxpanel_backup_target | POST /api/backups/remote-targets |
| lxpanel_workspace | POST /api/platform/workspaces |
| lxpanel_license | PUT /api/platform/license |
