import type { IntentComparison, RecoveryGuidance, TransactionAnalysis, VerificationDiff, VerificationDiffItem } from "./types";

const shortAddress = (value?: string) => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "the decoded destination";

export function createIntentComparison(analysis: TransactionAnalysis): IntentComparison {
  const { draft, decoded, risk } = analysis;
  const intended = draft.declaredAction?.trim() || "No stated intent was supplied.";
  const actual = decoded.summary;
  const recipientMismatch = risk.findings.some((finding) => finding.id === "recipient-mismatch");
  const unlimitedApproval = risk.findings.some((finding) => finding.id === "unlimited-approval");
  const unexpectedMovement = risk.findings.some((finding) => finding.id === "unexpected-asset");

  if (recipientMismatch) return { status: "mismatch", intended, actual, difference: `Your stated recipient differs from the decoded recipient ${shortAddress(decoded.recipient)}.` };
  if (unlimitedApproval) return { status: "mismatch", intended, actual, difference: "The signature grants an unlimited token permission rather than a bounded one-time action." };
  if (unexpectedMovement) return { status: "mismatch", intended, actual, difference: "The decoded transaction includes an additional asset movement outside the stated intent." };
  if (!draft.declaredAction?.trim()) return { status: "incomplete", intended, actual, difference: "Add a claimed intent to compare what you mean to do with the wallet request." };
  return { status: "matched", intended, actual, difference: "No deterministic difference was found between the stated intent and decoded request." };
}

export function createRecoveryGuidance(analysis: TransactionAnalysis): RecoveryGuidance | undefined {
  if (analysis.simulation.status !== "reverted" && analysis.verification.status !== "failed") return undefined;
  const detail = analysis.simulation.status === "reverted" ? analysis.simulation.detail : analysis.verification.detail;
  const lower = detail.toLowerCase();
  if (lower.includes("allowance")) return { title: "Review the token allowance", reason: detail, fix: "Confirm the token amount and approve only the minimum required allowance before reviewing a new request." };
  if (lower.includes("insufficient output")) return { title: "Refresh the swap terms", reason: detail, fix: "Update the quoted output or slippage setting in the originating application, then inspect the new wallet request." };
  return { title: "Correct the request before signing", reason: detail, fix: "Return to the transaction details, correct the invalid value or contract parameters, then run a new X Layer simulation." };
}

export function canOpenWalletConfirmation(analysis: TransactionAnalysis | undefined) {
  return Boolean(analysis && analysis.simulation.status === "success" && analysis.risk.level !== "critical");
}

function readableDelta(value: number) {
  const magnitude = Math.abs(value).toFixed(6).replace(/\.0+$|(?<=\.\d*?)0+$/g, "");
  return `${value >= 0 ? "+" : "-"}${magnitude || "0"}`;
}

function expectedDelta(direction: "out" | "in" | "approval", amount: string) {
  if (direction === "approval") return `Permission: ${amount}`;
  return `${direction === "out" ? "-" : "+"}${amount}`;
}

