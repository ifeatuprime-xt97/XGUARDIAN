import type { VerificationResult } from "./types";
import type { ChainProvider } from "./chainProvider";

export interface TransactionMonitor {
  verify(transactionHash: string, chainId: number): Promise<VerificationResult>;
}

export function createTransactionMonitor(provider: ChainProvider, resolveNetwork: (chainId: number) => { name: string } | undefined): TransactionMonitor {
  return {
    async verify(transactionHash, chainId) {
      const network = resolveNetwork(chainId);
      if (!network) return { status: "failed", label: "Unsupported network", detail: "A receipt can only be read on X Layer Mainnet or Testnet." };
      try {
        const receipt = await provider.readReceipt(transactionHash, network as Parameters<ChainProvider["readReceipt"]>[1]);
        if (!receipt) return { status: "pending", label: "Receipt pending", detail: "No receipt is available from the selected transaction-monitoring provider yet.", transactionHash };
        return {
          status: receipt.successful ? "verified" : "failed",
          label: receipt.successful ? "Transaction verified" : "Transaction failed",
          detail: `Receipt read from ${(network as { name: string }).name} at block ${receipt.blockNumber}.`,
          transactionHash,
        };
      } catch (error) {
        return { status: "pending", label: "Receipt pending", detail: error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 220) : "The monitoring provider did not return an interpretable error.", transactionHash };
      }
    },
  };
}
