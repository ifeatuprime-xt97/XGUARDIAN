import { calldataForAddress, calldataForUint, decodeTransaction, ERC20_APPROVE_SELECTOR, ERC20_TRANSFER_SELECTOR, MAX_UINT256 } from "./decoder";
import { evaluateRisk } from "./risk";
import type { AssetMovement, AssetPosition, DemoScenario, ReputationResult, SimulationResult, TransactionAnalysis, TransactionDraft, VerificationResult } from "./types";

const ADDRESSES = {
  account: "0x1111111111111111111111111111111111111111",
  trustedRecipient: "0x2222222222222222222222222222222222222222",
  unknownRecipient: "0x3333333333333333333333333333333333333333",
  spender: "0x4444444444444444444444444444444444444444",
  token: "0x5555555555555555555555555555555555555555",
  router: "0x6666666666666666666666666666666666666666",
};

const baseReputation: ReputationResult = { status: "unknown", provider: "Local policy", detail: "No external reputation provider is configured; this address is not asserted as trusted." };

function tokenPositions(amount: string): AssetPosition[] {
  return [
    { asset: ADDRESSES.token, symbol: "USDT", amount, valueLabel: `$${amount}` },
    { asset: "native", symbol: "OKB", amount: "4.83", valueLabel: "Native balance" },
  ];
}

function buildAnalysis(input: {
  draft: TransactionDraft;
  simulation: SimulationResult;
  before: AssetPosition[];
  after: AssetPosition[];
  movements: AssetMovement[];
  verification: VerificationResult;
  reputation?: ReputationResult;
  inspectorNote?: string;
}): TransactionAnalysis {
  const decoded = decodeTransaction(input.draft);
  const reputation = input.reputation ?? baseReputation;
  return {
    draft: input.draft,
    decoded,
    simulation: input.simulation,
    reputation,
    risk: evaluateRisk({ draft: input.draft, decoded, simulation: input.simulation, reputation, unexpectedMovement: input.movements.some((movement) => movement.unexpected) }),
    before: input.before,
    after: input.after,
    movements: input.movements,
    verification: input.verification,
    inspectorNote: input.inspectorNote,
  };
}

