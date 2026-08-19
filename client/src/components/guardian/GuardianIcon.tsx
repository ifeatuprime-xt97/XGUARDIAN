type GuardianIconName = "overview" | "wallets" | "scan" | "activity" | "profile" | "safe" | "warning" | "critical" | "signing";

const iconAssets: Record<GuardianIconName, string> = {
  overview: "/xlogo.png",
  wallets: "/xlogo.png",
  scan: "/xlogo.png",
  activity: "/xlogo.png",
  profile: "/xlogo.png",
  safe: "/xlogo.png",
  warning: "/xlogo.png",
  critical: "/xlogo.png",
  signing: "/xlogo.png",
};

type Props = { name: GuardianIconName; size?: number; className?: string; label?: string };

export function GuardianIcon({ name, size = 18, className = "", label }: Props) {
  return <img className={`guardian-icon guardian-icon-${name} ${className}`} src={iconAssets[name]} alt={label ?? ""} aria-hidden={label ? undefined : true} width={size} height={size} />;
}
