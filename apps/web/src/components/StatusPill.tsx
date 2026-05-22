interface StatusPillProps {
  status: string;
}

const toneMap: Record<string, string> = {
  online: "good",
  running: "good",
  active: "good",
  success: "good",
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
