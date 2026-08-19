import { afterEach, describe, expect, it, vi } from "vitest";
import { clearRegisteredChainProvider, createChainProvider, registerChainProvider, type ChainProvider } from "./chainProvider";
import { createLiveAssetComparison, decodedAssetMovements } from "./assetComparison";
import { createConfiguredTraceProvider } from "./traceProvider";
import { getXLayerRuntimeConfig, OFFICIAL_XLAYER_NETWORKS, toChainHex } from "./config";
import { calldataForAddress, calldataForUint, createSelectorRegistry, decodeTransaction, ERC20_APPROVE_SELECTOR, ERC20_TRANSFER_SELECTOR, MAX_UINT256 } from "./decoder";
import { DEMO_SCENARIOS } from "./demo";
import { evaluateRisk } from "./risk";
import { readXLayerErc20Evidence, readXLayerReceiptTokenDeltas, simulateOnXLayer, verifyXLayerReceipt } from "./simulation";

const account = "0x1111111111111111111111111111111111111111";
const recipient = "0x2222222222222222222222222222222222222222";

afterEach(() => vi.unstubAllGlobals());

describe("X Layer runtime configuration", () => {
  it("uses the official X Layer network defaults", () => {
    const config = getXLayerRuntimeConfig({});
    expect(config.mainnet.chainId).toBe(196);
    expect(config.testnet.chainId).toBe(1952);
    expect(config.mainnet.rpcUrl).toBe(OFFICIAL_XLAYER_NETWORKS.mainnet.rpcUrl);
    expect(toChainHex(1952)).toBe("0x7a0");
  });

  it("accepts valid environment URL overrides and rejects invalid overrides", () => {
    expect(getXLayerRuntimeConfig({ VITE_XLAYER_MAINNET_RPC_URL: "https://rpc.example.org/" }).mainnet.rpcUrl).toBe("https://rpc.example.org");
    expect(getXLayerRuntimeConfig({ VITE_XLAYER_MAINNET_RPC_URL: "javascript:alert(1)" }).mainnet.rpcUrl).toBe(OFFICIAL_XLAYER_NETWORKS.mainnet.rpcUrl);
  });
});

describe("calldata decoding", () => {
  it("decodes an unlimited approval deterministically", () => {
    const data = `${ERC20_APPROVE_SELECTOR}${calldataForAddress(recipient)}${calldataForUint(BigInt(MAX_UINT256))}`;
    const decoded = decodeTransaction({ from: account, to: account, value: "0", data, chainId: 1952 });
    expect(decoded.kind).toBe("erc20-approval");
    expect(decoded.unlimitedApproval).toBe(true);
    expect(decoded.spender?.toLowerCase()).toBe(recipient.toLowerCase());
  });

  it("decodes a transfer and protects against malformed calldata", () => {
    const data = `${ERC20_TRANSFER_SELECTOR}${calldataForAddress(recipient)}${calldataForUint(BigInt(5) * BigInt("1000000000000000000"))}`;
    expect(decodeTransaction({ to: account, value: "0", data, chainId: 1952 }).kind).toBe("erc20-transfer");
    expect(decodeTransaction({ to: account, value: "0", data: "0x095ea7b3bad", chainId: 1952 }).opaque).toBe(true);
  });

  it("accepts a pluggable decoder while retaining an opaque fallback", () => {
    const registry = createSelectorRegistry([["0xdec0de01", (target) => ({ kind: "contract-call", selector: "0xdec0de01", method: "Custom protocol action", summary: "Decoded by an injected protocol registry.", target, source: "Test registry", warnings: [] })]]);
    const decoded = decodeTransaction({ to: account, value: "0", data: "0xdec0de01", chainId: 1952 }, registry);
    expect(decoded.method).toBe("Custom protocol action");
    expect(decoded.source).toBe("Test registry");
  });
});

describe("risk engine and demo contracts", () => {
  it("escalates unlimited allowances to critical", () => {
    const decoded = decodeTransaction({ to: account, value: "0", data: `${ERC20_APPROVE_SELECTOR}${calldataForAddress(recipient)}${calldataForUint(BigInt(MAX_UINT256))}`, chainId: 1952 });
    const report = evaluateRisk({
      draft: { to: account, value: "0", data: "0x", chainId: 1952 },
      decoded,
      simulation: { status: "success", title: "OK", detail: "OK" },
      reputation: { status: "unknown", provider: "test", detail: "unknown" },
    });
    expect(report.level).toBe("critical");
    expect(report.findings.some((finding) => finding.id === "unlimited-approval")).toBe(true);
  });

  it("defines six complete demo scenarios", () => {
    expect(DEMO_SCENARIOS).toHaveLength(6);
    expect(DEMO_SCENARIOS.map((scenario) => scenario.id)).toContain("verified-transaction");
    expect(DEMO_SCENARIOS.every((scenario) => scenario.analysis.risk.level)).toBe(true);
    expect(DEMO_SCENARIOS.find((scenario) => scenario.id === "safe-transfer")?.analysis.risk.level).toBe("safe");
    expect(DEMO_SCENARIOS.find((scenario) => scenario.id === "unlimited-approval")?.analysis.risk.level).toBe("critical");
    expect(DEMO_SCENARIOS.find((scenario) => scenario.id === "failed-transaction")?.analysis.risk.level).toBe("warning");
  });
});

