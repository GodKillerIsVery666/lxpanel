import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  accent: string;
  meta?: string | undefined;
  progressPercent?: number | undefined;
  icon: ReactNode;
}

export function MetricCard({ label, value, accent, meta, progressPercent, icon }: MetricCardProps): JSX.Element {
  const progress = typeof progressPercent === "number" ? Math.min(Math.max(progressPercent, 0), 100) : undefined;
  return (
    <section className="metric-card" style={{ borderTopColor: accent }}>
      <div className="metric-icon" style={{ color: accent }}>{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {meta ? <span>{meta}</span> : null}
        {typeof progress === "number" ? <span className="metric-progress" aria-label={`${label} 使用率 ${Math.round(progress)}%`}><i style={{ width: `${progress}%`, background: accent }} /></span> : null}
      </div>
    </section>
  );
}
