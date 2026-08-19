type GuardianIconName = "overview" | "wallets" | "scan" | "activity" | "profile" | "safe" | "warning" | "critical" | "signing";

const iconAssets: Record<GuardianIconName, string> = {
  overview: "/manus-storage/guardian-icon-overview_054233b4.png",
  wallets: "/manus-storage/guardian-icon-wallets_b1f73fb9.png",
  scan: "/manus-storage/guardian-icon-scan_9ebe8a4e.png",
  activity: "/manus-storage/guardian-icon-activity_20da0e89.png",
  profile: "/manus-storage/guardian-icon-profile_5ad7dd4d.png",
  safe: "/manus-storage/guardian-state-safe_9b1ec98d.png",
  warning: "/manus-storage/guardian-state-warning_2c3dd0c0.png",
  critical: "/manus-storage/guardian-state-critical_7ff5904a.png",
  signing: "/manus-storage/guardian-state-signing_6a155093.png",
};

type Props = { name: GuardianIconName; size?: number; className?: string; label?: string };

export function GuardianIcon({ name, size = 18, className = "", label }: Props) {
  return <img className={`guardian-icon guardian-icon-${name} ${className}`} src={iconAssets[name]} alt={label ?? ""} aria-hidden={label ? undefined : true} width={size} height={size} />;
}
