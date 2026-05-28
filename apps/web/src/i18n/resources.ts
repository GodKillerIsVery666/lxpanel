export const locales = ["zh-CN", "en-US"] as const;
export type Locale = typeof locales[number];

type ViewText = { label: string; description: string };
type HostColumns = { name: string; status: string; address: string; tags: string; connector: string; lastSeen: string; actions: string };
type AppColumns = { name: string; template: string; version: string; status: string; compose: string; creator: string; lastAction: string; output: string; actions: string };
type AuditColumns = { time: string; actor: string; action: string; target: string; status: string };
type BackupColumns = { name: string; type: string; path: string; secret: string; status: string; syncedAt: string; file: string; size: string; creator: string; time: string; checksum: string; actions: string };
type DatabaseColumns = { name: string; type: string; status: string; url: string; retention: string; schedule: string; backup: string; drill: string; result: string; actions: string };
type SecurityColumns = { item: string; risk: string; status: string; detail: string; recommendation: string; command: string; user: string; createdAt: string; expiresAt: string; current: string; actions: string; name: string; role: string; scopes: string; lastUsed: string };
type ShellSections = { overview: string; operations: string; automation: string; security: string; actions: string };

export const shellText: Record<Locale, {
  skip: string;
  brandSubtitle: string;
  navSearch: string;
  navEmpty: string;
  commandTrigger: string;
  favorite: string;
  unfavorite: string;
  language: string;
  density: string;
  comfortable: string;
  compact: string;
  logout: string;
  commandDialog: string;
  commandSearch: string;
  close: string;
  noCommands: string;
  sections: ShellSections;
  views: Record<string, ViewText>;
}> = {
  "zh-CN": {
    skip: "跳到主内容",
    brandSubtitle: "轻量运维工作台",
    navSearch: "搜索功能、资源或动作",
    navEmpty: "没有匹配的入口。",
    commandTrigger: "打开命令面板 Ctrl+K",
    favorite: "收藏当前页面",
    unfavorite: "取消收藏当前页面",
    language: "界面语言",
    density: "表格密度",
    comfortable: "舒适",
    compact: "紧凑",
    logout: "退出",
    commandDialog: "全局命令面板",
    commandSearch: "搜索页面、资源或动作",
    close: "关闭",
    noCommands: "没有匹配的命令。",
    sections: { overview: "总览", operations: "运维", automation: "文件与自动化", security: "安全与交付", actions: "快捷动作" },
    views: {
      dashboard: { label: "概览", description: "健康、告警和常用入口" },
      monitoring: { label: "监控", description: "资源趋势和 Prometheus" },
      alerts: { label: "告警", description: "阈值、静默和确认" },
      hosts: { label: "主机", description: "资产、分组和批量命令" },
      processes: { label: "进程", description: "本机进程列表" },
      services: { label: "服务", description: "systemd 服务动作" },
      docker: { label: "容器", description: "Docker 状态和容器动作" },
      apps: { label: "应用", description: "模板部署、升级和回滚" },
      databases: { label: "数据库", description: "连接、备份和演练" },
      files: { label: "文件", description: "受控目录读写" },
      logs: { label: "日志", description: "日志根目录和尾部读取" },
      connectors: { label: "连接器", description: "Agent 心跳和命令队列" },
      tasks: { label: "任务", description: "受控命令和计划任务" },
      notifications: { label: "通知", description: "Webhook 渠道和投递" },
      approvals: { label: "审批", description: "高风险操作准入" },
      users: { label: "用户", description: "账号、角色和密码" },
      backups: { label: "备份", description: "快照、远程同步和恢复" },
      security: { label: "安全", description: "巡检、会话和 Token" },
      platform: { label: "平台", description: "商业治理和交付检查" },
      audit: { label: "审计", description: "日志、导出和完整性" },
      migration: { label: "迁移", description: "状态存储迁移向导" }
    }
  },
  "en-US": {
    skip: "Skip to content",
    brandSubtitle: "Lightweight operations workspace",
    navSearch: "Search features, resources, or actions",
    navEmpty: "No matching entry.",
    commandTrigger: "Open command palette Ctrl+K",
    favorite: "Favorite current page",
    unfavorite: "Remove current page from favorites",
    language: "Interface language",
    density: "Table density",
    comfortable: "Comfort",
    compact: "Compact",
    logout: "Log out",
    commandDialog: "Command Palette",
    commandSearch: "Search pages, resources, or actions",
    close: "Close",
    noCommands: "No matching command.",
    sections: { overview: "Overview", operations: "Operations", automation: "Files & Automation", security: "Security & Delivery", actions: "Quick Actions" },
    views: {
      dashboard: { label: "Dashboard", description: "Health, alerts, and shortcuts" },
      monitoring: { label: "Monitoring", description: "Resource trends and Prometheus" },
      alerts: { label: "Alerts", description: "Thresholds, silences, and acknowledgements" },
      hosts: { label: "Hosts", description: "Assets, groups, and batch commands" },
      processes: { label: "Processes", description: "Local process list" },
      services: { label: "Services", description: "systemd service actions" },
      docker: { label: "Containers", description: "Docker status and container actions" },
      apps: { label: "Apps", description: "Template deploys, upgrades, and rollbacks" },
      databases: { label: "Databases", description: "Connections, backups, and drills" },
      files: { label: "Files", description: "Controlled directory reads and writes" },
      logs: { label: "Logs", description: "Log roots and tailing" },
      connectors: { label: "Connectors", description: "Agent heartbeats and command queue" },
      tasks: { label: "Tasks", description: "Controlled commands and schedules" },
      notifications: { label: "Notifications", description: "Webhook channels and deliveries" },
      approvals: { label: "Approvals", description: "High-risk operation gates" },
      users: { label: "Users", description: "Accounts, roles, and passwords" },
      backups: { label: "Backups", description: "Snapshots, remote sync, and restore" },
      security: { label: "Security", description: "Posture, sessions, and tokens" },
      platform: { label: "Platform", description: "Commercial governance and delivery checks" },
      audit: { label: "Audit", description: "Logs, exports, and integrity" },
      migration: { label: "Migration", description: "State store migration wizard" }
    }
  }
};

