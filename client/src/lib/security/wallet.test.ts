import { afterEach, describe, expect, it, vi } from "vitest";
import { getInjectedWallet, readWalletAccounts, readWalletState } from "./wallet";
import type { Eip1193Provider } from "./types";

function providerWith(accountsResult: unknown): Eip1193Provider {
  return {
    isMetaMask: true,
    request: async ({ method }) => {
      if (method === "eth_accounts") return accountsResult;
      if (method === "eth_chainId") return "0xc4";
      return null;
    },
  };
}

describe("browser wallet account discovery", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps all exposed EIP-1193 accounts for portfolio import", async () => {
    const provider = providerWith([
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
    ]);
    await expect(readWalletAccounts(provider)).resolves.toEqual([
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
    ]);
    await expect(readWalletState(provider)).resolves.toMatchObject({
      connected: true,
      address: "0x1111111111111111111111111111111111111111",
      providerLabel: "MetaMask",
    });
  });

  it("ignores malformed exposed account values", async () => {
    const provider = providerWith(["0x1111111111111111111111111111111111111111", 34, null]);
    await expect(readWalletAccounts(provider)).resolves.toEqual(["0x1111111111111111111111111111111111111111"]);
  });

  it("prefers an OKX provider from a multi-provider browser injection", async () => {
    const metaMask = providerWith([]);
    const okx = { ...providerWith(["0x1111111111111111111111111111111111111111"]), isOkxWallet: true };
    vi.stubGlobal("window", { ethereum: { ...metaMask, providers: [metaMask, okx] } });
    expect(getInjectedWallet()).toBe(okx);
    await expect(readWalletState()).resolves.toMatchObject({ providerLabel: "OKX Wallet" });
  });
});
