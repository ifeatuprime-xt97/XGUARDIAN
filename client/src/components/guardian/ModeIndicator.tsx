import { Activity, FlaskConical, Radio } from "lucide-react";

type ModeIndicatorProps = {
  mode: "demo" | "live";
  liveReady: boolean;
};

export function ModeIndicator({ mode, liveReady }: ModeIndicatorProps) {
  const isLive = mode === "live";
  return (
    <div className={`mode-indicator ${isLive ? "mode-indicator-live" : "mode-indicator-demo"}`} role="status" aria-live="polite">
      <span className="mode-indicator-icon">{isLive ? <Radio size={14} /> : <FlaskConical size={14} />}</span>
      <span className="mode-indicator-title">{isLive ? "LIVE" : "DEMO"}</span>
      <span className="mode-indicator-detail">{isLive ? "Wallet-connected inspection" : "No wallet required"}</span>
      {isLive && <Activity size={13} className="live-pulse" aria-label={liveReady ? "Wallet active" : "Wallet not ready"} />}
    </div>
  );
}
