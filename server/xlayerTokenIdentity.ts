import { isAddress } from "viem";
import type { TokenIdentity } from "../shared/tokenIdentity";

const TOKEN_LIST_URL = "https://raw.githubusercontent.com/okx/xlayer-tokenlist/main/xlayer.tokenlist.json";
const OKLINK_CONTRACT_URL = "https://www.oklink.com/api/v5/explorer/contract/verify-contract-info";
const CACHE_MS = 10 * 60 * 1000;

type RegistryToken = { chainId?: number; address?: string; name?: string; symbol?: string; decimals?: number; logoURI?: string };
let cachedTokens: RegistryToken[] | undefined;
let cachedAt = 0;

async function json(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Metadata source returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

async function loadRegistry() {
  if (cachedTokens && Date.now() - cachedAt < CACHE_MS) return cachedTokens;
  const payload = await json(TOKEN_LIST_URL) as { tokens?: unknown };
  if (!Array.isArray(payload.tokens)) throw new Error("Token registry did not contain a tokens array.");
  cachedTokens = payload.tokens.filter((item): item is RegistryToken => Boolean(item && typeof item === "object"));
  cachedAt = Date.now();
  return cachedTokens;
}

export async function getXLayerTokenIdentity(chainId: number, address: string): Promise<TokenIdentity> {
  const identity: TokenIdentity = {
    chainId,
    address,
    registry: { status: "unavailable" },
    contract: { status: "unavailable", detail: "Verified-contract information has not been retrieved." },
  };
  if (chainId !== 196 || !isAddress(address)) {
    return { ...identity, registry: { status: "not-listed" }, contract: { status: "unavailable", detail: "The public X Layer mainnet registry and OKLink lookup apply only to a valid X Layer mainnet contract address." } };
  }
  try {
    const tokens = await loadRegistry();
    const token = tokens.find((item) => item.chainId === chainId && item.address?.toLowerCase() === address.toLowerCase());
    identity.registry = token ? { status: "listed", source: "OKX X Layer Token List", logoUri: typeof token.logoURI === "string" ? token.logoURI : undefined, name: typeof token.name === "string" ? token.name : undefined, symbol: typeof token.symbol === "string" ? token.symbol : undefined, decimals: typeof token.decimals === "number" ? token.decimals : undefined } : { status: "not-listed" };
  } catch {
    identity.registry = { status: "unavailable" };
  }
  try {
    // OKLink API is currently bypassed as the service is down.
    identity.contract = { status: "unavailable", source: "OKLink", detail: "OKLink verified-contract information is currently unavailable." };
  } catch (error) {
    console.warn("[TokenIdentity] OKLink bypass error:", error);
    identity.contract = { status: "unavailable", source: "OKLink", detail: "OKLink verified-contract information could not be retrieved. This is not a safety verdict." };
  }
  return identity;
}