const TOKEN_UNIT = BigInt("1000000000000000000");
const transfer10 = `${ERC20_TRANSFER_SELECTOR}${calldataForAddress(ADDRESSES.trustedRecipient)}${calldataForUint(BigInt(10) * TOKEN_UNIT)}`;
const transfer25 = `${ERC20_TRANSFER_SELECTOR}${calldataForAddress(ADDRESSES.unknownRecipient)}${calldataForUint(BigInt(25) * TOKEN_UNIT)}`;
const unlimitedApproval = `${ERC20_APPROVE_SELECTOR}${calldataForAddress(ADDRESSES.spender)}${calldataForUint(BigInt(MAX_UINT256))}`;

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "safe-transfer",
    name: "Safe transaction",
    shortName: "Safe transfer",
    description: "A bounded USDT transfer to the declared recipient, with a successful simulated result.",
    duration: "30 sec",
    analysis: buildAnalysis({
      draft: { from: ADDRESSES.account, to: ADDRESSES.token, value: "0", data: transfer10, chainId: 1952, declaredRecipient: ADDRESSES.trustedRecipient, declaredAction: "Send 10 USDT" },
      simulation: { status: "success", title: "Demo dry run completed", detail: "The simulated transfer completed without a deterministic policy violation." },
      before: tokenPositions("250.00"),
      after: tokenPositions("240.00"),
      movements: [{ asset: ADDRESSES.token, symbol: "USDT", direction: "out", amount: "10.00", detail: `To ${ADDRESSES.trustedRecipient}` }],
      verification: { status: "not-verified", label: "Not submitted", detail: "Demo Mode does not submit transactions." },
      reputation: { status: "trusted", provider: "Local policy", detail: "Recipient is included in the bounded demo allowlist." },
    }),
  },
  {
    id: "unlimited-approval",
    name: "Unlimited approval",
    shortName: "Unlimited approval",
    description: "A familiar approval pattern with the unsafe maximum allowance value exposed before signing.",
    duration: "30 sec",
    analysis: buildAnalysis({
      draft: { from: ADDRESSES.account, to: ADDRESSES.token, value: "0", data: unlimitedApproval, chainId: 1952, declaredAction: "Approve swap" },
      simulation: { status: "success", title: "Demo dry run completed", detail: "The call can execute, but execution does not make the allowance safe." },
      before: tokenPositions("250.00"),
      after: tokenPositions("250.00"),
      movements: [{ asset: ADDRESSES.token, symbol: "USDT", direction: "approval", amount: "Unlimited", detail: `Spender ${ADDRESSES.spender}` }],
      verification: { status: "not-verified", label: "Not submitted", detail: "Demo Mode does not submit transactions." },
    }),
  },
  {
    id: "transaction-mismatch",
    name: "Transaction mismatch",
    shortName: "Recipient mismatch",
    description: "The intent says one recipient, while decoded calldata sends tokens to another address.",
    duration: "45 sec",
    analysis: buildAnalysis({
      draft: { from: ADDRESSES.account, to: ADDRESSES.token, value: "0", data: transfer25, chainId: 1952, declaredRecipient: ADDRESSES.trustedRecipient, declaredAction: "Donate to verified relief wallet" },
      simulation: { status: "success", title: "Demo dry run completed", detail: "The transfer would execute to the decoded destination, not the declared one." },
      before: tokenPositions("250.00"),
      after: tokenPositions("225.00"),
      movements: [{ asset: ADDRESSES.token, symbol: "USDT", direction: "out", amount: "25.00", detail: `Decoded recipient ${ADDRESSES.unknownRecipient}`, unexpected: true }],
      verification: { status: "not-verified", label: "Not submitted", detail: "Demo Mode does not submit transactions." },
    }),
  },
  {
    id: "failed-transaction",
    name: "Failed transaction",
    shortName: "Simulation failure",
    description: "A transaction that fails against current state, surfaced before it reaches the wallet confirmation screen.",
    duration: "30 sec",
    analysis: buildAnalysis({
      draft: { from: ADDRESSES.account, to: ADDRESSES.router, value: "0", data: "0x38ed17390000000000000000000000000000000000000000000000000000000000000001", chainId: 1952, declaredAction: "Swap token" },
      simulation: { status: "reverted", title: "Demo dry run reverted", detail: "Execution reverted: insufficient output amount or missing allowance." },
      before: tokenPositions("250.00"),
      after: tokenPositions("250.00"),
      movements: [],
      verification: { status: "not-verified", label: "Not submitted", detail: "Demo Mode does not submit transactions." },
    }),
  },
  {
    id: "unexpected-asset-movement",
    name: "Unexpected asset movement",
    shortName: "Extra asset movement",
    description: "The proposed operation includes a second asset transfer beyond the visible swap intent.",
    duration: "45 sec",
    analysis: buildAnalysis({
      draft: { from: ADDRESSES.account, to: ADDRESSES.router, value: "0", data: transfer25, chainId: 1952, declaredRecipient: ADDRESSES.unknownRecipient, declaredAction: "Swap 25 USDT" },
      simulation: { status: "success", title: "Demo dry run completed", detail: "The primary call can execute; the policy engine identified an additional asset effect." },
      before: tokenPositions("250.00"),
      after: [{ asset: ADDRESSES.token, symbol: "USDT", amount: "225.00", valueLabel: "$225.00" }, { asset: "native", symbol: "OKB", amount: "3.83", valueLabel: "Native balance" }],
      movements: [
        { asset: ADDRESSES.token, symbol: "USDT", direction: "out", amount: "25.00", detail: "Primary token movement" },
        { asset: "native", symbol: "OKB", direction: "out", amount: "1.00", detail: "Additional native-token transfer", unexpected: true },
      ],
      verification: { status: "not-verified", label: "Not submitted", detail: "Demo Mode does not submit transactions." },
    }),
  },
  {
    id: "verified-transaction",
    name: "Successful verification",
    shortName: "Receipt verified",
    description: "A completed transaction review with a confirmed receipt status, clearly labeled as a demo artifact.",
    duration: "30 sec",
    analysis: buildAnalysis({
      draft: { from: ADDRESSES.account, to: ADDRESSES.token, value: "0", data: transfer10, chainId: 1952, declaredRecipient: ADDRESSES.trustedRecipient, declaredAction: "Send 10 USDT" },
      simulation: { status: "success", title: "Demo dry run completed", detail: "The pre-signing check was successful." },
      before: tokenPositions("250.00"),
      after: tokenPositions("240.00"),
      movements: [{ asset: ADDRESSES.token, symbol: "USDT", direction: "out", amount: "10.00", detail: `To ${ADDRESSES.trustedRecipient}` }],
      verification: { status: "verified", label: "Demo verification complete", detail: "This is a fixed demo receipt outcome, not an on-chain claim.", transactionHash: "0x9a7b0d6c5e4f3120d8e6c4b2a19087654321fedcba09876543210fedcba98765" },
      reputation: { status: "trusted", provider: "Local policy", detail: "Recipient is included in the bounded demo allowlist." },
    }),
  },
];
