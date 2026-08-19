import { isAddress } from "viem";
import { createChainProvider, type ChainProvider } from "./chainProvider";
import { getXLayerNetwork } from "./config";
import { createTransactionMonitor } from "./monitoring";
import { createTraceProvider, type TraceProvider } from "./traceProvider";
import type { Erc20TokenEvidence, SimulationResult, TransactionDraft, VerificationResult } from "./types";
import type { TraceEvidence } from "./traceProvider";

function messageFrom(error: unknown) {
  if (error instanceof Error) return error.message.replace(/\s+/g, " ").slice(0, 220);
  return "The selected provider did not return an interpretable error.";
}

function providerOrUnavailable(provider?: ChainProvider) {
  return provider ?? createChainProvider();
}

export async function simulateOnXLayer(draft: TransactionDraft, injectedProvider?: ChainProvider): Promise<SimulationResult> {
  const network = getXLayerNetwork(draft.chainId);
  if (!network) return { status: "unavailable", title: "Unsupported network", detail: "Switch the wallet to X Layer Mainnet or Testnet before inspecting this transaction." };
  if (!isAddress(draft.to)) return { status: "reverted", title: "Invalid destination", detail: "A dry run cannot start because the destination is not a valid EVM address." };
  const provider = providerOrUnavailable(injectedProvider);
  if (!provider) return { status: "unavailable", title: "Simulation provider unavailable", detail: "The configured X Layer provider adapter is not registered." };
  try {
    const result = await provider.simulate(draft, network);
    return { status: "success", title: "X Layer dry run completed", detail: `The ${provider.id} provider accepted the read-only call on ${network.name}.`, gasEstimate: result.gasEstimate, returnData: result.returnData, providerChecked: true };
  } catch (error) {
    return { status: "reverted", title: "X Layer dry run reverted", detail: messageFrom(error), providerChecked: true };
  }
}

export async function readXLayerNativeBalance(address: string, chainId: number, injectedProvider?: ChainProvider) {
  const network = getXLayerNetwork(chainId);
  if (!network) return { amount: undefined, detail: "Unsupported network" };
  if (!isAddress(address)) return { amount: undefined, detail: "Connected account is not a valid EVM address" };
  const provider = providerOrUnavailable(injectedProvider);
  if (!provider) return { amount: undefined, detail: "The configured X Layer balance provider is not registered" };
  try {
    return { amount: await provider.readNativeBalance(address, network), detail: `Read from ${network.name} through ${provider.id}` };
  } catch (error) {
    return { amount: undefined, detail: messageFrom(error) };
  }
}

export async function readXLayerErc20Evidence(owner: string, token: string, chainId: number, spender?: string, injectedProvider?: ChainProvider): Promise<Erc20TokenEvidence | undefined> {
  const network = getXLayerNetwork(chainId);
  if (!network || !isAddress(owner) || !isAddress(token)) return undefined;
  const provider = providerOrUnavailable(injectedProvider);
  if (!provider?.readErc20Evidence) return undefined;
  try {
    return await provider.readErc20Evidence(owner, token, network, spender);
  } catch {
    return undefined;
  }
}

export async function verifyXLayerReceipt(transactionHash: string, chainId: number, injectedProvider?: ChainProvider): Promise<VerificationResult> {
  const provider = providerOrUnavailable(injectedProvider);
  if (!provider) return { status: "pending", label: "Receipt provider unavailable", detail: "The configured transaction-monitoring provider adapter is not registered.", transactionHash };
  return createTransactionMonitor(provider, getXLayerNetwork).verify(transactionHash, chainId);
}

export async function readXLayerReceiptTokenDeltas(transactionHash: string, walletAddress: string, chainId: number, injectedProvider?: TraceProvider): Promise<TraceEvidence> {
  const network = getXLayerNetwork(chainId);
  if (!network) return { providerId: "none", status: "unavailable", detail: "The transaction is not on a configured X Layer network.", deltas: [] };
  const provider = injectedProvider ?? createTraceProvider();
  if (!provider) return { providerId: "none", status: "unavailable", detail: "No trace-capable token-delta adapter is registered.", deltas: [] };
  return provider.readTokenDeltas(transactionHash, walletAddress, network);
}
