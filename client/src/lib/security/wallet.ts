import { getXLayerNetwork, toChainHex, walletNetworkParameter } from "./config";
import type { Eip1193Provider, WalletState, XLayerNetwork } from "./types";

declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      providers?: Eip1193Provider[];
      isOkxWallet?: boolean;
      isOKExWallet?: boolean;
    };
    okxwallet?: Eip1193Provider & {
      isOkxWallet?: boolean;
      isOKExWallet?: boolean;
    };
  }
}

export function getInjectedWallet(): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  const providers = window.ethereum?.providers;
  const okxProvider = providers?.find((provider) => "isOkxWallet" in provider || "isOKExWallet" in provider);
  return okxProvider ?? window.ethereum ?? window.okxwallet;
}

function providerLabel(provider: Eip1193Provider) {
  if ("isOkxWallet" in provider || "isOKExWallet" in provider) return "OKX Wallet";
  return provider.isMetaMask ? "MetaMask" : "EIP-1193 wallet";
}

export async function readWalletAccounts(provider = getInjectedWallet()): Promise<string[]> {
  if (!provider) return [];
  const accountsResult = await provider.request({ method: "eth_accounts" });
  return Array.isArray(accountsResult) ? accountsResult.filter((account): account is string => typeof account === "string") : [];
}

export async function readWalletState(provider = getInjectedWallet()): Promise<WalletState> {
  if (!provider) return { available: false, connected: false, providerLabel: "No wallet provider detected in this browser" };
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
    providerLabel: providerLabel(provider),
  };
}

export async function connectWallet(provider = getInjectedWallet()): Promise<WalletState> {
  if (!provider) throw new Error("No wallet provider was detected. Use MetaMask/OKX Wallet on desktop, or open this site inside a wallet app browser.");
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
