import { getXLayerNetwork, toChainHex, walletNetworkParameter } from "./config";
import type { Eip1193Provider, WalletState, XLayerNetwork } from "./types";

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export function getInjectedWallet(): Eip1193Provider | undefined {
  return typeof window === "undefined" ? undefined : window.ethereum;
}

export async function readWalletAccounts(provider = getInjectedWallet()): Promise<string[]> {
  if (!provider) return [];
  const accountsResult = await provider.request({ method: "eth_accounts" });
  return Array.isArray(accountsResult) ? accountsResult.filter((account): account is string => typeof account === "string") : [];
}

export async function readWalletState(provider = getInjectedWallet()): Promise<WalletState> {
  if (!provider) return { available: false, connected: false, providerLabel: "No EIP-1193 wallet detected" };
  const [accounts, chainResult] = await Promise.all([
    readWalletAccounts(provider),
    provider.request({ method: "eth_chainId" }),
  ]);
  const chainId = typeof chainResult === "string" ? Number.parseInt(chainResult, 16) : undefined;
  return {
    available: true,
    connected: Boolean(accounts[0]),
    address: accounts[0],
    chainId,
    providerLabel: provider.isMetaMask ? "MetaMask" : "EIP-1193 wallet",
  };
}

export async function connectWallet(provider = getInjectedWallet()): Promise<WalletState> {
  if (!provider) throw new Error("No EIP-1193 wallet was detected. Install or unlock MetaMask, then try again.");
  await provider.request({ method: "eth_requestAccounts" });
  return readWalletState(provider);
}

export async function ensureXLayerNetwork(network: XLayerNetwork, provider = getInjectedWallet()) {
  if (!provider) throw new Error("No EIP-1193 wallet was detected.");
  const desiredChainId = toChainHex(network.chainId);
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: desiredChainId }] });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? (error as { code?: number }).code : undefined;
    if (code !== 4902) throw error;
    await provider.request({ method: "wallet_addEthereumChain", params: [walletNetworkParameter(network)] });
  }
}

export async function submitThroughWallet(transaction: { from: string; to: string; value: string; data: string }, provider = getInjectedWallet()) {
  if (!provider) throw new Error("No EIP-1193 wallet was detected.");
  const hash = await provider.request({
    method: "eth_sendTransaction",
    params: [{ from: transaction.from, to: transaction.to, value: toChainHex(BigInt(transaction.value || "0")), data: transaction.data || "0x" }],
  });
  if (typeof hash !== "string") throw new Error("The wallet did not return a transaction hash.");
  return hash;
}

export function connectedXLayerNetwork(wallet: WalletState) {
  return wallet.chainId ? getXLayerNetwork(wallet.chainId) : undefined;
}
