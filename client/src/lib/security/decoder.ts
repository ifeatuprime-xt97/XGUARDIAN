import { formatUnits, isAddress } from "viem";
import type { DecodedTransaction, TransactionDraft } from "./types";

export const ERC20_APPROVE_SELECTOR = "0x095ea7b3";
export const ERC20_TRANSFER_SELECTOR = "0xa9059cbb";
export const ERC20_TRANSFER_FROM_SELECTOR = "0x23b872dd";
export const TOKEN_APPROVAL_FOR_ALL_SELECTOR = "0xa22cb465";
export const MAX_UINT256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
const MAX_UINT256_BIG = BigInt(MAX_UINT256);

export type SelectorDecoder = (target: string, words: string[]) => DecodedTransaction | undefined;
export type SelectorDecoderRegistry = ReadonlyMap<string, SelectorDecoder>;

function normalizedData(data: string | undefined) {
  if (!data || data === "0x") return "0x";
  return data.toLowerCase();
}

function asAddress(word: string) {
  const candidate = `0x${word.slice(-40)}`;
  return isAddress(candidate) ? candidate : undefined;
}

function asUint(word: string) {
  try {
    return BigInt(`0x${word}`);
  } catch {
    return undefined;
  }
}

function encodedWords(data: string) {
  const payload = data.slice(10);
  if (payload.length % 64 !== 0) return [];
  return Array.from({ length: payload.length / 64 }, (_, index) => payload.slice(index * 64, (index + 1) * 64));
}

function formatAmount(amount: bigint | undefined) {
  if (amount === undefined) return undefined;
  if (amount === MAX_UINT256_BIG) return "Unlimited";
  try {
    const readable = formatUnits(amount, 18);
    const [whole, fractional = ""] = readable.split(".");
    return fractional ? `${whole}.${fractional.slice(0, 4)}`.replace(/\.$/, "") : whole;
  } catch {
    return amount.toString();
  }
}

function opaque(target: string, selector?: string, warning?: string): DecodedTransaction {
  return {
    kind: "unknown",
    selector,
    method: "Unrecognized contract interaction",
    summary: "This calldata uses an unrecognized method selector. Inspect the contract before signing.",
    target,
    opaque: true,
    warnings: [warning ?? "The method selector is not in the active decoder registry."],
  };
}

const decodeApproval: SelectorDecoder = (target, words) => {
  const spender = words[0] ? asAddress(words[0]) : undefined;
  const amount = words[1] ? asUint(words[1]) : undefined;
  if (!spender || amount === undefined) return undefined;
  const unlimitedApproval = amount === MAX_UINT256_BIG;
  return {
    kind: "erc20-approval",
    selector: ERC20_APPROVE_SELECTOR,
    method: "ERC-20 approval",
    summary: unlimitedApproval ? `Grant ${spender} unlimited authority to spend this token.` : `Grant ${spender} authority to spend up to ${formatAmount(amount)} tokens.`,
    target,
    spender,
    amount: formatAmount(amount),
    amountRaw: amount.toString(),
    unlimitedApproval,
    source: "Built-in ERC-20 selector registry",
    warnings: unlimitedApproval ? ["This approval can allow the spender to move every token balance, now and later."] : [],
  };
};

const decodeTransfer: SelectorDecoder = (target, words) => {
  const recipient = words[0] ? asAddress(words[0]) : undefined;
  const amount = words[1] ? asUint(words[1]) : undefined;
  if (!recipient || amount === undefined) return undefined;
  return {
    kind: "erc20-transfer",
    selector: ERC20_TRANSFER_SELECTOR,
    method: "ERC-20 transfer",
    summary: `Transfer ${formatAmount(amount)} tokens to ${recipient}.`,
    target,
    recipient,
    amount: formatAmount(amount),
    amountRaw: amount.toString(),
    source: "Built-in ERC-20 selector registry",
    warnings: [],
  };
};

