import type { FastifyInstance } from "fastify";
import type { Services } from "../../server.js";
import { requireUser } from "../auth/authMiddleware.js";

export function registerMonitoringRoutes(app: FastifyInstance, services: Services): void {
  app.get<{ Querystring: { hostId?: string; limit?: string } }>("/api/monitoring/samples", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const limit = parseLimit(request.query.limit);
    return { samples: await services.monitoringService.listSamples(request.query.hostId, limit) };
  });

  app.get<{ Querystring: { hostId?: string } }>("/api/monitoring/latest", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { sample: await services.monitoringService.latest(request.query.hostId) };
  });

  app.get("/api/monitoring/prometheus", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const samples = await services.monitoringService.listSamples(undefined, 1000);
    reply.header("content-type", "text/plain; version=0.0.4; charset=utf-8");

    // 附加自定义告警规则 Prometheus 规则
    const state = await services.stateStore.read();
    const customRules = state.customAlertRules ?? [];
    const rulesYaml = customRules.filter((r) => r.enabled).map((rule) => {
      return `# ${rule.name}: ${rule.description || rule.messageTemplate}
# type: ${rule.level}
- alert: LXPanel_${rule.name.replace(/[^a-zA-Z0-9_]/g, "_")}
  expr: ${rule.metric} ${rule.condition} ${rule.threshold}
  for: ${rule.duration}s
  labels:
    severity: ${rule.level}
  annotations:
    summary: "${rule.messageTemplate || rule.name}"`;
    }).join("\n\n");

    return toPrometheus(samples) + (rulesYaml ? `\n# Custom alert rules for Prometheus\n${rulesYaml}\n` : "");
  });
}

function toPrometheus(samples: Array<{ hostId: string; hostName: string; cpuPercent: number; memoryPercent: number; diskUsedPercent?: number | undefined }>): string {
  const latestByHost = new Map<string, typeof samples[number]>();
  for (const sample of samples) {
    latestByHost.set(sample.hostId, sample);
  }
  const lines = [
    "# HELP lxpanel_cpu_percent Latest CPU usage percent.",
    "# TYPE lxpanel_cpu_percent gauge",
    ...[...latestByHost.values()].map((sample) => `lxpanel_cpu_percent{host=${JSON.stringify(sample.hostName)}} ${sample.cpuPercent}`),
    "# HELP lxpanel_memory_percent Latest memory usage percent.",
    "# TYPE lxpanel_memory_percent gauge",
    ...[...latestByHost.values()].map((sample) => `lxpanel_memory_percent{host=${JSON.stringify(sample.hostName)}} ${sample.memoryPercent}`),
    "# HELP lxpanel_disk_percent Latest disk usage percent.",
    "# TYPE lxpanel_disk_percent gauge",
    ...[...latestByHost.values()].filter((sample) => typeof sample.diskUsedPercent === "number").map((sample) => `lxpanel_disk_percent{host=${JSON.stringify(sample.hostName)}} ${sample.diskUsedPercent}`)
  ];
  return `${lines.join("\n")}\n`;
}

function parseLimit(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const limit = Number.parseInt(value, 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
    return undefined;
  }
  return limit;
}
