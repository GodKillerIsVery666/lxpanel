import os from "node:os";
import type { MetricSample, SystemOverview } from "@lxpanel/shared";
import { randomToken } from "../../lib/crypto.js";
import type { StateStore } from "../../lib/stateStore.js";
import type { MetricSampleRecord, PanelState } from "../state/panelState.js";
import { getSystemOverview, listDiskUsage, type DiskUsageInfo } from "../system/systemService.js";

const localHostId = "local";
const maxSamples = 1_440;
const sampleIntervalMs = 60_000;
const defaultSampleLimit = 288;

export interface MonitoringMetricsProvider {
  getOverview(): SystemOverview;
  listDisks(): Promise<DiskUsageInfo[]>;
}

const defaultMetricsProvider: MonitoringMetricsProvider = {
  getOverview: () => getSystemOverview(),
  listDisks: () => listDiskUsage()
};

export class MonitoringService {
  constructor(
    private readonly store: StateStore<PanelState>,
    private readonly metricsProvider: MonitoringMetricsProvider = defaultMetricsProvider
  ) {}

  async listSamples(hostId = localHostId, limit = defaultSampleLimit): Promise<MetricSample[]> {
    const state = await this.store.read();
    return (state.metricSamples ?? [])
      .filter((sample) => sample.hostId === hostId)
      .slice(-limit)
      .reverse();
  }

  async latest(hostId = localHostId): Promise<MetricSample | undefined> {
    const samples = await this.listSamples(hostId, 1);
    return samples[0];
  }

  async recordLocalSample(now = new Date()): Promise<MetricSample | null> {
    const overview = this.metricsProvider.getOverview();
    let disks: DiskUsageInfo[] = [];
    try {
      disks = await this.metricsProvider.listDisks();
    } catch (error) {
      console.error("[monitoring] 采集磁盘指标失败", error);
    }
    const diskUsedPercent = disks.length > 0 ? Math.max(...disks.map((disk) => disk.usedPercent)) : undefined;
    const sample: MetricSampleRecord = {
      id: randomToken(12),
      hostId: localHostId,
      hostName: overview.hostname || os.hostname(),
      time: now.toISOString(),
      cpuPercent: overview.cpu.usagePercent,
      memoryPercent: overview.memory.usedPercent,
      ...(typeof diskUsedPercent === "number" ? { diskUsedPercent } : {})
    };
    return this.store.update((state) => {
      const samples = state.metricSamples ?? [];
      const latestLocal = [...samples].reverse().find((item) => item.hostId === localHostId);
      if (latestLocal && now.getTime() - new Date(latestLocal.time).getTime() < sampleIntervalMs) {
        return { data: state, result: null };
      }
      return {
        data: { ...state, metricSamples: [...samples, sample].slice(-maxSamples) },
        result: sample
      };
    });
  }
}
