# X Layer Metadata and Trace Evidence Sources

## Investigated sources

| Need | Source investigated | Finding | Guardian treatment |
|---|---|---|---|
| Contract verification | [OKLink X Layer explorer verification](https://www.oklink.com/x-layer/evm/verify-contract-preliminary) | The X Layer explorer accepts source publication, compiles submitted code, and compares it against on-chain bytecode before publishing. | Treat an explicit successful explorer/registry result as a **verified-contract** signal. Do not infer verification from bytecode, token name, or a deployed contract alone. |
| Trace RPC | [Blockdaemon X Layer RPC methods](https://docs.blockdaemon.com/reference/xlayer-methods-rpc-api) | The provider documents an X Layer RPC method reference that includes trace-oriented capabilities. Availability depends on the selected upstream provider and endpoint tier. | Define an injectable trace adapter. Guardian uses complete multi-token deltas only when an adapter produces decoded event evidence; otherwise it preserves **partial** or **unavailable** state. |
| Token logos and identity | [OKX X Layer Token List](https://github.com/okx/xlayer-tokenlist) | The OKX-maintained repository publishes a standards-compliant, address-keyed X Layer mainnet token list with symbol, name, decimals, and OKLink-hosted logo URI. Its listed core assets include WOKB, WETH, USD₮0, and USDC. | Use this list as a **configured registry source** for exact mainnet address matches only. Show the registry label separately from on-chain self-reported token metadata and do not extend the registry claim to testnet or unknown contracts. |

## Integration boundary

Token `symbol` and `decimals` are self-reported fields. Guardian may display them as **on-chain metadata**, but they are not a verification claim. A logo appears only when the configured OKX X Layer registry provides the exact `(chainId, contract address)` identity and its source is displayed. Contract verification remains independent from token metadata.

For full multi-token deltas, the adapter accepts normalized decoded token events from a trace-capable upstream rather than assuming support from the default public RPC. The default X Layer provider continues to provide simulation, balances, receipts, and standard ERC-20 reads. It does not claim trace-derived deltas unless a trace adapter is registered and returns them.

## Configurable trace endpoint

The X Layer `trace_transaction` documentation from [QuickNode](https://www.quicknode.com/docs/xlayer/trace_transaction) specifies a JSON-RPC request of `{"method":"trace_transaction","params":[transactionHash]}` and returns the transaction call trace. The [X Layer `trace_replayTransaction` reference](https://docs.uniblock.dev/reference/jsonrpc/196/trace/trace-replay-transaction) supports `stateDiff` alongside execution traces. Guardian therefore requires a configured trace-capable endpoint before claiming trace-backed evidence. It verifies trace availability with `trace_transaction`, then reads standard ERC-20 `balanceOf` values from that same endpoint at the receipt block and the preceding block for every wallet-attributed standard `Transfer` token. The resulting before/after snapshots are complete only for the detected standard ERC-20 transfer assets; non-standard asset accounting remains explicitly out of scope.

## Verified-contract lookup

The [OKLink developer guide](https://www.oklink.com/docs/en/#developer-tools) documents `GET /api/v5/explorer/contract/verify-contract-info`, parameterized by `chainShortName` and `contractAddress`, for retrieving ABI, source code, and basic information for an already verified contract. Guardian calls this public documented read route server-side, with `XLAYER` and the decoded contract address. A successful recognizable contract-information record yields **verified by OKLink**. Empty, unsupported, malformed, or inaccessible responses remain **verification unavailable**—they never produce a negative safety verdict.
