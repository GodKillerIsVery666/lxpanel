interface StatusPillProps {
  status: string;
}

const toneMap: Record<string, string> = {
  online: "good",
  running: "good",
  active: "good",
  secure: "good",
  success: "good",
  info: "muted",
  warn: "warn",
  warning: "warn",
  critical: "bad",
  stale: "warn",
  inactive: "muted",
  offline: "bad",
  failed: "bad",
  denied: "bad",
  error: "bad"
};

export function StatusPill({ status }: StatusPillProps): JSX.Element {
  const tone = toneMap[status.toLowerCase()] ?? "muted";
  return <span className={`status-pill ${tone}`}>{status}</span>;
}
