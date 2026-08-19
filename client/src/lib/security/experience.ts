import type { DemoScenario, ManagedWallet, WalletState } from "./types";

export type PortfolioSection = "overview" | "wallets" | "scan" | "activity" | "profile";

export type ScenarioAction = {
  label: string;
  description: string;
  section: PortfolioSection;
};

export const SCENARIO_ACTIONS: Record<DemoScenario["id"], ScenarioAction> = {
  "safe-transfer": { label: "Confirm destination", description: "Compare the active wallet and destination before signing.", section: "wallets" },
  "unlimited-approval": { label: "Keep blocked", description: "This approval should not be opened in a wallet confirmation.", section: "activity" },
  "transaction-mismatch": { label: "Compare recipient", description: "The declared recipient does not match the decoded destination.", section: "activity" },
  "failed-transaction": { label: "Fix the request", description: "The simulation has already shown a failure condition.", section: "scan" },
  "unexpected-asset-movement": { label: "Review movements", description: "Open the activity trail and inspect every decoded asset movement.", section: "activity" },
  "verified-transaction": { label: "View verified receipt", description: "The receipt and post-signing balance evidence are available.", section: "activity" },
};

export function canRequestSignature(activeWallet: ManagedWallet | undefined, wallet: WalletState) {
  return Boolean(activeWallet?.kind === "connected" && wallet.address && activeWallet.address.toLowerCase() === wallet.address.toLowerCase());
}
