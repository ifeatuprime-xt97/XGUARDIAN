import { describe, expect, it } from "vitest";
import { activePortfolioWallet, createManagedWallet, emptyPortfolio, removePortfolioWallet, setActivePortfolioWallet, stableWalletId, upsertPortfolioWallet } from "./portfolio";

describe("wallet portfolio", () => {
  const firstAddress = "0x1111111111111111111111111111111111111111";
  const secondAddress = "0x2222222222222222222222222222222222222222";

  it("adds wallet entries and keeps the first entry active", () => {
    const first = createManagedWallet(firstAddress, "Treasury", "connected", 1);
    const second = createManagedWallet(secondAddress, "Research", "watch", 2);
    const portfolio = upsertPortfolioWallet(upsertPortfolioWallet(emptyPortfolio(), first), second);
    expect(portfolio.wallets).toHaveLength(2);
    expect(activePortfolioWallet(portfolio)?.address).toBe(firstAddress);
    expect(stableWalletId(firstAddress)).toBe(first.id);
  });

  it("can switch and remove the active wallet", () => {
    const first = createManagedWallet(firstAddress, "Treasury", "connected", 1);
    const second = createManagedWallet(secondAddress, "Research", "watch", 2);
    const portfolio = upsertPortfolioWallet(upsertPortfolioWallet(emptyPortfolio(), first), second);
    const switched = setActivePortfolioWallet(portfolio, second.id);
    expect(activePortfolioWallet(switched)?.id).toBe(second.id);
    expect(activePortfolioWallet(removePortfolioWallet(switched, second.id))?.id).toBe(first.id);
  });

  it("rejects invalid watch-wallet addresses", () => {
    expect(() => createManagedWallet("not-an-address", "Bad", "watch")).toThrow("valid EVM");
  });
});
