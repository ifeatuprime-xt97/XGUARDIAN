import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEMO_SCENARIOS } from "@/lib/security/demo";
import { AnalysisBoard } from "./AnalysisBoard";

function renderScenario(id: "safe-transfer" | "failed-transaction") {
  const scenario = DEMO_SCENARIOS.find((item) => item.id === id)!;
  return renderToStaticMarkup(React.createElement(AnalysisBoard, { analysis: scenario.analysis, mode: "demo", networkName: "X Layer Testnet" }));
}

describe("decision-first AnalysisBoard disclosure", () => {
  it("renders the safe decision and immediate consequence before the collapsed secondary evidence", () => {
    const html = renderScenario("safe-transfer");
    expect(html).toContain("Before you sign");
    expect(html).toContain("Send 10.00 USDT");
    expect(html).toMatch(/<details class="review-details">/);
    expect(html).not.toMatch(/<details class="review-details" open=""/);
    expect(html.indexOf("Before you sign")).toBeLessThan(html.indexOf("Review details"));
    expect(html.indexOf("Review details")).toBeLessThan(html.indexOf("Signing consequence"));
  });

  it("keeps recovery action primary before the same collapsed evidence boundary", () => {
    const html = renderScenario("failed-transaction");
    expect(html).toContain("Next action");
    expect(html).toContain("Edit &amp; review");
    expect(html.indexOf("Next action")).toBeLessThan(html.indexOf("Review details"));
    expect(html).toMatch(/<details class="review-details">/);
    expect(html).not.toMatch(/<details class="review-details" open=""/);
    expect(html.indexOf("Review details")).toBeLessThan(html.indexOf("Signing consequence"));
  });

  it("renders registry imagery and a verification label only from explicit trusted token identity evidence", () => {
    const scenario = DEMO_SCENARIOS.find((item) => item.id === "safe-transfer")!;
    const html = renderToStaticMarkup(React.createElement(AnalysisBoard, { analysis: scenario.analysis, mode: "demo", networkName: "X Layer Mainnet", tokenIdentity: { chainId: 196, address: scenario.analysis.decoded.target, registry: { status: "listed", source: "OKX X Layer Token List", name: "USD Coin", symbol: "USDC", logoUri: "https://logo.example/usdc.png" }, contract: { status: "verified", source: "OKLink", contractName: "USDC", detail: "Verified source" } } }));
    expect(html).toContain('src="https://logo.example/usdc.png"');
    expect(html).toContain("Listed in OKX X Layer Token List");
    expect(html).toContain("Verified by OKLink");
  });

  it("keeps configured trace scope visible in the verification interface", () => {
    const scenario = DEMO_SCENARIOS.find((item) => item.id === "safe-transfer")!;
    const html = renderToStaticMarkup(React.createElement(AnalysisBoard, { analysis: { ...scenario.analysis, verification: { status: "verified", label: "Receipt verified", detail: "Verified" }, traceStatus: "unavailable" }, mode: "demo", networkName: "X Layer Mainnet" }));
    expect(html).toContain("Trace unavailable");
    expect(html).toContain("wallet-attributed standard ERC-20 transfer assets");
  });
});
