import { afterEach, describe, expect, it, vi } from "vitest";
import { getXLayerTokenIdentity } from "./xlayerTokenIdentity";

describe("X Layer token identity", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("separates an exact OKX registry identity from an explicit OKLink verified-contract response", async () => {
    let request = 0;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(request++ === 0
      ? { tokens: [{ chainId: 196, address: "0xe538905cf8410324e03A5A23C1c177a474D59b2b", name: "Wrapped OKB", symbol: "WOKB", decimals: 18, logoURI: "https://logo.example/wokb.png" }] }
      : { code: "0", data: [{ contractName: "WOKB", compilerVersion: "v0.4.22", proxy: "0" }] }), { status: 200 })));
    const identity = await getXLayerTokenIdentity(196, "0xe538905cf8410324e03A5A23C1c177a474D59b2b");
    expect(identity.registry).toMatchObject({ status: "listed", source: "OKX X Layer Token List", symbol: "WOKB" });
    expect(identity.contract).toMatchObject({ status: "unavailable", source: "OKLink" });
  });
});
