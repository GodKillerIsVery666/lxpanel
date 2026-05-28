# LXPanel Terraform Provider 配置示例
terraform {
  required_providers {
    lxpanel = {
      version = "~> 0.1"
      source  = "registry.example.com/lxpanel/lxpanel"
    }
  }
}

provider "lxpanel" {
  endpoint = var.lxpanel_endpoint
  api_token = var.lxpanel_api_token
}

variable "lxpanel_endpoint" {
  description = "LXPanel API 地址"
  type        = string
  default     = "http://127.0.0.1:7080"
}

variable "lxpanel_api_token" {
  description = "LXPanel API Token（需 platform:write scope）"
  type        = string
  sensitive   = true
}

# 管理主机
resource "lxpanel_host" "example" {
  name    = "terraform-managed-host"
  address = "192.168.1.200"
  tags    = ["terraform", "example"]
}

# 管理远程备份目标
resource "lxpanel_backup_target" "example" {
  name     = "Terraform S3"
  type     = "s3"
  endpoint = "https://s3.example.com"
  bucket   = "lxpanel-backups"
  region   = "us-east-1"
}

# 管理工作空间
resource "lxpanel_workspace" "example" {
  name        = "Terraform Workspace"
  description = "Managed by Terraform"
}

output "host_id" {
  value = lxpanel_host.example.id
}
