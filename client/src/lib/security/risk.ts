import { isAddress } from "viem";
import type { DecodedTransaction, ReputationResult, RiskFinding, RiskLevel, RiskReport, SimulationResult, TransactionDraft } from "./types";

type RiskInput = {
  draft: TransactionDraft;
  decoded: DecodedTransaction;
  simulation: SimulationResult;
  reputation: ReputationResult;
  unexpectedMovement?: boolean;
};

const HIGH_VALUE_WARNING = BigInt("2000000000000000000");

function highestLevel(findings: RiskFinding[]): RiskLevel {
  if (findings.some((finding) => finding.level === "critical")) return "critical";
  if (findings.some((finding) => finding.level === "warning")) return "warning";
  return "safe";
}

function headlineFor(level: RiskLevel) {
  if (level === "critical") return "Do not sign until the critical findings are resolved.";
  if (level === "warning") return "Proceed only after you understand the warning findings.";
  return "No deterministic high-risk behavior was found in this inspection.";
}

export function evaluateRisk(input: RiskInput): RiskReport {
  const findings: RiskFinding[] = [];

  if (!isAddress(input.draft.to)) {
    findings.push({ id: "invalid-target", level: "critical", title: "Invalid destination", detail: "The transaction destination is not a valid EVM address.", source: "deterministic" });
  }

  if (input.draft.declaredRecipient && input.decoded.recipient && input.draft.declaredRecipient.toLowerCase() !== input.decoded.recipient.toLowerCase()) {
    findings.push({ id: "recipient-mismatch", level: "critical", title: "Recipient mismatch", detail: "The decoded recipient differs from the stated transaction intent.", source: "deterministic" });
  }

  if (input.decoded.unlimitedApproval) {
    findings.push({ id: "unlimited-approval", level: "critical", title: "Unlimited token approval", detail: "The spender can use the token allowance without an amount cap.", source: "deterministic" });
  }

  if (input.decoded.kind === "erc20-approval" && !input.decoded.unlimitedApproval && BigInt(input.decoded.amountRaw ?? "0") >= HIGH_VALUE_WARNING) {
    findings.push({ id: "large-approval", level: "warning", title: "Large token approval", detail: "The allowance is large enough to create meaningful loss exposure.", source: "deterministic" });
  }

  if (input.decoded.opaque) {
    findings.push({ id: "opaque-calldata", level: "warning", title: "Opaque contract call", detail: "The method selector is not decoded by the local policy engine.", source: "deterministic" });
  }

  try {
    if (BigInt(input.draft.value || "0") >= HIGH_VALUE_WARNING) {
      findings.push({ id: "high-native-value", level: "warning", title: "High native-token value", detail: "The transaction transfers a high amount of native token.", source: "deterministic" });
    }
  } catch {
    findings.push({ id: "invalid-value", level: "critical", title: "Invalid native-token value", detail: "The supplied transaction value cannot be safely interpreted.", source: "deterministic" });
  }

  if (input.simulation.status === "reverted") {
    findings.push({ id: "simulation-reverted", level: "warning", title: "Simulation reverted", detail: "The RPC dry run did not complete successfully against current chain state.", source: "simulation" });
  }

  if (input.simulation.status === "unavailable") {
    findings.push({ id: "simulation-unavailable", level: "warning", title: "Simulation unavailable", detail: "The transaction could not be checked against current X Layer state.", source: "simulation" });
  }

  if (input.reputation.status === "blocked") {
    findings.push({ id: "blocked-address", level: "critical", title: "Blocklisted address", detail: input.reputation.detail, source: "reputation" });
  }

  if (input.unexpectedMovement) {
    findings.push({ id: "unexpected-asset", level: "critical", title: "Unexpected asset movement", detail: "The decoded effect includes an asset movement outside the stated transaction intent.", source: "deterministic" });
  }

  const level = highestLevel(findings);
  return { level, headline: headlineFor(level), findings };
}
