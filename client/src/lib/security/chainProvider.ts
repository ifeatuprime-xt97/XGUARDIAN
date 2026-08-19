import { createPublicClient, formatEther, formatUnits, http, isAddress, type Address } from "viem";
import { XLAYER_CONFIG } from "./config";
import type { Erc20TokenEvidence, TransactionDraft, XLayerNetwork, XLayerRuntimeConfig } from "./types";

const ERC20_READ_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
] as const;

export type ProviderSimulation = {
  gasEstimate: string;
  returnData?: string;
};

export type ProviderReceipt = {
  successful: boolean;
  blockNumber: string;
};

export interface ChainProvider {
  readonly id: string;
  simulate(draft: TransactionDraft, network: XLayerNetwork): Promise<ProviderSimulation>;
  readNativeBalance(address: string, network: XLayerNetwork): Promise<string>;
  readReceipt(transactionHash: string, network: XLayerNetwork): Promise<ProviderReceipt | undefined>;
  readErc20Evidence?(owner: string, token: string, network: XLayerNetwork, spender?: string): Promise<Erc20TokenEvidence | undefined>;
}

export type ChainProviderFactory = (config: XLayerRuntimeConfig) => ChainProvider;

// Fix 3: Cache clients per RPC URL to prevent a new client instance (and HTTP connection) on every call.
const _clientCache = new Map<string, ReturnType<typeof createPublicClient>>();
function rpcClient(network: XLayerNetwork) {
  if (!_clientCache.has(network.rpcUrl)) {
    _clientCache.set(network.rpcUrl, createPublicClient({ transport: http(network.rpcUrl, { timeout: 12_000 }) }));
  }
  return _clientCache.get(network.rpcUrl)!;
}

export function createViemRpcProvider(): ChainProvider {
  return {
    id: "viem-rpc",
    async simulate(draft, network) {
      const request = {
        to: draft.to as Address,
        data: (draft.data || "0x") as `0x${string}`,
        value: BigInt(draft.value || "0"),
        ...(draft.from && isAddress(draft.from) ? { account: draft.from as Address } : {}),
      };
      const [gas, call] = await Promise.all([rpcClient(network).estimateGas(request), rpcClient(network).call(request)]);
      return { gasEstimate: gas.toString(), returnData: call.data };
    },
    async readNativeBalance(address, network) {
      const balance = await rpcClient(network).getBalance({ address: address as Address });
      return formatEther(balance);
    },
    async readReceipt(transactionHash, network) {
      try {
        const receipt = await rpcClient(network).getTransactionReceipt({ hash: transactionHash as `0x${string}` });
        return { successful: receipt.status === "success", blockNumber: receipt.blockNumber.toString() };
      } catch {
        return undefined;
      }
    },
    async readErc20Evidence(owner, token, network, spender) {
      if (!isAddress(owner) || !isAddress(token) || (spender && !isAddress(spender))) return undefined;
      const client = rpcClient(network);
      const tokenAddress = token as Address;
      try {
        const [rawBalance, rawDecimals, rawSymbol, rawAllowance] = await Promise.all([
          client.readContract({ address: tokenAddress, abi: ERC20_READ_ABI, functionName: "balanceOf", args: [owner as Address] }),
          client.readContract({ address: tokenAddress, abi: ERC20_READ_ABI, functionName: "decimals" }).catch(() => 18),
          client.readContract({ address: tokenAddress, abi: ERC20_READ_ABI, functionName: "symbol" }).catch(() => "TOKEN"),
          spender ? client.readContract({ address: tokenAddress, abi: ERC20_READ_ABI, functionName: "allowance", args: [owner as Address, spender as Address] }).catch(() => undefined) : Promise.resolve(undefined),
        ]);
        const decimals = Number(rawDecimals);
        const symbol = typeof rawSymbol === "string" && rawSymbol.trim() ? rawSymbol.trim().slice(0, 18) : "TOKEN";
        const allowance = typeof rawAllowance === "bigint" ? formatUnits(rawAllowance, decimals) : undefined;
        return { tokenAddress: token, symbol, decimals, ownerAddress: owner, balance: formatUnits(rawBalance, decimals), spender, allowance, detail: allowance !== undefined ? `Live X Layer ${symbol} balance and allowance read.` : `Live X Layer ${symbol} balance read.` };
      } catch {
        return undefined;
      }
    },
  };
}

const providerRegistry = new Map<string, ChainProviderFactory>([["viem-rpc", () => createViemRpcProvider()]]);

export function registerChainProvider(kind: string, factory: ChainProviderFactory) {
  providerRegistry.set(kind, factory);
}

export function createChainProvider(kind = XLAYER_CONFIG.chainProviderKind, config = XLAYER_CONFIG): ChainProvider | undefined {
  return providerRegistry.get(kind)?.(config);
}

export function clearRegisteredChainProvider(kind: string) {
  if (kind !== "viem-rpc") providerRegistry.delete(kind);
}
