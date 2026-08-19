import type { AssetComparison, AssetMovement, AssetPosition, DecodedTransaction } from "./types";

export function decodedAssetMovements(decoded: DecodedTransaction, nativeSymbol = "OKB"): AssetMovement[] {
  if (decoded.kind === "native-transfer" && decoded.amountRaw && BigInt(decoded.amountRaw) > BigInt(0)) {
    return [{ asset: "native", symbol: nativeSymbol, direction: "out", amount: decoded.amount ?? "—", detail: `Decoded recipient ${decoded.recipient ?? "unknown"}` }];
  }
  if (decoded.kind === "erc20-approval" || decoded.method === "Token operator approval") {
    return [{ asset: decoded.target, symbol: "TOKEN", direction: "approval", amount: decoded.amount ?? "—", detail: `Decoded spender ${decoded.spender ?? "unknown"}` }];
  }
  if (decoded.kind === "erc20-transfer" || decoded.kind === "erc20-transfer-from") {
    return [{ asset: decoded.target, symbol: "TOKEN", direction: "out", amount: decoded.amount ?? "—", detail: `Decoded recipient ${decoded.recipient ?? "unknown"}` }];
  }
  return [];
}

export function createLiveAssetComparison(before: AssetPosition[], movements: AssetMovement[], traceProviderConfigured: boolean): AssetComparison {
  if (traceProviderConfigured) {
    return {
      status: "unsupported",
      detail: "A trace provider endpoint is configured, but no trace adapter is registered. Guardian shows only decoded effects and current balances.",
      before,
      after: [],
      movements,
    };
  }
  return {
    status: "partial",
    detail: "Current native balance and decoded effects are available. A trace-capable simulation provider is required for a complete pre-signing after-state balance delta.",
    before,
    after: [],
    movements,
  };
}

export function createVerifiedNativeComparison(before: AssetPosition[], afterNative: AssetPosition, movements: AssetMovement[]): AssetComparison {
  return {
    status: "available",
    detail: "Native balance was read again after the X Layer receipt was verified. Token deltas remain limited to decoded effects unless a trace provider is installed.",
    before,
    after: [afterNative],
    movements,
  };
}

export function createVerifiedAssetComparison(before: AssetPosition[], after: AssetPosition[], movements: AssetMovement[]): AssetComparison {
  const tokenMovement = movements.some((movement) => movement.asset !== "native");
  const hasTokenAfterState = after.some((item) => item.asset !== "native");
  return {
    status: tokenMovement && !hasTokenAfterState ? "partial" : "available",
    detail: tokenMovement && !hasTokenAfterState
      ? "The X Layer receipt was verified, but token balance evidence could not be read again. Guardian keeps the decoded token effect separate from actual balance claims."
      : "X Layer receipt, native balance, and available token evidence were refreshed after confirmation.",
    before,
    after,
    movements,
  };
}
