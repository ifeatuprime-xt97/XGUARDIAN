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

type Eip6963ProviderDetail = {
  info?: {
    name?: string;
    rdns?: string;
  };
  provider: Eip1193Provider;
};

const announcedProviders = new Map<Eip1193Provider, Eip6963ProviderDetail["info"]>();
let eip6963DiscoveryRequested = false;

function requestAnnouncedProviders() {
  if (
    typeof window === "undefined" ||
    typeof window.addEventListener !== "function" ||
    typeof window.dispatchEvent !== "function" ||
    eip6963DiscoveryRequested
  )
    return;
  eip6963DiscoveryRequested = true;
  window.addEventListener("eip6963:announceProvider", (event) => {
    const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
    if (detail?.provider) {
      announcedProviders.set(detail.provider, detail.info);
    }
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

export function getInjectedWallet(): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  requestAnnouncedProviders();
  const announced = [...announcedProviders.keys()];
  if (announced.length > 0) return announced[0];
  const providers = window.ethereum?.providers;
  const okxProvider = Array.isArray(providers)
    ? providers.find((p) => "isOkxWallet" in p || "isOKExWallet" in p)
    : undefined;
  return okxProvider ?? window.ethereum ?? window.okxwallet;
}

/** Tracks whichever provider successfully connected, so all subsequent calls use the same one. */
let activeProvider: Eip1193Provider | undefined;
type WalletConnectProvider = Eip1193Provider & { connect: () => Promise<void> };
let walletConnectProvider: WalletConnectProvider | undefined;

async function getWalletConnectProvider(): Promise<WalletConnectProvider> {
  if (walletConnectProvider) return walletConnectProvider;
  const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
  if (typeof projectId !== "string" || !projectId.trim()) {
    throw new Error(
      "Mobile wallet connection is not configured. Set VITE_WALLETCONNECT_PROJECT_ID, or open this site inside a wallet app."
    );
  }
  const { default: EthereumProvider } = await import("@walletconnect/ethereum-provider");
  const provider = (await EthereumProvider.init({
    projectId: projectId.trim(),
    chains: [196],
    optionalChains: [1952],
    showQrModal: true,
    qrModalOptions: { themeMode: "dark" },
    metadata: {
      name: "X Layer Guardian",
      description: "Inspect X Layer transactions before signing.",
      url: window.location.origin,
      icons: [`${window.location.origin}/xlogo.png`],
    },
  })) as unknown as WalletConnectProvider;
  walletConnectProvider = provider;
  return provider;
}

async function connectThroughWalletConnect(): Promise<WalletState> {
  const provider = await getWalletConnectProvider();
  await provider.connect();
  activeProvider = provider;
  return readWalletState(provider);
}

export function getActiveProvider(): Eip1193Provider | undefined {
  return activeProvider ?? getInjectedWallet();
}

function providerLabel(provider: Eip1193Provider) {
  const info = announcedProviders.get(provider);
  if (info?.name) return info.name;
  if ("isOkxWallet" in provider || "isOKExWallet" in provider) return "OKX Wallet";
  return provider.isMetaMask ? "MetaMask" : "EIP-1193 wallet";
}

/** Returns all available EIP-1193 providers in the page. */
function getAllProviders(): Eip1193Provider[] {
  if (typeof window === "undefined") return [];
  requestAnnouncedProviders();
  const providers: Eip1193Provider[] = [];
  providers.push(...announcedProviders.keys());
  // Fix 5: guard Array.isArray before spreading – some wallets set providers to non-array
  if (Array.isArray(window.ethereum?.providers) && window.ethereum!.providers!.length) {
    providers.push(...window.ethereum!.providers!);
  } else if (window.ethereum) {
    providers.push(window.ethereum);
  }
  if (window.okxwallet && !providers.includes(window.okxwallet)) {
    providers.push(window.okxwallet);
  }
  return [...new Set(providers)];
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

export async function connectWallet(provider?: Eip1193Provider): Promise<WalletState> {
  const injectedProvider = provider ?? getInjectedWallet();
  if (!injectedProvider) return connectThroughWalletConnect();

  const tryConnect = async (p: Eip1193Provider): Promise<WalletState> => {
    await p.request({ method: "eth_requestAccounts" });
    activeProvider = p;
    return readWalletState(p);
  };

  try {
    return await tryConnect(injectedProvider);
  } catch (error) {
    if (isProviderUnavailableError(error)) {
      const allProviders = getAllProviders().filter((p) => p !== injectedProvider);
      for (const fallback of allProviders) {
        try {
          return await tryConnect(fallback);
        } catch (fallbackError) {
          if (!isProviderUnavailableError(fallbackError)) throw fallbackError;
        }
      }
      return connectThroughWalletConnect();
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
