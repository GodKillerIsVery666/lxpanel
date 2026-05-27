export const locales = ["zh-CN", "en-US"] as const;
export type Locale = typeof locales[number];

export const platformText: Record<Locale, {
  title: string;
  subtitle: string;
  terminal: string;
  templates: string;
  workspace: string;
  approval: string;
  audit: string;
  capacity: string;
  openApi: string;
  quality: string;
}> = {
  "zh-CN": {
    title: "平台治理",
    subtitle: "商业交付、安全治理和开放集成",
    terminal: "Web 终端流",
    templates: "模板仓库和许可证",
    workspace: "多租户工作空间",
    approval: "资源访问和审批策略",
    audit: "审计完整性和签名包",
    capacity: "容量、归档和升级",
    openApi: "开放 API 和 SDK 示例",
    quality: "可访问性与国际化"
  },
  "en-US": {
    title: "Platform Governance",
    subtitle: "Commercial delivery, security governance, and integrations",
    terminal: "Web Terminal Stream",
    templates: "Template Repositories and License",
    workspace: "Multi-Tenant Workspaces",
    approval: "Resource Access and Approval Policies",
    audit: "Audit Integrity and Signed Bundle",
    capacity: "Capacity, Archive, and Upgrade",
    openApi: "Open API and SDK Examples",
    quality: "Accessibility and Internationalization"
  }
};