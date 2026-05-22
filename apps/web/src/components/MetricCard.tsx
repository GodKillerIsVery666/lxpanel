import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  accent: string;
  meta?: string | undefined;
  icon: ReactNode;
}

export function MetricCard({ label, value, accent, meta, icon }: MetricCardProps): JSX.Element {
  return (
    <section className="metric-card" style={{ borderTopColor: accent }}>
      <div className="metric-icon" style={{ color: accent }}>{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {meta ? <span>{meta}</span> : null}
      </div>
    </section>
  );
}