describe("simulation boundaries", () => {
  it("does not imply a live dry run for an unsupported network", async () => {
    const result = await simulateOnXLayer({ to: account, value: "0", data: "0x", chainId: 1 });
    expect(result.status).toBe("unavailable");
    expect(result.providerChecked).toBeUndefined();
  });

  it("uses injected chain and monitoring adapters without an RPC dependency", async () => {
    const fakeProvider: ChainProvider = {
      id: "test-provider",
      simulate: async () => ({ gasEstimate: "21000", returnData: "0x" }),
      readNativeBalance: async () => "3.5",
      readReceipt: async () => ({ successful: true, blockNumber: "42" }),
      readErc20Evidence: async (owner, token, _network, spender) => ({ tokenAddress: token, symbol: "USDT", decimals: 18, ownerAddress: owner, balance: "12.5", spender, allowance: spender ? "2" : undefined, detail: "Test token evidence" }),
    };
    registerChainProvider("test-provider", () => fakeProvider);
    expect(createChainProvider("test-provider")?.id).toBe("test-provider");
    const simulation = await simulateOnXLayer({ to: account, value: "0", data: "0x", chainId: 1952 }, fakeProvider);
    const receipt = await verifyXLayerReceipt("0xabc", 1952, fakeProvider);
    const token = await readXLayerErc20Evidence(account, recipient, 1952, account, fakeProvider);
    expect(simulation).toMatchObject({ status: "success", gasEstimate: "21000" });
    expect(receipt).toMatchObject({ status: "verified", transactionHash: "0xabc" });
    expect(token).toMatchObject({ symbol: "USDT", balance: "12.5", allowance: "2" });
    clearRegisteredChainProvider("test-provider");
  });

  it("preserves injected configured trace evidence with true before-and-after token values", async () => {
    const trace = await readXLayerReceiptTokenDeltas("0xabc", account, 1952, { id: "trace-test", readTokenDeltas: async () => ({ providerId: "trace-test", status: "complete", detail: "Two trace-backed token deltas", deltas: [{ asset: account, symbol: "USDT", amount: "2", direction: "out", beforeAmount: "12", afterAmount: "10", detail: "Trace-backed balance delta" }, { asset: recipient, symbol: "WOKB", amount: "0.1", direction: "in", beforeAmount: "1", afterAmount: "1.1", detail: "Trace-backed balance delta" }] }) });
    expect(trace).toMatchObject({ status: "complete", deltas: [{ symbol: "USDT", beforeAmount: "12", afterAmount: "10" }, { symbol: "WOKB" }] });
  });

  it("labels trace evidence unavailable when no trace endpoint or injected trace adapter exists", async () => {
    const trace = await readXLayerReceiptTokenDeltas("0xabc", account, 1952);
    expect(trace).toMatchObject({ status: "unavailable", deltas: [] });
  });

  it("labels a configured endpoint unavailable when it rejects the documented trace_transaction method", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32601, message: "Method not found" } }), { status: 200 })));
    const provider = createConfiguredTraceProvider({ ...getXLayerRuntimeConfig({}), traceProviderUrl: "https://trace.example" });
    const trace = await provider!.readTokenDeltas("0xabc", account, OFFICIAL_XLAYER_NETWORKS.mainnet);
    expect(trace).toMatchObject({ status: "unavailable", deltas: [] });
  });
});

describe("live asset-comparison boundaries", () => {
  it("labels decoded movement as partial without inventing an after-state delta", () => {
    const decoded = decodeTransaction({ to: account, value: "1000000000000000000", data: "0x", chainId: 1952 });
    const movements = decodedAssetMovements(decoded);
    const comparison = createLiveAssetComparison([{ asset: "native", symbol: "OKB", amount: "3.5" }], movements, false);
    expect(comparison.status).toBe("partial");
    expect(comparison.after).toEqual([]);
    expect(comparison.movements).toMatchObject([{ direction: "out", symbol: "OKB" }]);
  });
});
