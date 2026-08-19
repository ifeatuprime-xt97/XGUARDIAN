import type { XLayerNetwork, XLayerNetworkKey, XLayerRuntimeConfig } from "./types";

const OFFICIAL_NETWORKS: Record<XLayerNetworkKey, Omit<XLayerNetwork, "rpcUrl"> & { rpcUrl: string }> = {
  mainnet: {
    key: "mainnet",
    name: "X Layer Mainnet",
    chainId: 196,
    rpcUrl: "https://rpc.xlayer.tech",
    explorerUrl: "https://www.okx.com/web3/explorer/xlayer",
    nativeSymbol: "OKB",
  },
  testnet: {
    key: "testnet",
    name: "X Layer Testnet",
    chainId: 1952,
    rpcUrl: "https://testrpc.xlayer.tech/terigon",
    explorerUrl: "https://www.okx.com/web3/explorer/xlayer-test",
    nativeSymbol: "OKB",
  },
};

export const OFFICIAL_XLAYER_NETWORKS = OFFICIAL_NETWORKS;

type ConfigEnvironment = Record<string, string | boolean | undefined>;

function safeRpcUrl(candidate: string | boolean | undefined, fallback: string) {
  if (typeof candidate !== "string") return fallback;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString().replace(/\/$/, "") : fallback;
  } catch {
    return fallback;
  }
}

function optionalHttpUrl(candidate: string | boolean | undefined) {
  if (typeof candidate !== "string" || !candidate) return undefined;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString().replace(/\/$/, "") : undefined;
  } catch {
    return undefined;
  }
}

export function getXLayerRuntimeConfig(environment: ConfigEnvironment = import.meta.env): XLayerRuntimeConfig {
  return {
    mainnet: {
      ...OFFICIAL_NETWORKS.mainnet,
      rpcUrl: safeRpcUrl(environment.VITE_XLAYER_MAINNET_RPC_URL, OFFICIAL_NETWORKS.mainnet.rpcUrl),
    },
    testnet: {
      ...OFFICIAL_NETWORKS.testnet,
      rpcUrl: safeRpcUrl(environment.VITE_XLAYER_TESTNET_RPC_URL, OFFICIAL_NETWORKS.testnet.rpcUrl),
    },
    reputationApiUrl: optionalHttpUrl(environment.VITE_XLAYER_REPUTATION_API_URL),
    traceProviderUrl: optionalHttpUrl(environment.VITE_XLAYER_TRACE_PROVIDER_URL),
    chainProviderKind: typeof environment.VITE_XLAYER_PROVIDER_KIND === "string" && environment.VITE_XLAYER_PROVIDER_KIND.trim() ? environment.VITE_XLAYER_PROVIDER_KIND.trim() : "viem-rpc",
  };
}

export const XLAYER_CONFIG = getXLayerRuntimeConfig();

export function getXLayerNetwork(chainId: number, config = XLAYER_CONFIG): XLayerNetwork | undefined {
  if (chainId === config.mainnet.chainId) return config.mainnet;
  if (chainId === config.testnet.chainId) return config.testnet;
  return undefined;
}

export function toChainHex(chainId: number | bigint) {
  return `0x${chainId.toString(16)}`;
}

export function walletNetworkParameter(network: XLayerNetwork) {
  return {
    chainId: toChainHex(network.chainId),
    chainName: network.name,
    nativeCurrency: {
      name: network.nativeSymbol,
      symbol: network.nativeSymbol,
      decimals: 18,
    },
    rpcUrls: [network.rpcUrl],
    blockExplorerUrls: [network.explorerUrl],
  };
}
