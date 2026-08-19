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
  const okxProvider = Array.isArray(providers)
    ? providers.find((p) => "isOkxWallet" in p || "isOKExWallet" in p)
    : undefined;
  return okxProvider ?? window.ethereum ?? window.okxwallet;
}

/** Tracks whichever provider successfully connected, so all subsequent calls use the same one. */
let activeProvider: Eip1193Provider | undefined;

export function getActiveProvider(): Eip1193Provider | undefined {
  return activeProvider ?? getInjectedWallet();
}

function providerLabel(provider: Eip1193Provider) {
  if ("isOkxWallet" in provider || "isOKExWallet" in provider) return "OKX Wallet";
  return provider.isMetaMask ? "MetaMask" : "EIP-1193 wallet";
}

/** Returns all available EIP-1193 providers in the page. */
function getAllProviders(): Eip1193Provider[] {
  if (typeof window === "undefined") return [];
  const providers: Eip1193Provider[] = [];
  // Fix 5: guard Array.isArray before spreading – some wallets set providers to non-array
  if (Array.isArray(window.ethereum?.providers) && window.ethereum!.providers!.length) {
    providers.push(...window.ethereum!.providers!);
  } else if (window.ethereum) {
    providers.push(window.ethereum);
  }
  if (window.okxwallet && !providers.includes(window.okxwallet)) {
    providers.push(window.okxwallet);
  }
  return providers;
}

/**
 * Fix 1: Detect whichever provider already has authorized accounts (called on
 * page bootstrap so `activeProvider` is correct after a page refresh).
 */
export async function detectActiveProvider(): Promise<Eip1193Provider | undefined> {
  if (activeProvider) return activeProvider;
  for (const provider of getAllProviders()) {
    try {
      const accounts = await provider.request({ method: "eth_accounts" });
      if (Array.isArray(accounts) && accounts.length > 0) {
        activeProvider = provider;
        return provider;
      }
    } catch {
      // provider unavailable, try next
    }
  }
  return undefined;
}

export async function readWalletAccounts(provider = getActiveProvider()): Promise<string[]> {
  if (!provider) return [];
  const accountsResult = await provider.request({ method: "eth_accounts" });
  return Array.isArray(accountsResult)
    ? accountsResult.filter((account): account is string => typeof account === "string")
    : [];
}

export async function readWalletState(provider = getActiveProvider()): Promise<WalletState> {
  if (!provider)
    return { available: false, connected: false, providerLabel: "No wallet provider detected in this browser" };
  const [accounts, chainResult] = await Promise.all([
    readWalletAccounts(provider),
    provider.request({ method: "eth_chainId" }),
  ]);
  const chainId =
    typeof chainResult === "string" ? Number.parseInt(chainResult, 16) : undefined;
  return {
    available: true,
    connected: Boolean(accounts[0]),
    address: accounts[0],
    chainId,
    providerLabel: providerLabel(provider),
  };
}

function isProviderUnavailableError(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "message" in error) {
    const msg = String((error as { message?: unknown }).message).toLowerCase();
    if (msg.includes("unable to find any account")) return true;
    if (msg.includes("user rejected")) return false;
  }
  return false;
}

export async function connectWallet(provider = getInjectedWallet()): Promise<WalletState> {
  if (!provider)
    throw new Error(
      "No wallet provider was detected. Use MetaMask/OKX Wallet on desktop, or open this site inside a wallet app browser."
    );

  const tryConnect = async (p: Eip1193Provider): Promise<WalletState> => {
    await p.request({ method: "eth_requestAccounts" });
    activeProvider = p;
    return readWalletState(p);
  };

  try {
    return await tryConnect(provider);
  } catch (error) {
    if (isProviderUnavailableError(error)) {
      const allProviders = getAllProviders().filter((p) => p !== provider);
      for (const fallback of allProviders) {
        try {
          return await tryConnect(fallback);
        } catch (fallbackError) {
          if (!isProviderUnavailableError(fallbackError)) throw fallbackError;
        }
      }
      throw new Error(
        "No wallet provider was detected. Install MetaMask or OKX Wallet, then try again."
      );
    }
    throw error;
  }
}

export async function ensureXLayerNetwork(
  network: XLayerNetwork,
  provider = getActiveProvider()
) {
  if (!provider) throw new Error("No EIP-1193 wallet was detected.");
  const desiredChainId = toChainHex(network.chainId);
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: desiredChainId }],
    });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: number }).code
        : undefined;
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message).toLowerCase()
        : "";
    // Fix 9: 4902 = chain not added (EIP-3085).
    // Some wallets (Trust Wallet, Coinbase, Rabby) use -32603 or surface a
    // descriptive message instead — handle all of them.
    const isChainNotFound =
      code === 4902 ||
      code === -32603 ||
      message.includes("unrecognized chain") ||
      message.includes("chain not found") ||
      message.includes("unknown chain") ||
      message.includes("does not exist");
    if (!isChainNotFound) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [walletNetworkParameter(network)],
    });
  }
}

export async function submitThroughWallet(
  transaction: { from: string; to: string; value: string; data: string },
  provider = getActiveProvider()
) {
  if (!provider) throw new Error("No EIP-1193 wallet was detected.");
  const hash = await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: transaction.from,
        to: transaction.to,
        value: toChainHex(BigInt(transaction.value || "0")),
        data: transaction.data || "0x",
      },
    ],
  });
  if (typeof hash !== "string")
    throw new Error("The wallet did not return a transaction hash.");
  return hash;
}

export function connectedXLayerNetwork(wallet: WalletState) {
  return wallet.chainId ? getXLayerNetwork(wallet.chainId) : undefined;
}
