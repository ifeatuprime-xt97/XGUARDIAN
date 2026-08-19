# X Layer Guardian: Architecture and Implementation Plan

## Product Boundary

X Layer Guardian is an inspection surface that helps a user understand the consequence of a proposed EVM transaction **before** they authorize their wallet to sign it. It is not a wallet, custodian, transaction relayer, or server-side signer. Signing and submission remain in the user's EIP-1193-compatible wallet.

The experience has two deliberately distinct paths. **Demo Mode** contains deterministic, inspectable scenarios and never connects to a wallet. **Live Mode** is enabled only after the browser detects an EIP-1193 provider and the user explicitly connects an account. An always-visible status control identifies the active path as `DEMO` or `LIVE`.

## Verified X Layer Network Configuration

The live provider defaults to the public RPC endpoints and chain identifiers published in the [official X Layer network documentation](https://web3.okx.com/onchainos/dev-docs/xlayer/developer/build-on-xlayer/network-information). The endpoints were checked with `eth_chainId` during implementation planning: mainnet returned `0xc4` (196), and testnet returned `0x7a0` (1952).

| Network | Chain ID | Default RPC endpoint | Explorer | Native token |
| --- | ---: | --- | --- | --- |
| X Layer Mainnet | 196 (`0xc4`) | `https://rpc.xlayer.tech` | `https://www.okx.com/web3/explorer/xlayer` | OKB |
| X Layer Testnet | 1952 (`0x7a0`) | `https://testrpc.xlayer.tech/terigon` | `https://www.okx.com/web3/explorer/xlayer-test` | OKB |

> The implementation keeps these defaults only as safe fallbacks. Runtime configuration can override the RPC URLs and enable or disable mainnet through environment variables, without changing transaction-analysis logic.

## Modular Runtime Design

| Layer | Responsibility | Replacement boundary | Security rule |
| --- | --- | --- | --- |
| UI experience | Scenario selection, inspection, before/after visualization, status and errors | React components consume analysis contracts only | Never implies a simulation or reputation check occurred when it did not. |
| Wallet adapter | EIP-1193 discovery, account request, chain detection, switching, wallet submission preparation | `WalletAdapter` interface | Only the browser wallet can sign or submit a transaction. |
| X Layer provider | RPC reads, gas estimation, `eth_call`, receipt lookup and current chain reads | `ChainProvider` interface configured by environment | No private key, mnemonic, or signing endpoint is accepted. |
| Calldata decoder | Detects native transfer, `approve`, `transfer`, `transferFrom`, and recognised selectors | `TransactionDecoder` interface | Unrecognised calldata is labelled opaque; it is never guessed. |
| Simulation engine | Uses RPC state reads, `eth_estimateGas` and `eth_call` to produce a factual success/failure result | `SimulationEngine` interface | Simulation limitations and RPC errors are explicit. No predicted balance delta is fabricated. |
| Risk engine | Applies deterministic policies to decoded actions and transaction metadata | `RiskEngine` interface | Findings show their rule source separately from explanatory language. |
| Reputation adapter | Reports local allow/block entries and external-provider availability | `ReputationProvider` interface | `unknown` is not represented as trusted. External metadata is untrusted. |
| AI interpretation | Optional concise explanation of structured deterministic findings | `ExplanationProvider` interface | It receives normalized, sanitized fields only and cannot cause transaction execution. |
| Transaction monitoring | Reads a submitted transaction receipt by hash | `ReceiptReader` interface | A transaction is marked verified only from an actual receipt or a labeled demo result. |

## Runtime Configuration

The provider factory will read optional environment variables. The application remains functional with official public RPC defaults for read-only inspection, but production deployments should configure preferred RPC infrastructure through these variables.

| Variable | Purpose | Required for the initial build |
| --- | --- | --- |
| `VITE_XLAYER_MAINNET_RPC_URL` | Mainnet read/simulation RPC override | No; defaults to the official mainnet RPC. |
| `VITE_XLAYER_TESTNET_RPC_URL` | Testnet read/simulation RPC override | No; defaults to the official testnet RPC. |
| `VITE_XLAYER_REPUTATION_API_URL` | Optional server-routed address reputation source | No; no reputation is claimed unless configured. |
| `VITE_XLAYER_TRACE_PROVIDER_URL` | Optional trace-capable simulation provider for full live before/after asset deltas | No; the app labels after-state comparison as unsupported until an adapter is configured. |
| `VITE_XLAYER_PROVIDER_KIND` | Registered chain-provider adapter identifier | No; defaults to the built-in `viem-rpc` adapter. |
| `XLAYER_REPUTATION_API_KEY` | Server-only credential for an optional reputation provider | No; never exposed to the client. |
| `XLAYER_AI_INTERPRETER_URL` | Optional server-side explanation-provider endpoint | No; deterministic summaries work without it. |

## Simulation and Risk Semantics

Native simulation uses the selected X Layer RPC to query current state, estimate gas, and execute a read-only call with the proposed transaction parameters. It can report whether the node accepted the call, a probable revert reason, current balance data where available, and the transaction receipt after a wallet submits. It cannot reliably enumerate every storage mutation or every token transfer without a trace-capable provider or a dedicated simulation service; the UI exposes this limit rather than synthesizing a state-change claim.

The deterministic risk engine starts with auditable rules: an ERC-20 approval of `uint256.max` is **critical**; an approval greater than a configurable high-value threshold is **warning**; malformed addresses or a transaction whose decoded destination conflicts with its declared destination are **critical**; a failed RPC simulation is **warning** unless a clear critical rule applies; native-value transfers over the cautious threshold are **warning**. Known local blocklisted addresses are **critical**, local trusted addresses are called out, and every other address remains **unknown** until a configured reputation source returns a verified response.

## Demo Scenarios

The demo catalog comprises six static analysis artifacts. Each uses an internally coherent proposed transaction, decoded action, simulation outcome, risk report, balance delta, and verification status so a judge can inspect the product in 30–60 seconds without a wallet.

| Scenario | Intended verdict | Core finding |
| --- | --- | --- |
| Safe transaction | Safe | A bounded stablecoin transfer with a successful dry run. |
| Unlimited approval | Critical | An ERC-20 `approve` grant of maximum allowance to an unfamiliar spender. |
| Transaction mismatch | Critical | The decoded recipient/action does not match the declared intention. |
| Failed transaction | Warning | The current X Layer simulation reports a revert. |
| Unexpected asset movement | Critical | The decoded effect would move an additional asset beyond the apparent transaction intent. |
| Successful transaction verification | Safe | A completed transaction result with a labeled verified receipt outcome. |

## Security Controls

All chain data, contract metadata, token symbols, and revert strings are untrusted display inputs. They are length-limited, normalized, and rendered as text rather than interpreted instructions. The server has no wallet execution endpoint, does not accept private keys, and does not custody or relay funds. The UI treats wallet rejection, incorrect network, disabled provider, RPC errors, unknown calldata, and unavailable reputation checks as distinct error states. Deterministic findings and optional AI-generated explanations are visibly separated.

## Verification Plan

Unit tests will cover configuration fallback and overrides, selector decoding, calldata normalization, deterministic risk policies, the six demo definitions, simulation outcome mapping, and wallet-network request building. Interface validation will check all demo paths, wallet-unavailable and wallet-rejected states, RPC failure rendering, desktop/mobile readability, and the permanently visible mode indication. Runtime logs will be reviewed for browser and server errors before delivery.
