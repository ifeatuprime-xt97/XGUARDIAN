# Guardian Mobile and Typography Validation

The revised interface was reviewed at **375 × 812** and **1280 × 900** across Overview, Wallets, Scan, Activity, and Profile. The Manrope type system now carries all human-facing hierarchy, while IBM Plex Mono is confined to chain and metadata context.

On mobile, the hero area is compact and transparent, the active-wallet state is prioritized, the six review options are an immediately visible three-column command grid, and the selected action remains singular and legible. Wallet management, watch-only storage, live scan inputs, activity findings, and profile privacy content retain their product behavior in the narrower layout. Desktop preserves the wider portfolio workspace and adopts the same typographic contrast without flattening the review flow.

The full Vitest suite passed with **18 tests**, TypeScript completed without errors, and the production build completed successfully. The product retains the browser-local portfolio model, connected-wallet signing boundary, and deterministic transaction review behavior.

## Imported icon and containment correction

The final icon and containment pass was reviewed at **375 × 812** and **1280 × 720** across Overview, Wallets, Scan, Activity, and Profile. The generated icon family has been removed from the navigation and visible security-state surfaces in favor of familiar imported semantic icons. The circular review state now uses a clear check, alert, or blocked symbol, and its icon, status label, and supporting text fit within the ring at mobile size.

On mobile, the fixed navigation keeps five familiar icons and readable labels without a raised or overlapping center control. The active-wallet copy, notifications, form placeholders, and scenario labels are constrained to their containers. The network selector is a two-column control with equal, visible targets, and the optional network-switch action moves to its own full-width row when needed. All portfolio screens retained their responsive layout and no horizontal scrolling was observed during the review.

## X Layer-native transaction journey

The product now makes the X Layer integration visible in the main safety flow. Overview identifies the active X Layer network and chain ID, while Scan offers **Testnet** and **Mainnet** selection backed by the configured official RPC adapter. Before a wallet can open, the selected connected wallet must match the review wallet, the X Layer network must match the inspected chain, the dry-run simulation must succeed, and the deterministic risk result must not be critical.

The review begins with a human-readable preview of the stated intent, decoded wallet request, decoded asset effect, and available gas estimate. A dedicated intent comparison makes recipient mismatches, unlimited approvals, and unexpected asset movements explicit. Post-transaction verification presents the expected effect beside available receipt and balance evidence; when trace-level token diffs are unavailable, the interface states the limitation rather than inventing an actual result.

The AI explanation is a server-side, structured-response feature. It receives only the displayed intent, decoded request, X Layer simulation outcome, deterministic findings, and decoded movements. It is explicitly prohibited from adding identity, ownership, scam, price, security-intelligence, or signing claims. If the model result fails validation or is unavailable, Guardian renders a deterministic explanation instead. This AI layer was verified with a live structured response, while all risk grading, mismatch detection, simulation gates, and signing eligibility remain deterministic.

## Expected-versus-actual transaction diff

Post-transaction verification now derives a per-asset delta from the before and after evidence rather than presenting ending balances as an outcome. The UI labels each item **matched**, **mismatch**, or **partial**, and the summary distinguishes **Awaiting receipt**, **Transaction failed**, **Matched available evidence**, **Difference found**, and **Partially verified**. The verified transfer demo confirms an expected **−10.00 USDT** against an actual **−10 USDT** delta and renders a matched result. Pending receipts do not display a claimed actual result, and approvals or trace-limited state use a partial result with an explicit explanation of the missing evidence.

The upgraded product journey was reviewed at **375 × 812** across Overview, Wallets, Scan, Activity, and Profile, and at **1280 × 900** across the same five views. The full responsive review includes the new intent selector, X Layer network controls, human preview, intent comparison, AI explanation entry point, transaction-diff states, recovery guidance, wallet management, activity, and local-custody profile content. No horizontal overflow or clipped controls were observed in the reviewed states.

## Token evidence, local history, and decision-first review

Live ERC-20 scans now issue read-only X Layer RPC calls for the token balance, symbol, decimals, and—when the decoded request supplies a spender—the current allowance. This evidence is recorded beside the native balance before review and refreshed after a verified receipt. Transfer verification uses available before/after token deltas, while approval verification treats unlimited approvals and unavailable allowance state as partial evidence rather than asserting a successful permission change.

The Activity destination is now a browser-local review history. It records live scans and selected demo reviews with timestamp, network, consequence, method, source, risk class, and receipt state. Filters isolate live, demo, safe, warning, and critical records. The implementation stores only review metadata in the existing local browser storage model and never stores keys, wallet credentials, or server-side signing data.

The default review no longer requires users to read the entire evidence dossier. It begins with the deterministic decision, immediate consequence, destination or spender, stated intent, and available gas estimate. A single **Review details** disclosure then contains the intent diff, decoded effect, deterministic checks, AI wording, verification evidence, and raw request. This decision-first state and the updated local-history interface were reviewed at **375 × 812** and **1280 × 900**.

## Trusted token identity and multi-token receipt evidence

For eligible X Layer mainnet ERC-20 contracts, Guardian now requests a server-side token identity record. The record separately reports an exact address match in the OKX X Layer Token List—used for name, symbol, decimals, and logo presentation—and the OKLink verified-contract result. A logo is rendered only for an exact registry match; on-chain `symbol` and `decimals` remain self-reported metadata, while verified-contract status is displayed only when OKLink returns source information for the same address. Testnet and unlisted addresses retain explicit unavailable or not-listed states.

After a verified X Layer receipt, Guardian uses a configured trace-capable JSON-RPC endpoint for `trace_transaction`, then reads `balanceOf` from that endpoint at the receipt block and preceding block for each wallet-attributed standard ERC-20 transfer asset. This creates explicit before-and-after token deltas. Decoded movements that match those deltas appear as matched evidence; extra observed assets appear as **Not decoded** partial evidence rather than disappearing or being labeled as a confirmed security incident. With no configured endpoint, or an endpoint that rejects the trace method, Guardian keeps full trace evidence **unavailable** and continues to show ordinary native and ERC-20 balance evidence without claiming a complete multi-token trace.

The verification header now names the trace state directly: **Trace complete** means the configured endpoint returned before-and-after balances for every wallet-attributed standard ERC-20 transfer asset detected in the receipt; **Trace partial** means one or more of those assets could not be read or an observed asset was not decoded; and **Trace unavailable** means no configured compatible endpoint returned trace evidence. The scope appears beside the verification panel and deliberately excludes non-standard tokens, NFTs, native internal transfers, and protocol-internal accounting.

## Active-wallet picker

The browser-native active-wallet `<select>` has been removed because its system option menu rendered as a light surface outside the Guardian palette. The replacement uses a button-triggered, keyboard-focusable listbox with Guardian-owned dark option rows. The empty state remains explicit, and connected or watch-only wallets show a compact label, address fragment, and role. Desktop interaction confirms the expanded list is a dark in-product surface rather than a browser menu; the same picker uses full available width beneath the mobile intro.