const decodeTransferFrom: SelectorDecoder = (target, words) => {
  const sourceAddress = words[0] ? asAddress(words[0]) : undefined;
  const recipient = words[1] ? asAddress(words[1]) : undefined;
  const amount = words[2] ? asUint(words[2]) : undefined;
  if (!sourceAddress || !recipient || amount === undefined) return undefined;
  return {
    kind: "erc20-transfer-from",
    selector: ERC20_TRANSFER_FROM_SELECTOR,
    method: "ERC-20 transferFrom",
    summary: `Move ${formatAmount(amount)} tokens from ${sourceAddress} to ${recipient}.`,
    target,
    source: sourceAddress,
    recipient,
    amount: formatAmount(amount),
    amountRaw: amount.toString(),
    warnings: ["This method draws tokens from an address that previously approved the contract."],
  };
};

const decodeOperatorApproval: SelectorDecoder = (target, words) => {
  const operator = words[0] ? asAddress(words[0]) : undefined;
  const enabled = words[1] ? asUint(words[1]) : undefined;
  if (!operator || enabled === undefined || (enabled !== BigInt(0) && enabled !== BigInt(1))) return undefined;
  const grantsAuthority = enabled === BigInt(1);
  return {
    kind: "contract-call",
    selector: TOKEN_APPROVAL_FOR_ALL_SELECTOR,
    method: "Token operator approval",
    summary: grantsAuthority ? `Grant ${operator} authority over all supported tokens in this contract.` : `Revoke ${operator}'s operator authority for this contract.`,
    target,
    spender: operator,
    amount: grantsAuthority ? "All tokens" : "Revoked",
    source: "Built-in token-operator selector registry",
    warnings: grantsAuthority ? ["This authorizes an operator for every applicable token, not a single token ID."] : [],
  };
};

export const BUILT_IN_SELECTOR_REGISTRY: SelectorDecoderRegistry = new Map([
  [ERC20_APPROVE_SELECTOR, decodeApproval],
  [ERC20_TRANSFER_SELECTOR, decodeTransfer],
  [ERC20_TRANSFER_FROM_SELECTOR, decodeTransferFrom],
  [TOKEN_APPROVAL_FOR_ALL_SELECTOR, decodeOperatorApproval],
]);

export function createSelectorRegistry(additions: Iterable<[string, SelectorDecoder]> = []) {
  return new Map([...BUILT_IN_SELECTOR_REGISTRY, ...additions]);
}

export function decodeTransaction(draft: TransactionDraft, registry: SelectorDecoderRegistry = BUILT_IN_SELECTOR_REGISTRY): DecodedTransaction {
  const data = normalizedData(draft.data);
  const target = isAddress(draft.to) ? draft.to : draft.to || "Unknown destination";

  if (data === "0x") {
    const value = BigInt(draft.value || "0");
    return {
      kind: "native-transfer",
      method: "Native token transfer",
      summary: value > BigInt(0) ? `Send ${formatAmount(value)} OKB to ${target}.` : `Interact with ${target} without calldata or native value.`,
      target,
      recipient: target,
      amount: formatAmount(value),
      amountRaw: value.toString(),
      source: "Native transaction fields",
      warnings: value === BigInt(0) ? ["No calldata or native value was supplied."] : [],
    };
  }

  if (!/^0x[0-9a-f]*$/.test(data) || data.length < 10) return opaque(target, undefined, "Calldata is malformed.");
  const selector = data.slice(0, 10);
  const decoded = registry.get(selector)?.(target, encodedWords(data));
  return decoded ?? opaque(target, selector, registry.has(selector) ? "The selector is known but its ABI parameters are incomplete or malformed." : undefined);
}

export function calldataForAddress(address: string) {
  return address.replace(/^0x/, "").padStart(64, "0");
}

export function calldataForUint(value: bigint) {
  return value.toString(16).padStart(64, "0");
}
