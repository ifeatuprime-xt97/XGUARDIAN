import { describe, expect, it } from "vitest";
import { deterministicExplanation } from "./guardianExplanation";

describe("Guardian AI explanation boundary", () => {
  it("creates a concise explanation from supplied deterministic evidence only", () => {
    const result = deterministicExplanation({
      intent: "Swap 10 USDT",
      actual: "Approve unlimited USDT allowance for 0x4444",
      network: "X Layer Testnet",
      simulation: { status: "success", detail: "The dry run completed." },
      findings: [{ title: "Unlimited token approval", detail: "The spender can use the token allowance without an amount cap.", level: "critical" }],
      movements: [{ symbol: "USDT", amount: "Unlimited", direction: "approval", detail: "Spender 0x4444" }],
    });
    expect(result.source).toBe("deterministic-fallback");
    expect(result.explanation).toContain("unlimited");
    expect(result.questions).toHaveLength(3);
  });
});
