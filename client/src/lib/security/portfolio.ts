import { getAddress, isAddress } from "viem";
import type { ManagedWallet, WalletPortfolio } from "./types";

export const WALLET_PORTFOLIO_STORAGE_KEY = "xlayer-guardian-wallet-portfolio-v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function emptyPortfolio(): WalletPortfolio {
  return { wallets: [] };
}

export function stableWalletId(address: string) {
  return `wallet:${address.toLowerCase()}`;
}

export function createManagedWallet(address: string, label: string, kind: ManagedWallet["kind"], addedAt = Date.now()): ManagedWallet {
  if (!isAddress(address)) throw new Error("Enter a valid EVM wallet address.");
  const checksummed = getAddress(address);
  return {
    id: stableWalletId(checksummed),
    address: checksummed,
    label: label.trim() || (kind === "connected" ? "Connected wallet" : "Watch wallet"),
    kind,
    addedAt,
  };
}

export function upsertPortfolioWallet(portfolio: WalletPortfolio, wallet: ManagedWallet): WalletPortfolio {
  const prior = portfolio.wallets.find((item) => item.id === wallet.id);
  const wallets = prior ? portfolio.wallets.map((item) => item.id === wallet.id ? { ...item, ...wallet, kind: wallet.kind === "connected" ? "connected" : item.kind } : item) : [...portfolio.wallets, wallet];
  return { wallets, activeWalletId: portfolio.activeWalletId ?? wallet.id };
}

export function removePortfolioWallet(portfolio: WalletPortfolio, walletId: string): WalletPortfolio {
  const wallets = portfolio.wallets.filter((item) => item.id !== walletId);
  return { wallets, activeWalletId: portfolio.activeWalletId === walletId ? wallets[0]?.id : portfolio.activeWalletId };
}

export function setActivePortfolioWallet(portfolio: WalletPortfolio, walletId: string): WalletPortfolio {
  if (!portfolio.wallets.some((item) => item.id === walletId)) return portfolio;
  return { ...portfolio, activeWalletId: walletId };
}

export function activePortfolioWallet(portfolio: WalletPortfolio) {
  return portfolio.wallets.find((item) => item.id === portfolio.activeWalletId) ?? portfolio.wallets[0];
}

export function loadPortfolio(storage?: StorageLike): WalletPortfolio {
  if (!storage) return emptyPortfolio();
  try {
    const raw = storage.getItem(WALLET_PORTFOLIO_STORAGE_KEY);
    if (!raw) return emptyPortfolio();
    const parsed = JSON.parse(raw) as WalletPortfolio;
    if (!Array.isArray(parsed.wallets)) return emptyPortfolio();
    const wallets = parsed.wallets.filter((wallet): wallet is ManagedWallet => Boolean(wallet && typeof wallet.address === "string" && typeof wallet.label === "string" && (wallet.kind === "connected" || wallet.kind === "watch") && isAddress(wallet.address))).map((wallet) => ({ ...wallet, address: getAddress(wallet.address), id: stableWalletId(wallet.address) }));
    return { wallets, activeWalletId: wallets.some((wallet) => wallet.id === parsed.activeWalletId) ? parsed.activeWalletId : wallets[0]?.id };
  } catch {
    return emptyPortfolio();
  }
}

export function savePortfolio(portfolio: WalletPortfolio, storage?: StorageLike) {
  storage?.setItem(WALLET_PORTFOLIO_STORAGE_KEY, JSON.stringify(portfolio));
}