export const pageText: Record<Locale, {
  hosts: {
    title: string; subtitle: string; add: string; groups: string; list: string; name: string; address: string; tags: string; noConnector: string; create: string; groupName: string; hostIds: string; createGroup: string; command: string; dispatch: string; emptyGroupsTitle: string; emptyGroupsDescription: string; search: string; sshUser: string; emptyHostsTitle: string; emptyHostsDescription: string; columns: HostColumns; delete: string;
  };
  apps: {
    title: string; subtitle: string; deploy: string; records: string; noTemplatesTitle: string; noTemplatesDescription: string; deployName: string; autoStart: string; deployAction: string; search: string; emptyTitle: string; emptyDescription: string; source: string; signature: string; verified: string; unverified: string; columns: AppColumns;
  };
  audit: {
    title: string; subtitle: string; filter: string; actor: string; action: string; allStatus: string; limit: string; query: string; next: string; retainDays: string; approvalId: string; prune: string; matched: string; emptyTitle: string; emptyDescription: string; confirmTitle: string; confirmText: string; columns: AuditColumns;
  };
  backups: {
    title: string; subtitle: string; create: string; refresh: string; auto: string; intervalHours: string; enable: string; pause: string; current: string; nextPending: string; disabled: string; restoreApproval: string; approvalId: string; remoteTargets: string; targetName: string; filesystem: string; s3: string; remotePath: string; add: string; emptyRemoteTitle: string; emptyRemoteDescription: string; verification: string; passed: string; failed: string; stateKeys: string; search: string; emptyTitle: string; emptyDescription: string; confirmTitle: string; confirmText: string; confirmDescription: (fileName: string) => string; columns: BackupColumns;
  };
  databases: {
    title: string; subtitle: string; add: string; list: string; identityTitle: string; identityDetail: string; urlTitle: string; urlDetail: string; policyTitle: string; policyDetail: string; connectionName: string; next: string; previous: string; retentionDays: string; schedule: string; intervalHours: string; search: string; emptyTitle: string; emptyDescription: string; backupDone: string; backupFailed: string; drillPassed: string; drillFailed: string; days: string; pending: string; disabled: string; stopSchedule: string; enableSchedule: string; disable: string; enable: string; columns: DatabaseColumns;
  };
  security: {
    title: string; subtitle: string; cookie: string; ipAllowlist: string; connectors: string; users: string; tasks: string; managedRoots: string; logRoots: string; notEnabled: string; snapshots: string; checks: string; hardening: string; mfa: string; generateSecret: string; code: string; confirmEnable: string; disable: string; sessions: string; apiToken: string; tokenName: string; tokenDays: string; create: string; recommendations: string; none: string; current: string; yes: string; no: string; revoke: string; attention: (count: number) => string; tokenExpired: string; tokenExpiring: string; tokenNormal: string; neverExpires: string; expiredSuffix: string; daysLeft: (days: number) => string; columns: SecurityColumns;
  };
}> = {
  "zh-CN": {
    hosts: { title: "主机资产", subtitle: "本地与连接器发现的受管主机", add: "新增主机", groups: "主机组和批量任务", list: "主机列表", name: "主机名称", address: "地址或备注入口", tags: "标签，逗号分隔", noConnector: "不绑定连接器", create: "新增", groupName: "主机组名称", hostIds: "主机 ID，逗号分隔", createGroup: "建组", command: "命令", dispatch: "下发", emptyGroupsTitle: "还没有主机组", emptyGroupsDescription: "主机组用于按业务或环境批量下发命令。", search: "搜索主机、标签、连接器或状态", sshUser: "SSH 用户，可选", emptyHostsTitle: "没有匹配的主机", emptyHostsDescription: "新增主机或连接器心跳上报后会出现在这里。", columns: { name: "名称", status: "状态", address: "地址", tags: "标签", connector: "连接器", lastSeen: "最近在线", actions: "操作" }, delete: "删除" },
    apps: { title: "应用商店", subtitle: "基于受控 Docker Compose 模板部署应用", deploy: "一键部署", records: "部署记录", noTemplatesTitle: "没有可用模板", noTemplatesDescription: "内置模板或可信模板仓库同步后会出现在这里。", deployName: "部署名称，例如 redis-prod", autoStart: "自动启动", deployAction: "部署", search: "搜索名称、模板、状态或工作空间", emptyTitle: "没有匹配的部署", emptyDescription: "调整筛选条件，或从上方选择模板创建一个新部署。", source: "来源", signature: "签名", verified: "已验证", unverified: "未验证", columns: { name: "名称", template: "模板", version: "版本", status: "状态", compose: "Compose", creator: "创建人", lastAction: "最近操作", output: "输出", actions: "操作" } },
    audit: { title: "审计", subtitle: "安全事件、导出与保留", filter: "筛选", actor: "操作者", action: "动作", allStatus: "全部状态", limit: "每页条数", query: "查询", next: "下一页", retainDays: "保留天数", approvalId: "审批单 ID", prune: "清理", matched: "匹配事件", emptyTitle: "没有匹配的审计事件", emptyDescription: "调整筛选条件，或等待系统产生新的审计事件。", confirmTitle: "清理审计日志", confirmText: "清理", columns: { time: "时间", actor: "操作者", action: "动作", target: "对象", status: "状态" } },
    backups: { title: "备份", subtitle: "本地状态快照、远程同步和受控恢复", create: "创建", refresh: "刷新", auto: "自动备份", intervalHours: "间隔小时", enable: "启用", pause: "暂停", current: "当前", nextPending: "待计算", disabled: "未启用", restoreApproval: "恢复审批", approvalId: "审批单 ID", remoteTargets: "远程备份目标", targetName: "目标名称", filesystem: "文件系统", s3: "S3 兼容", remotePath: "挂载目录或共享目录路径", add: "添加", emptyRemoteTitle: "还没有远程备份目标", emptyRemoteDescription: "添加文件系统或 S3 兼容目标后，可将快照同步到异地。", verification: "校验结果", passed: "通过", failed: "失败", stateKeys: "状态字段", search: "搜索文件名、路径、创建者或哈希", emptyTitle: "没有匹配的快照", emptyDescription: "创建备份后会出现在这里；也可以调整搜索条件。", confirmTitle: "恢复状态快照", confirmText: "恢复", confirmDescription: (fileName) => `将恢复 ${fileName}，当前会话会被清空并回到快照状态。`, columns: { name: "名称", type: "类型", path: "路径/桶", secret: "密钥", status: "状态", syncedAt: "最近同步", file: "文件", size: "大小", creator: "创建者", time: "时间", checksum: "校验", actions: "操作" } },
    databases: { title: "数据库", subtitle: "多引擎连接登记、受控备份和恢复演练", add: "新增连接", list: "连接列表", identityTitle: "基础信息", identityDetail: "先确认连接名称和数据库类型。", urlTitle: "连接地址", urlDetail: "URL 会在后端按配置加密或隐藏密码后展示。", policyTitle: "备份策略", policyDetail: "设置保留周期和计划备份间隔。", connectionName: "连接名称", next: "下一步", previous: "上一步", retentionDays: "保留天数", schedule: "计划", intervalHours: "间隔小时", search: "搜索名称、类型、地址、状态或工作空间", emptyTitle: "没有匹配的数据库连接", emptyDescription: "新增连接后可执行备份、恢复演练和计划任务。", backupDone: "备份完成", backupFailed: "备份失败", drillPassed: "恢复演练通过", drillFailed: "恢复演练", days: "天", pending: "待调度", disabled: "关闭", stopSchedule: "停计划", enableSchedule: "计划", disable: "停用", enable: "启用", columns: { name: "名称", type: "类型", status: "状态", url: "地址", retention: "保留", schedule: "计划", backup: "最近备份", drill: "恢复演练", result: "结果", actions: "操作" } },
    security: { title: "安全", subtitle: "巡检、会话、双因素认证和 API Token", cookie: "会话 Cookie", ipAllowlist: "IP 白名单", connectors: "连接器", users: "用户", tasks: "任务", managedRoots: "受控目录", logRoots: "日志目录", notEnabled: "未启用。", snapshots: "备份快照", checks: "安全巡检", hardening: "加固计划", mfa: "双因素认证", generateSecret: "生成密钥", code: "验证码", confirmEnable: "确认启用", disable: "关闭", sessions: "活动会话", apiToken: "API Token", tokenName: "Token 名称", tokenDays: "有效天数", create: "创建", recommendations: "建议", none: "无。", current: "当前", yes: "是", no: "否", revoke: "撤销", attention: (count) => `${count} 个 API Token 已过期或将在 7 天内到期，请提前轮换。`, tokenExpired: "已过期", tokenExpiring: "即将到期", tokenNormal: "正常", neverExpires: "永不过期", expiredSuffix: "已过期", daysLeft: (days) => `剩余 ${days} 天`, columns: { item: "项目", risk: "风险", status: "状态", detail: "详情", recommendation: "建议", command: "命令", user: "用户", createdAt: "创建时间", expiresAt: "过期时间", current: "当前", actions: "操作", name: "名称", role: "角色", scopes: "作用域", lastUsed: "最近使用" } }
  },
  "en-US": {
    hosts: { title: "Host Assets", subtitle: "Managed hosts from local records and connectors", add: "Add Host", groups: "Host Groups and Batch Jobs", list: "Host List", name: "Host name", address: "Address or note", tags: "Tags, comma separated", noConnector: "No connector", create: "Add", groupName: "Group name", hostIds: "Host IDs, comma separated", createGroup: "Create group", command: "Command", dispatch: "Dispatch", emptyGroupsTitle: "No host groups yet", emptyGroupsDescription: "Groups let you dispatch commands by service or environment.", search: "Search hosts, tags, connectors, or status", sshUser: "SSH user, optional", emptyHostsTitle: "No matching hosts", emptyHostsDescription: "New hosts and connector heartbeats will appear here.", columns: { name: "Name", status: "Status", address: "Address", tags: "Tags", connector: "Connector", lastSeen: "Last seen", actions: "Actions" }, delete: "Delete" },
    apps: { title: "App Store", subtitle: "Deploy apps from controlled Docker Compose templates", deploy: "One-Click Deploy", records: "Deployment Records", noTemplatesTitle: "No templates available", noTemplatesDescription: "Built-in templates or trusted repositories will appear here after sync.", deployName: "Deployment name, e.g. redis-prod", autoStart: "Auto start", deployAction: "Deploy", search: "Search name, template, status, or workspace", emptyTitle: "No matching deployments", emptyDescription: "Adjust filters or create a deployment from a template above.", source: "Source", signature: "Signature", verified: "Verified", unverified: "Unverified", columns: { name: "Name", template: "Template", version: "Version", status: "Status", compose: "Compose", creator: "Creator", lastAction: "Last action", output: "Output", actions: "Actions" } },
    audit: { title: "Audit", subtitle: "Security events, exports, and retention", filter: "Filters", actor: "Actor", action: "Action", allStatus: "All statuses", limit: "Rows per page", query: "Query", next: "Next page", retainDays: "Retention days", approvalId: "Approval ID", prune: "Prune", matched: "Matching events", emptyTitle: "No matching audit events", emptyDescription: "Adjust filters or wait for new system audit events.", confirmTitle: "Prune Audit Logs", confirmText: "Prune", columns: { time: "Time", actor: "Actor", action: "Action", target: "Target", status: "Status" } },
    backups: { title: "Backups", subtitle: "Local snapshots, remote sync, and controlled restore", create: "Create", refresh: "Refresh", auto: "Automatic Backups", intervalHours: "Interval hours", enable: "Enable", pause: "Pause", current: "Current", nextPending: "Pending", disabled: "Disabled", restoreApproval: "Restore Approval", approvalId: "Approval ID", remoteTargets: "Remote Backup Targets", targetName: "Target name", filesystem: "Filesystem", s3: "S3 compatible", remotePath: "Mounted or shared directory path", add: "Add", emptyRemoteTitle: "No remote backup targets yet", emptyRemoteDescription: "Add a filesystem or S3-compatible target to sync snapshots offsite.", verification: "Verification Result", passed: "Passed", failed: "Failed", stateKeys: "State keys", search: "Search file name, path, creator, or hash", emptyTitle: "No matching snapshots", emptyDescription: "Snapshots appear after creation; you can also adjust the search.", confirmTitle: "Restore State Snapshot", confirmText: "Restore", confirmDescription: (fileName) => `Restore ${fileName}; current sessions will be cleared and state will roll back to the snapshot.`, columns: { name: "Name", type: "Type", path: "Path/Bucket", secret: "Secret", status: "Status", syncedAt: "Last sync", file: "File", size: "Size", creator: "Creator", time: "Time", checksum: "Checksum", actions: "Actions" } },
    databases: { title: "Databases", subtitle: "Multi-engine connections, controlled backups, and restore drills", add: "Add Connection", list: "Connections", identityTitle: "Identity", identityDetail: "Confirm connection name and database type first.", urlTitle: "Connection URL", urlDetail: "The backend encrypts the URL or displays it with credentials masked.", policyTitle: "Backup Policy", policyDetail: "Set retention and scheduled backup interval.", connectionName: "Connection name", next: "Next", previous: "Previous", retentionDays: "Retention days", schedule: "Schedule", intervalHours: "Interval hours", search: "Search name, type, URL, status, or workspace", emptyTitle: "No matching database connections", emptyDescription: "Add a connection to run backups, restore drills, and schedules.", backupDone: "Backup complete", backupFailed: "Backup failed", drillPassed: "Restore drill passed", drillFailed: "Restore drill", days: "days", pending: "Pending", disabled: "Off", stopSchedule: "Stop schedule", enableSchedule: "Schedule", disable: "Disable", enable: "Enable", columns: { name: "Name", type: "Type", status: "Status", url: "URL", retention: "Retention", schedule: "Schedule", backup: "Last backup", drill: "Restore drill", result: "Result", actions: "Actions" } },
    security: { title: "Security", subtitle: "Posture, sessions, MFA, and API tokens", cookie: "Session Cookie", ipAllowlist: "IP Allowlist", connectors: "Connectors", users: "Users", tasks: "Tasks", managedRoots: "Managed Roots", logRoots: "Log Roots", notEnabled: "Not enabled.", snapshots: "Backup Snapshots", checks: "Security Checks", hardening: "Hardening Plan", mfa: "Multi-Factor Authentication", generateSecret: "Generate secret", code: "Code", confirmEnable: "Confirm enable", disable: "Disable", sessions: "Active Sessions", apiToken: "API Tokens", tokenName: "Token name", tokenDays: "Valid days", create: "Create", recommendations: "Recommendations", none: "None.", current: "Current", yes: "Yes", no: "No", revoke: "Revoke", attention: (count) => `${count} API tokens have expired or will expire within 7 days. Rotate them ahead of time.`, tokenExpired: "Expired", tokenExpiring: "Expiring", tokenNormal: "Normal", neverExpires: "Never expires", expiredSuffix: "expired", daysLeft: (days) => `${days} days left`, columns: { item: "Item", risk: "Risk", status: "Status", detail: "Detail", recommendation: "Recommendation", command: "Command", user: "User", createdAt: "Created", expiresAt: "Expires", current: "Current", actions: "Actions", name: "Name", role: "Role", scopes: "Scopes", lastUsed: "Last used" } }
  }
};

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
  pluginMarket: string;
  performance: string;
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
    quality: "可访问性与国际化",
    pluginMarket: "插件市场",
    performance: "性能面板"
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
    quality: "Accessibility and Internationalization",
    pluginMarket: "Plugin Marketplace",
    performance: "Performance Panel"
  }
};