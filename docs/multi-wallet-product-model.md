# X Layer Guardian: Multi-Wallet Product Model

## Wallet Types

Guardian distinguishes between a **connected signing wallet** and a **watch wallet**. A connected wallet is exposed by the user’s EIP-1193 browser wallet and is the only kind of wallet that can open a client-side confirmation. A watch wallet is an address the user adds for monitoring; it can be used for read-only simulation and security context but can never sign.

The initial portfolio is browser-local and stored in the user’s browser. It is intentionally not presented as cloud synchronization or custody.

## Navigation Jobs

| Destination | Product purpose |
| --- | --- |
| Overview | Shows the active wallet’s security posture, attention items, and latest review. |
| Wallets | Adds, selects, labels, and removes connected or watch-only wallet entries. |
| Scan | Reviews a live request against the active wallet context, without signing. |
| Activity | Shows scenario-specific review outcomes and provides the appropriate next action for each event. |
| Profile | Explains the local portfolio boundary and connection state. |

## Demo Actions

Each scenario has its own purpose: safe transfer prompts a destination review; unlimited approval proposes rejection; recipient mismatch prompts comparison; simulation failure requires fixing the request; unexpected asset movement opens the movement evidence; verified receipt opens post-signing confirmation.