export function createVerificationDiff(analysis: TransactionAnalysis): VerificationDiff {
  const expectedMovements = analysis.movements;
  const traceDeltas = analysis.traceDeltas ?? [];
  const traceStatus = analysis.traceStatus;
  if (analysis.verification.status === "not-verified" || analysis.verification.status === "pending") {
    return { status: "not-ready", label: "Awaiting receipt", detail: "No transaction receipt has been verified, so Guardian does not claim an actual on-chain result.", items: expectedMovements.map((movement) => ({ asset: movement.asset, symbol: movement.symbol, expected: expectedDelta(movement.direction, movement.amount), outcome: "partial" })) };
  }
  if (analysis.verification.status === "failed") {
    return { status: "failed", label: "Transaction failed", detail: "The receipt reports failure. Guardian does not treat the simulated effect as completed.", items: expectedMovements.map((movement) => ({ asset: movement.asset, symbol: movement.symbol, expected: expectedDelta(movement.direction, movement.amount), actual: "No completed effect confirmed", outcome: "partial" })) };
  }

  const consumedTrace = new Set<number>();
  const items: VerificationDiffItem[] = expectedMovements.map((movement) => {
    const before = analysis.before.find((item) => item.asset === movement.asset || item.symbol === movement.symbol);
    const after = analysis.after.find((item) => item.asset === movement.asset || item.symbol === movement.symbol);
    if (movement.direction === "approval") {
      const afterAllowance = after?.allowance;
      if (afterAllowance === undefined || analysis.decoded.unlimitedApproval) return { asset: movement.asset, symbol: movement.symbol, expected: expectedDelta(movement.direction, movement.amount), actual: afterAllowance === undefined ? "Allowance state unavailable" : `Current allowance ${afterAllowance}`, outcome: "partial" };
      const matches = Number.isFinite(Number(afterAllowance)) && Number.isFinite(Number(movement.amount)) && Math.abs(Number(afterAllowance) - Number(movement.amount)) <= 0.000001;
      return { asset: movement.asset, symbol: movement.symbol, expected: expectedDelta(movement.direction, movement.amount), actual: `Current allowance ${afterAllowance}`, outcome: matches ? "matched" : "mismatch" };
    }
    const traceIndex = traceDeltas.findIndex((delta, index) => !consumedTrace.has(index) && delta.asset.toLowerCase() === movement.asset.toLowerCase() && delta.direction === movement.direction);
    if (traceIndex >= 0) {
      consumedTrace.add(traceIndex);
      const traced = traceDeltas[traceIndex];
      const expectedAmount = Number(movement.amount);
      const tracedAmount = Number(traced.amount);
      const actual = `${traced.direction === "out" ? "-" : "+"}${traced.amount}`;
      return { asset: movement.asset, symbol: traced.symbol || movement.symbol, expected: expectedDelta(movement.direction, movement.amount), actual, outcome: Number.isFinite(expectedAmount) && Number.isFinite(tracedAmount) && Math.abs(expectedAmount - tracedAmount) <= 0.000001 ? "matched" : "mismatch" };
    }
    const startingAmount = Number(before?.amount);
    const endingAmount = Number(after?.amount);
    const expectedAmount = Number(movement.amount);
    if (!Number.isFinite(startingAmount) || !Number.isFinite(endingAmount) || !Number.isFinite(expectedAmount)) return { asset: movement.asset, symbol: movement.symbol, expected: expectedDelta(movement.direction, movement.amount), actual: "Balance delta unavailable", outcome: "partial" };
    const actual = endingAmount - startingAmount;
    const target = movement.direction === "out" ? -expectedAmount : expectedAmount;
    return { asset: movement.asset, symbol: movement.symbol, expected: expectedDelta(movement.direction, movement.amount), actual: readableDelta(actual), outcome: Math.abs(actual - target) <= 0.000001 ? "matched" : "mismatch" };
  });
  traceDeltas.forEach((delta, index) => {
    if (consumedTrace.has(index)) return;
    items.push({ asset: delta.asset, symbol: delta.symbol, expected: "Not decoded", actual: `${delta.direction === "out" ? "-" : "+"}${delta.amount}`, outcome: "partial" });
  });
  if (items.some((item) => item.outcome === "mismatch")) return { status: "mismatch", label: "Difference found", detail: "Verified balance evidence differs from the decoded expected movement. Review the individual asset deltas before taking further action.", items };
  if (items.some((item) => item.outcome === "partial")) return { status: "partial", label: traceStatus === "partial" ? "Trace partial" : "Partially verified", detail: traceDeltas.length ? "The configured trace source exposed additional or incomplete wallet-attributed standard ERC-20 transfer asset deltas. Guardian shows each observed asset without asserting an unobserved cause." : "The receipt is verified, but available chain reads cannot establish every expected asset delta. Guardian has not inferred the missing result.", items };
  if (traceStatus === "unavailable") return { status: "partial", label: "Trace unavailable", detail: analysis.traceDetail ?? "The receipt is verified, but no configured trace-capable upstream returned complete before-and-after evidence for wallet-attributed standard ERC-20 transfer assets.", items };
  if (traceStatus === "partial") return { status: "partial", label: "Trace partial", detail: analysis.traceDetail ?? "The configured trace provider returned incomplete before-and-after evidence for wallet-attributed standard ERC-20 transfer assets.", items };
  if (traceStatus === "complete") return { status: "matched", label: "Trace complete", detail: analysis.traceDetail ?? "The configured trace provider returned before-and-after evidence for every wallet-attributed standard ERC-20 transfer asset detected in this receipt.", items };
  return { status: "matched", label: "Matched available evidence", detail: "Verified on-chain balance deltas match the decoded expected movements shown for this review; complete trace evidence was not requested.", items };
}
