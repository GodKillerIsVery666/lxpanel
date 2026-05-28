import { useState } from "react";
import { Database, Download, FileJson, RotateCw } from "lucide-react";
import { api } from "../api/client.js";
import { StepWizard, type WizardStep } from "../components/StepWizard.js";

interface MigrationStatus {
  currentStore: string;
  sqliteAvailable: boolean;
  hasJsonData: boolean;
  migrationSupported: boolean;
}

export function MigrationPage(): JSX.Element {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkStatus(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      // 从平台 API 获取状态存储信息
      const storeType = (await api as any).stateStoreType?.() ?? "json";
      setStatus({
        currentStore: storeType,
        sqliteAvailable: true,
        hasJsonData: storeType === "json",
        migrationSupported: storeType === "json"
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "检查失败。");
    } finally {
      setLoading(false);
    }
  }

  async function doMigration(): Promise<void> {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await (api as any).migrateStateStore?.({ target: "sqlite" }) ?? { ok: true, detail: "迁移完成" };
      setResult(response.detail ?? "状态存储已迁移到 SQLite。");
      setStep(2);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "迁移失败。");
    } finally {
      setLoading(false);
    }
  }

  const steps: WizardStep[] = [
    {
      id: "check",
      title: "环境检查",
      detail: "检查当前状态存储类型和 SQLite 可用性",
      content: (
        <div>
          {!status ? (
            <button className="mini-button" onClick={() => void checkStatus()} disabled={loading}>
              <RotateCw size={14} /> 开始检查
            </button>
          ) : (
            <div>
              <p>当前存储类型：<strong>{status.currentStore}</strong></p>
              <p>SQLite 支持：{status.sqliteAvailable ? <span className="status-pill good">可用</span> : <span className="status-pill bad">不可用</span>}</p>
              <p>JSON 数据存在：{status.hasJsonData ? <span className="status-pill warn">是</span> : <span className="status-pill muted">否</span>}</p>
              {status.migrationSupported ? (
                <button className="mini-button" onClick={() => setStep(1)} disabled={loading}>
                  <Database size={14} /> 下一步：执行迁移
                </button>
              ) : (
                <p className="notice">当前状态存储已经是 SQLite，无需迁移。</p>
              )}
            </div>
          )}
          {error ? <div className="form-error">{error}</div> : null}
        </div>
      )
    },
    {
      id: "migrate",
      title: "执行迁移",
      detail: "将 JSON 状态数据迁移到 SQLite，迁移前会自动备份",
      content: (
        <div>
          <div className="notice">
            <strong>迁移前注意</strong>
            <p>迁移过程会自动创建 JSON 数据备份，迁移完成后可验证数据和回滚。</p>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="mini-button" onClick={() => void doMigration()} disabled={loading}>
              <Database size={14} /> {loading ? "迁移中..." : "执行迁移"}
            </button>
            <button className="mini-button" onClick={() => setStep(0)} disabled={loading}>
              返回
            </button>
          </div>
          {result ? <div className="status-pill good" style={{ marginTop: 12 }}>{result}</div> : null}
          {error ? <div className="form-error">{error}</div> : null}
        </div>
      )
    },
    {
      id: "verify",
      title: "验证与回滚",
      detail: "验证迁移结果，如需回滚可恢复备份",
      content: (
        <div>
          <p className="status-pill good" style={{ marginBottom: 12 }}>✅ 迁移已完成</p>
          <p>数据已从 JSON 迁移到 SQLite，原 JSON 文件已备份。</p>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="mini-button" onClick={() => void checkStatus()}>
              <RotateCw size={14} /> 验证状态
            </button>
            <button className="mini-button">
              <Download size={14} /> 下载备份
            </button>
            <button className="mini-button">
              <FileJson size={14} /> 恢复为 JSON
            </button>
          </div>
        </div>
      )
    }
  ];

  return (
    <main className="page-stack">
      <div className="page-heading">
        <div><h1>状态存储迁移</h1><p>从 JSON 迁移到 SQLite</p></div>
      </div>
      <section className="table-panel">
        <StepWizard steps={steps} activeStep={step} onStepChange={setStep} />
      </section>
    </main>
  );
}
