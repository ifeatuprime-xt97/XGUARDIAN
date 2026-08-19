import { describe, expect, it } from "vitest";
import { canRequestSignature, SCENARIO_ACTIONS } from "./experience";
import { canOpenWalletConfirmation, createIntentComparison, createRecoveryGuidance, createVerificationDiff } from "./presentation";
import { DEMO_SCENARIOS } from "./demo";
import { createManagedWallet } from "./portfolio";

describe("Guardian experience routing", () => {
  it("assigns six distinct follow-up labels to the deterministic scenarios", () => {
    const labels = Object.values(SCENARIO_ACTIONS).map((action) => action.label);
    expect(labels).toHaveLength(6);
    expect(new Set(labels).size).toBe(6);
    expect(SCENARIO_ACTIONS["failed-transaction"].section).toBe("scan");
    expect(SCENARIO_ACTIONS["unlimited-approval"].label).toBe("Keep blocked");
  });

  it("allows only the matching connected wallet to request a signature", () => {
    const address = "0x1111111111111111111111111111111111111111";
    const connected = createManagedWallet(address, "Signer", "connected");
    const watch = createManagedWallet("0x2222222222222222222222222222222222222222", "Watch", "watch");
    expect(canRequestSignature(connected, { available: true, connected: true, address })).toBe(true);
    expect(canRequestSignature(watch, { available: true, connected: true, address })).toBe(false);
    expect(canRequestSignature(connected, { available: true, connected: true, address: watch.address })).toBe(false);
  });

  it("requires a successful simulation before a wallet confirmation can open", () => {
    const safe = DEMO_SCENARIOS.find((scenario) => scenario.id === "safe-transfer")?.analysis;
    const reverted = DEMO_SCENARIOS.find((scenario) => scenario.id === "failed-transaction")?.analysis;
    expect(canOpenWalletConfirmation(safe)).toBe(true);
    expect(canOpenWalletConfirmation(reverted)).toBe(false);
    expect(createIntentComparison(DEMO_SCENARIOS.find((scenario) => scenario.id === "transaction-mismatch")!.analysis).status).toBe("mismatch");
    expect(createRecoveryGuidance(reverted)?.fix).toContain("minimum required allowance");
  });

  it("labels verified effects only when actual balance deltas support the expected movement", () => {
    const verified = DEMO_SCENARIOS.find((scenario) => scenario.id === "verified-transaction")!.analysis;
    const pending = DEMO_SCENARIOS.find((scenario) => scenario.id === "safe-transfer")!.analysis;
    expect(createVerificationDiff(verified).status).toBe("matched");
    expect(createVerificationDiff(verified).items[0]).toMatchObject({ expected: "-10.00", actual: "-10", outcome: "matched" });
    expect(createVerificationDiff(pending).status).toBe("not-ready");
  });

  it("retains observed receipt transfers that were not decoded as partial multi-token evidence", () => {
    const scenario = DEMO_SCENARIOS.find((item) => item.id === "safe-transfer")!;
    const expected = scenario.analysis.movements[0];
    const diff = createVerificationDiff({ ...scenario.analysis, verification: { status: "verified", label: "Receipt verified", detail: "Verified" }, traceDeltas: [{ asset: expected.asset, symbol: expected.symbol, amount: expected.amount, direction: "out", detail: "Observed expected transfer" }, { asset: "0x9999999999999999999999999999999999999999", symbol: "FEE", amount: "0.1", direction: "out", detail: "Observed additional transfer" }] });
    expect(diff.status).toBe("partial");
    expect(diff.items).toMatchObject([{ outcome: "matched" }, { symbol: "FEE", expected: "Not decoded", outcome: "partial" }]);
  });

  it("labels configured complete and unavailable trace states without overstating the standard ERC-20 scope", () => {
    const scenario = DEMO_SCENARIOS.find((item) => item.id === "safe-transfer")!;
    const expected = scenario.analysis.movements[0];
    const complete = createVerificationDiff({ ...scenario.analysis, verification: { status: "verified", label: "Receipt verified", detail: "Verified" }, traceStatus: "complete", traceDeltas: [{ asset: expected.asset, symbol: expected.symbol, amount: expected.amount, direction: "out", beforeAmount: "10", afterAmount: "0", detail: "Trace-backed standard ERC-20 delta" }] });
    const partial = createVerificationDiff({ ...scenario.analysis, verification: { status: "verified", label: "Receipt verified", detail: "Verified" }, traceStatus: "partial", traceDeltas: [{ asset: expected.asset, symbol: expected.symbol, amount: expected.amount, direction: "out", beforeAmount: "10", afterAmount: "0", detail: "Trace-backed standard ERC-20 delta" }, { asset: "0x9999999999999999999999999999999999999999", symbol: "FEE", amount: "0.1", direction: "out", detail: "Observed additional standard ERC-20 asset" }] });
    const unavailable = createVerificationDiff({ ...scenario.analysis, verification: { status: "verified", label: "Receipt verified", detail: "Verified" }, traceStatus: "unavailable" });
    expect(complete).toMatchObject({ label: "Trace complete", status: "matched" });
    expect(unavailable).toMatchObject({ label: "Trace unavailable", status: "partial" });
    expect(partial).toMatchObject({ label: "Trace partial", status: "partial" });
    [complete.detail, partial.detail, unavailable.detail].forEach((detail) => expect(detail).toContain("wallet-attributed standard ERC-20 transfer asset"));
  });
});
