# X Layer Guardian: Deployment and Integration Notes

## Deployment Readiness

The application is designed for managed Node hosting. The production build has been validated with `pnpm build`, while the project test suite covers the decoder, deterministic risk rules, demo scenarios, provider selection, transaction-monitor substitution, and live asset-comparison boundaries. Publishing is performed from the project interface after reviewing the saved checkpoint.

## X Layer Network Configuration

The default read-only endpoints and identifiers match the official X Layer network documentation. The frontend defaults are appropriate for development and demo usage, while production deployments should substitute a resilient RPC provider through environment configuration where operational requirements call for it.[1]

| Network | Chain ID | Default endpoint | Explorer |
| --- | ---: | --- | --- |
| X Layer Mainnet | 196 | `https://rpc.xlayer.tech` | `https://www.okx.com/web3/explorer/xlayer` |
| X Layer Testnet | 1952 | `https://testrpc.xlayer.tech/terigon` | `https://www.okx.com/web3/explorer/xlayer-test` |

| Variable | Use | Default behavior |
| --- | --- | --- |
| `VITE_XLAYER_MAINNET_RPC_URL` | Replaces the mainnet read/simulation RPC URL. | Uses the official mainnet endpoint. |
| `VITE_XLAYER_TESTNET_RPC_URL` | Replaces the testnet read/simulation RPC URL. | Uses the official testnet endpoint. |
| `VITE_XLAYER_PROVIDER_KIND` | Selects a registered blockchain adapter. | Uses `viem-rpc`. An unregistered value produces an explicit unavailable-provider state rather than silently falling back. |
| `VITE_XLAYER_TRACE_PROVIDER_URL` | Reserves a trace-capable simulation endpoint for complete pre-signing balance deltas. | No trace adapter is active; Live Mode clearly reports partial asset comparison. |
| `VITE_XLAYER_REPUTATION_API_URL` | Identifies an optional reputation source. | No reputation is claimed unless a provider returns a verified result. |
| `XLAYER_REPUTATION_API_KEY` | Server-only credential for a reputation integration. | Optional; never expose this key to the browser. |

## Provider Extension Points

The execution services depend on the `ChainProvider` and `TransactionMonitor` contracts, not on a specific RPC client. The built-in adapter is registered as `viem-rpc`. To add a trace provider, security vendor, or alternate RPC implementation, create a provider factory that implements simulation, native balance reads, and receipt reads; register it under an explicit identifier; then set `VITE_XLAYER_PROVIDER_KIND` to that identifier. This isolates transport and vendor details from the UI, decoder, risk engine, and wallet adapter.

The selector decoder likewise uses a registry rather than an execution dependency. Protocol-specific ABI decoders can be appended to a `SelectorDecoderRegistry`. Calls with unknown selectors or malformed parameters must remain visibly opaque; they must not be converted into guessed human-readable effects.

## Wallet and Network Requirements

Live Mode uses an injected EIP-1193 wallet such as MetaMask when one is available. In mobile browsers without an injected provider, it falls back to WalletConnect's QR and mobile deep-link modal when `VITE_WALLETCONNECT_PROJECT_ID` is configured. The user must explicitly approve account connection and, if needed, X Layer network switching. The app uses `wallet_switchEthereumChain` and only proposes `wallet_addEthereumChain` with the documented X Layer settings. Transaction submission invokes `eth_sendTransaction` from the connected browser wallet. The server has no private-key input, signer, relay, or fund-custody path.

> A successful dry run is not a trust guarantee. It reports the selected provider’s read-only result against current state; users must still review decoded permissions, destination, asset effects, and deterministic findings before signing.

## Live Asset Comparison Boundary

Without a trace-capable adapter, the application reports the current native balance and movements deterministically decoded from the proposed call. It deliberately leaves pre-signing `after` balances empty and labels the result **partial** because a standard RPC `eth_call` cannot reliably enumerate every storage mutation or token balance delta. After a verified receipt, the application can read a refreshed native balance; token delta interpretation remains limited to decoded effects until a trace provider is integrated.

## Operational Security Checklist

| Control | Deployment expectation |
| --- | --- |
| Wallet authority | Use only client-side EIP-1193 wallet requests. Never accept private keys, seed phrases, or server-side signatures. |
| Provider configuration | Store API credentials server-side. Do not place secrets in `VITE_` variables. |
| Contract metadata | Treat names, symbols, calldata, revert strings, and other external content as untrusted display data. |
| Risk interpretation | Display deterministic rules separately from optional explanation services. Do not let an AI response authorize execution. |
| Reputation integration | Fail closed to `unknown` or `unavailable` when the provider cannot return a verified answer. |
| Trace integration | Preserve the current partial-state disclosure until a tested trace adapter produces normalized asset deltas. |

## References

[1] [X Layer Network Information and Contracts — OKX Onchain OS](https://web3.okx.com/onchainos/dev-docs/xlayer/developer/build-on-xlayer/network-information)
