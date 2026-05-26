import type { AppTemplate } from "@lxpanel/shared";

interface CatalogTemplate extends AppTemplate {
  render(values: Record<string, string>): string;
}

export const appTemplates: CatalogTemplate[] = [
  {
    id: "nginx-static",
    name: "Nginx 静态站点",
    category: "Web",
    description: "部署一个轻量 Nginx 容器，可用于静态站点或反向代理前置。",
    image: "nginx:alpine",
    variables: [
      { key: "HTTP_PORT", label: "HTTP 端口", defaultValue: "8080", required: true }
    ],
    render: (values) => [
      "services:",
      "  web:",
      "    image: nginx:alpine",
      "    restart: unless-stopped",
      "    ports:",
      `      - ${quoteYaml(`${values.HTTP_PORT}:80`)}`,
      ""
    ].join("\n")
  },
  {
    id: "redis",
    name: "Redis",
    category: "Database",
    description: "部署带 AOF 持久化的 Redis 7。",
    image: "redis:7-alpine",
    variables: [
      { key: "REDIS_PORT", label: "Redis 端口", defaultValue: "6379", required: true },
      { key: "REDIS_PASSWORD", label: "访问密码", defaultValue: "change-me", required: true }
    ],
    render: (values) => [
      "services:",
      "  redis:",
      "    image: redis:7-alpine",
      "    restart: unless-stopped",
      "    command:",
      "      - redis-server",
      "      - --appendonly",
      "      - \"yes\"",
      "      - --requirepass",
      `      - ${quoteYaml(readValue(values, "REDIS_PASSWORD"))}`,
      "    ports:",
      `      - ${quoteYaml(`${values.REDIS_PORT}:6379`)}`,
      "    volumes:",
      "      - redis-data:/data",
      "volumes:",
      "  redis-data:",
      ""
    ].join("\n")
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    category: "Database",
    description: "部署带本地卷持久化的 PostgreSQL 16。",
    image: "postgres:16-alpine",
    variables: [
      { key: "POSTGRES_PORT", label: "PostgreSQL 端口", defaultValue: "5432", required: true },
      { key: "POSTGRES_USER", label: "用户名", defaultValue: "app", required: true },
      { key: "POSTGRES_PASSWORD", label: "密码", defaultValue: "change-me", required: true },
      { key: "POSTGRES_DB", label: "数据库", defaultValue: "app", required: true }
    ],
    render: (values) => [
      "services:",
      "  postgres:",
      "    image: postgres:16-alpine",
      "    restart: unless-stopped",
      "    environment:",
      `      POSTGRES_USER: ${quoteYaml(readValue(values, "POSTGRES_USER"))}`,
      `      POSTGRES_PASSWORD: ${quoteYaml(readValue(values, "POSTGRES_PASSWORD"))}`,
      `      POSTGRES_DB: ${quoteYaml(readValue(values, "POSTGRES_DB"))}`,
      "    ports:",
      `      - ${quoteYaml(`${values.POSTGRES_PORT}:5432`)}`,
      "    volumes:",
      "      - postgres-data:/var/lib/postgresql/data",
      "volumes:",
      "  postgres-data:",
      ""
    ].join("\n")
  }
];

export function publicTemplates(): AppTemplate[] {
  return appTemplates.map((template) => ({
    id: template.id,
    name: template.name,
    category: template.category,
    description: template.description,
    image: template.image,
    variables: template.variables
  }));
}

export function findTemplate(templateId: string): CatalogTemplate | undefined {
  return appTemplates.find((template) => template.id === templateId);
}

function quoteYaml(value: string): string {
  return JSON.stringify(value);
}

function readValue(values: Record<string, string>, key: string): string {
  return values[key] ?? "";
}
