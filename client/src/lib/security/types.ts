export type XLayerNetworkKey = "mainnet" | "testnet";

import type { TokenIdentity } from "@shared/tokenIdentity";

export type RiskLevel = "safe" | "warning" | "critical";
export type SimulationStatus = "not-run" | "success" | "reverted" | "unavailable";
export type VerificationStatus = "not-verified" | "pending" | "verified" | "failed";
export type ReputationStatus = "trusted" | "blocked" | "unknown" | "unavailable";
export type DecodedKind = "native-transfer" | "erc20-approval" | "erc20-transfer" | "erc20-transfer-from" | "contract-call" | "unknown";

export type TransactionDraft = {
  from?: string;
  to: string;
  value: string;
  data: string;
  chainId: number;
  declaredRecipient?: string;
  declaredAction?: string;
};

export type DecodedTransaction = {
  kind: DecodedKind;
  selector?: string;
  method: string;
  summary: string;
  target: string;
  source?: string;
  recipient?: string;
  spender?: string;
  amount?: string;
  amountRaw?: string;
  unlimitedApproval?: boolean;
  opaque?: boolean;
  warnings: string[];
};

export type SimulationResult = {
  status: SimulationStatus;
  title: string;
  detail: string;
  gasEstimate?: string;
  returnData?: string;
  providerChecked?: boolean;
};

export type RiskFinding = {
  id: string;
  level: RiskLevel;
  title: string;
  detail: string;
  source: "deterministic" | "reputation" | "simulation";
};

export type RiskReport = {
  level: RiskLevel;
  headline: string;
  findings: RiskFinding[];
};

export type AssetPosition = {
  asset: string;
  symbol: string;
  amount: string;
  valueLabel?: string;
  allowance?: string;
  spender?: string;
};

export type Erc20TokenEvidence = {
  tokenAddress: string;
  symbol: string;
  decimals: number;
  ownerAddress: string;
  balance: string;
  spender?: string;
  allowance?: string;
  detail: string;
};

export type TraceTokenDelta = {
  asset: string;
  symbol: string;
  amount: string;
  direction: "in" | "out";
  beforeAmount?: string;
  afterAmount?: string;
  counterparty?: string;
  detail: string;
};

export type AssetMovement = {
  asset: string;
  symbol: string;
  direction: "out" | "in" | "approval";
  amount: string;
  detail: string;
  unexpected?: boolean;
};

export type AssetComparison = {
  status: "available" | "partial" | "unsupported" | "unavailable";
  detail: string;
  before: AssetPosition[];
  after: AssetPosition[];
  movements: AssetMovement[];
};

export type ReputationResult = {
  status: ReputationStatus;
  provider: string;
  detail: string;
};

export type VerificationResult = {
  status: VerificationStatus;
  label: string;
  detail: string;
  transactionHash?: string;
};

export type TransactionAnalysis = {
  draft: TransactionDraft;
  decoded: DecodedTransaction;
  simulation: SimulationResult;
  risk: RiskReport;
  reputation: ReputationResult;
  before: AssetPosition[];
  after: AssetPosition[];
  movements: AssetMovement[];
  assetComparison?: AssetComparison;
  verification: VerificationResult;
  erc20Evidence?: Erc20TokenEvidence;
  tokenIdentity?: TokenIdentity;
  traceDeltas?: TraceTokenDelta[];
  traceStatus?: "complete" | "partial" | "unavailable";
  traceDetail?: string;
  inspectorNote?: string;
};

export type IntentComparison = {
  status: "matched" | "mismatch" | "incomplete";
  intended: string;
  actual: string;
  difference: string;
};

export type RecoveryGuidance = {
  title: string;
  reason: string;
  fix: string;
};

export type GuardianAiExplanation = {
  headline: string;
  explanation: string;
  questions: string[];
  source: "ai" | "deterministic-fallback";
};

export type VerificationDiffStatus = "not-ready" | "matched" | "mismatch" | "partial" | "failed";

export type VerificationDiffItem = {
  asset: string;
  symbol: string;
  expected: string;
  actual?: string;
  outcome: "matched" | "mismatch" | "partial";
};

export type VerificationDiff = {
  status: VerificationDiffStatus;
  label: string;
  detail: string;
  items: VerificationDiffItem[];
};

export type DemoScenario = {
  id: "safe-transfer" | "unlimited-approval" | "transaction-mismatch" | "failed-transaction" | "unexpected-asset-movement" | "verified-transaction";
  name: string;
  shortName: string;
  description: string;
  duration: string;
  analysis: TransactionAnalysis;
};

export type XLayerNetwork = {
  key: XLayerNetworkKey;
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  nativeSymbol: string;
};

export type XLayerRuntimeConfig = {
  mainnet: XLayerNetwork;
  testnet: XLayerNetwork;
  reputationApiUrl?: string;
  traceProviderUrl?: string;
  chainProviderKind: string;
};

export type Eip1193RequestArguments = {
  method: string;
  params?: unknown[] | object;
};

export type Eip1193Provider = {
  isMetaMask?: boolean;
  request: (args: Eip1193RequestArguments) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

export type WalletState = {
  available: boolean;
  connected: boolean;
  address?: string;
  chainId?: number;
  providerLabel?: string;
};

export type ManagedWalletKind = "connected" | "watch";

export type ManagedWallet = {
  id: string;
  address: string;
  label: string;
  kind: ManagedWalletKind;
  addedAt: number;
};

export type WalletPortfolio = {
  activeWalletId?: string;
  wallets: ManagedWallet[];
};

export type ReviewHistorySource = "live" | "demo";
export type ReviewHistoryFilter = "all" | "live" | "demo" | RiskLevel;

export type ReviewHistoryRecord = {
  id: string;
  createdAt: number;
  source: ReviewHistorySource;
  walletAddress?: string;
  chainId: number;
  method: string;
  consequence: string;
  riskLevel: RiskLevel;
  verification: VerificationStatus;
  transactionHash?: string;
};
