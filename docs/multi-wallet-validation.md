# X Layer Guardian: Multi-Wallet Validation

## Portfolio Behavior

Guardian now imports every account exposed by an EIP-1193 browser wallet into a managed portfolio. It also supports manually added watch wallets. The user can select an active wallet, remove an entry, and distinguish signing-capable entries from watch-only addresses.

| Wallet type | Can inspect and simulate | Can open wallet confirmation | Persistence |
| --- | --- | --- | --- |
| Connected signing wallet | Yes | Yes, only when it matches the connected browser wallet | Browser-local portfolio metadata |
| Watch wallet | Yes | No | Browser-local portfolio metadata |

The browser-local scope is explicit in the interface and profile view. It does not claim cloud synchronization, custody, or storage of wallet keys.

## Navigation Behavior

| Destination | Verified purpose |
| --- | --- |
| Overview | Active-wallet posture, portfolio summary, security reviews, and the selected review consequence. |
| Wallets | Connect a browser wallet, add/remove a watch wallet, and change the active wallet. |
| Scan | Build a request against the active wallet context; watch-only wallets remain non-signing. |
| Activity | Shows all six review cases with scenario-specific next steps. |
| Profile | Shows the browser-local and client-side signing boundary. |

## Validation Results

The portfolio module tests add, select, remove, persist-ready entries, and reject malformed addresses. The wallet-adapter tests confirm that all exposed EIP-1193 accounts are retained for portfolio import. Experience tests verify that all six scenarios expose distinct next-step labels and that a confirmation request is allowed only for the matching connected wallet—not a watch wallet or a mismatched connected address.

All five product surfaces were rendered through their addressable navigation states (`#overview`, `#wallets`, `#scan`, `#activity`, and `#profile`) at mobile and desktop widths. The screens show separate product jobs rather than copied navigation: wallet management, active-wallet scanning, scenario action history, and local security settings all render independently.

The complete project completed **18 passing tests**, TypeScript validation, and a production build. The existing EVM client bundle-size advisory remains non-blocking.
