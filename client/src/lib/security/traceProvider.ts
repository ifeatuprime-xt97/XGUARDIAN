import { createPublicClient, decodeEventLog, formatUnits, http, isAddress, type Address } from "viem";
import type { TraceTokenDelta, XLayerNetwork, XLayerRuntimeConfig } from "./types";
import { XLAYER_CONFIG } from "./config";

const TRANSFER_ABI = [{ type: "event", name: "Transfer", inputs: [{ indexed: true, name: "from", type: "address" }, { indexed: true, name: "to", type: "address" }, { indexed: false, name: "value", type: "uint256" }], anonymous: false }] as const;
const TOKEN_READ_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
] as const;

export type TraceEvidence = { providerId: string; status: "complete" | "partial" | "unavailable"; detail: string; deltas: TraceTokenDelta[] };

export interface TraceProvider {
  readonly id: string;
  readTokenDeltas(transactionHash: string, walletAddress: string, network: XLayerNetwork): Promise<TraceEvidence>;
}

export type TraceProviderFactory = (config: XLayerRuntimeConfig) => TraceProvider | undefined;

function configuredClient(url: string) {
  return createPublicClient({ transport: http(url, { timeout: 15_000 }) });
}

type TransferAsset = { asset: Address; counterparty?: string };

async function transferAssetsFromReceipt(rpc: ReturnType<typeof createPublicClient>, transactionHash: string, walletAddress: string) {
  const receipt = await rpc.getTransactionReceipt({ hash: transactionHash as `0x${string}` });
  const wallet = walletAddress.toLowerCase();
  const assets = new Map<string, TransferAsset>();
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({ abi: TRANSFER_ABI, data: log.data, topics: log.topics });
      const args = decoded.args as { from?: string; to?: string };
      const from = args.from?.toLowerCase(); const to = args.to?.toLowerCase();
      if (decoded.eventName !== "Transfer" || !isAddress(log.address) || (from !== wallet && to !== wallet)) continue;
      assets.set(log.address.toLowerCase(), { asset: log.address as Address, counterparty: from === wallet ? args.to : args.from });
    } catch { /* Non-standard log; intentionally outside standard ERC-20 delta coverage. */ }
  }
  return { receipt, assets: [...assets.values()] };
}

export function createConfiguredTraceProvider(config: XLayerRuntimeConfig): TraceProvider | undefined {
  if (!config.traceProviderUrl) return undefined;
  return {
    id: "configured-xlayer-trace",
    async readTokenDeltas(transactionHash, walletAddress, network) {
      if (!isAddress(walletAddress)) return { providerId: "configured-xlayer-trace", status: "unavailable", detail: "The active wallet address is invalid, so trace balances cannot be attributed.", deltas: [] };
      try {
        const rpc = configuredClient(config.traceProviderUrl!);
        const trace = await rpc.request({ method: "trace_transaction" as never, params: [transactionHash] as never });
        if (!Array.isArray(trace)) return { providerId: "configured-xlayer-trace", status: "unavailable", detail: "The configured endpoint did not return the documented trace_transaction result. No trace-backed token delta is claimed.", deltas: [] };
        const { receipt, assets } = await transferAssetsFromReceipt(rpc, transactionHash, walletAddress);
        if (!assets.length) return { providerId: "configured-xlayer-trace", status: "complete", detail: "The trace endpoint completed and the receipt contained no wallet-attributed standard ERC-20 Transfer assets.", deltas: [] };
        // Fix 10: Guard against underflow – genesis block has no prior block to read.
        const previousBlock = receipt.blockNumber > 1n ? receipt.blockNumber - 1n : 0n;
        const results = await Promise.all(assets.map(async ({ asset, counterparty }) => {
          try {
            const [beforeRaw, afterRaw, decimalsRaw, symbolRaw] = await Promise.all([
              rpc.readContract({ address: asset, abi: TOKEN_READ_ABI, functionName: "balanceOf", args: [walletAddress as Address], blockNumber: previousBlock }),
              rpc.readContract({ address: asset, abi: TOKEN_READ_ABI, functionName: "balanceOf", args: [walletAddress as Address], blockNumber: receipt.blockNumber }),
              rpc.readContract({ address: asset, abi: TOKEN_READ_ABI, functionName: "decimals", blockNumber: receipt.blockNumber }).catch(() => 18),
              rpc.readContract({ address: asset, abi: TOKEN_READ_ABI, functionName: "symbol", blockNumber: receipt.blockNumber }).catch(() => "TOKEN"),
            ]);
            const decimals = Number(decimalsRaw); const symbol = typeof symbolRaw === "string" && symbolRaw.trim() ? symbolRaw.trim().slice(0, 18) : "TOKEN";
            const rawDelta = afterRaw - beforeRaw; const direction = rawDelta >= 0n ? "in" as const : "out" as const;
            return { asset, symbol, amount: formatUnits(rawDelta >= 0n ? rawDelta : -rawDelta, decimals), direction, beforeAmount: formatUnits(beforeRaw, decimals), afterAmount: formatUnits(afterRaw, decimals), counterparty, detail: `Trace endpoint verified transaction execution and read ${symbol} balance at blocks ${previousBlock} and ${receipt.blockNumber}.` };
          } catch { return undefined; }
        }));
        const deltas: TraceTokenDelta[] = results.filter((item): item is NonNullable<typeof item> => Boolean(item)).map((item) => ({ asset: item.asset, symbol: item.symbol, amount: item.amount, direction: item.direction, beforeAmount: item.beforeAmount, afterAmount: item.afterAmount, counterparty: item.counterparty, detail: item.detail }));
        const status = deltas.length === assets.length ? "complete" : "partial";
        return { providerId: "configured-xlayer-trace", status, detail: status === "complete" ? `Trace-backed before-and-after balances were read for all ${deltas.length} wallet-attributed standard ERC-20 transfer asset${deltas.length === 1 ? "" : "s"}.` : `The trace endpoint completed, but before-and-after balances were read for ${deltas.length} of ${assets.length} wallet-attributed standard ERC-20 transfer assets.`, deltas };
      } catch {
        return { providerId: "configured-xlayer-trace", status: "unavailable", detail: "The configured X Layer trace endpoint did not support trace_transaction or the requested trace data could not be read. Guardian keeps trace evidence unavailable.", deltas: [] };
      }
    },
  };
}

const traceRegistry = new Map<string, TraceProviderFactory>([["configured-xlayer-trace", createConfiguredTraceProvider]]);
export function registerTraceProvider(kind: string, factory: TraceProviderFactory) { traceRegistry.set(kind, factory); }
export function createTraceProvider(kind = "configured-xlayer-trace", config = XLAYER_CONFIG) { return traceRegistry.get(kind)?.(config); }
export function clearRegisteredTraceProvider(kind: string) { if (kind !== "configured-xlayer-trace") traceRegistry.delete(kind); }
