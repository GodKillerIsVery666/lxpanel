import type { ComponentType } from "react";
import { Archive, BellDot, BellRing, Cable, ClipboardCheck, ClipboardList, Container, Database, FileText, Files, Gauge, LineChart, ListTree, PackagePlus, ScrollText, Server, ShieldCheck, SlidersHorizontal, SquareActivity, Users } from "lucide-react";
import type { AuthUser } from "./api/client.js";

export type ViewId = "dashboard" | "hosts" | "monitoring" | "processes" | "services" | "docker" | "apps" | "databases" | "files" | "logs" | "connectors" | "tasks" | "alerts" | "notifications" | "approvals" | "users" | "backups" | "security" | "platform" | "audit";

export interface NavItem {
  id: ViewId;
  label: string;
  description: string;
  icon: ComponentType<{ size?: number }>;
  minRole?: AuthUser["role"];
  keywords: string[];
}

export interface NavSection {
  id: "overview" | "operations" | "automation" | "security";
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    id: "overview",
    title: "总览",
    items: [
      { id: "dashboard", label: "概览", description: "健康、告警和常用入口", icon: Gauge, keywords: ["首页", "工作台", "状态"] },
      { id: "monitoring", label: "监控", description: "资源趋势和 Prometheus", icon: LineChart, keywords: ["趋势", "指标", "metrics"] },
      { id: "alerts", label: "告警", description: "阈值、静默和确认", icon: BellRing, keywords: ["风险", "通知", "确认"] }
    ]
  },
  {
    id: "operations",
    title: "运维",
    items: [
      { id: "hosts", label: "主机", description: "资产、分组和批量命令", icon: Server, keywords: ["服务器", "ssh", "批量"] },
      { id: "processes", label: "进程", description: "本机进程列表", icon: SquareActivity, keywords: ["pid", "资源"] },
      { id: "services", label: "服务", description: "systemd 服务动作", icon: ListTree, keywords: ["systemd", "启动", "停止"] },
      { id: "docker", label: "容器", description: "Docker 状态和容器动作", icon: Container, keywords: ["docker", "镜像", "容器"] },
      { id: "apps", label: "应用", description: "模板部署、升级和回滚", icon: PackagePlus, minRole: "operator", keywords: ["商店", "compose", "部署"] },
      { id: "databases", label: "数据库", description: "连接、备份和演练", icon: Database, minRole: "operator", keywords: ["postgres", "mysql", "备份"] }
    ]
  },
  {
    id: "automation",
    title: "文件与自动化",
    items: [
      { id: "files", label: "文件", description: "受控目录读写", icon: Files, keywords: ["目录", "编辑", "配置"] },
      { id: "logs", label: "日志", description: "日志根目录和尾部读取", icon: FileText, keywords: ["tail", "排查"] },
      { id: "connectors", label: "连接器", description: "Agent 心跳和命令队列", icon: Cable, keywords: ["agent", "令牌", "远程"] },
      { id: "tasks", label: "任务", description: "受控命令和计划任务", icon: ClipboardList, minRole: "operator", keywords: ["脚本", "计划", "自动化"] },
      { id: "notifications", label: "通知", description: "Webhook 渠道和投递", icon: BellDot, minRole: "operator", keywords: ["webhook", "消息"] }
    ]
  },
  {
    id: "security",
    title: "安全与交付",
    items: [
      { id: "approvals", label: "审批", description: "高风险操作准入", icon: ClipboardCheck, minRole: "owner", keywords: ["批准", "恢复", "权限"] },
      { id: "users", label: "用户", description: "账号、角色和密码", icon: Users, minRole: "owner", keywords: ["rbac", "成员"] },
      { id: "backups", label: "备份", description: "快照、远程同步和恢复", icon: Archive, minRole: "owner", keywords: ["恢复", "快照", "s3"] },
      { id: "security", label: "安全", description: "巡检、会话和 Token", icon: ShieldCheck, keywords: ["token", "2fa", "加固"] },
      { id: "platform", label: "平台", description: "商业治理和交付检查", icon: SlidersHorizontal, minRole: "operator", keywords: ["许可证", "工作空间", "openapi"] },
      { id: "audit", label: "审计", description: "日志、导出和完整性", icon: ScrollText, keywords: ["合规", "导出", "哈希"] }
    ]
  }
];

export const navItems = navSections.flatMap((section) => section.items);

export function roleRank(role: AuthUser["role"]): number {
  return role === "owner" ? 3 : role === "operator" ? 2 : 1;
}

export function canAccessView(user: AuthUser, view: ViewId): boolean {
  const item = navItems.find((candidate) => candidate.id === view);
  return !item?.minRole || roleRank(user.role) >= roleRank(item.minRole);
}

export function viewTitle(view: ViewId): string {
  return navItems.find((item) => item.id === view)?.label ?? "概览";
}

export function viewDescription(view: ViewId): string {
  return navItems.find((item) => item.id === view)?.description ?? "健康、告警和常用入口";
}
