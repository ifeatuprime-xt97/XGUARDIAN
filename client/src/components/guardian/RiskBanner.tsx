import { AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";
import type { RiskReport } from "@/lib/security/types";

type RiskBannerProps = {
  risk: RiskReport;
  mode: "demo" | "live";
};

const riskCopy = {
  safe: { label: "SAFE TO REVIEW", Icon: ShieldCheck, helper: "No high-risk deterministic rule was triggered." },
  warning: { label: "REVIEW CAREFULLY", Icon: AlertTriangle, helper: "A warning needs your attention before signing." },
  critical: { label: "DO NOT SIGN", Icon: ShieldAlert, helper: "A critical rule was triggered before wallet approval." },
} as const;

export function RiskBanner({ risk, mode }: RiskBannerProps) {
  const entry = riskCopy[risk.level];
  const Icon = entry.Icon;
  return (
    <section className={`risk-banner risk-${risk.level}`} aria-labelledby="risk-status-heading">
      <div className="risk-icon-wrap"><Icon size={30} strokeWidth={1.8} /></div>
      <div className="risk-copy">
        <p className="eyebrow">Deterministic inspection · {mode === "demo" ? "Demo artifact" : "Live draft"}</p>
        <h1 id="risk-status-heading">{entry.label}</h1>
        <p>{risk.headline}</p>
      </div>
      <div className="risk-rule-count">
        <CheckCircle2 size={15} />
        <span>{risk.findings.length ? `${risk.findings.length} finding${risk.findings.length === 1 ? "" : "s"}` : entry.helper}</span>
      </div>
    </section>
  );
}
