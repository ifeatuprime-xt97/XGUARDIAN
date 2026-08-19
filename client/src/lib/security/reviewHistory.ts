import type { ReviewHistoryFilter, ReviewHistoryRecord, TransactionAnalysis } from "./types";

export const REVIEW_HISTORY_STORAGE_KEY = "xlayer-guardian-review-history-v1";
const HISTORY_LIMIT = 120;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function isRecord(value: unknown): value is ReviewHistoryRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ReviewHistoryRecord>;
  return typeof item.id === "string" && typeof item.createdAt === "number" && (item.source === "live" || item.source === "demo") && typeof item.chainId === "number" && typeof item.method === "string" && typeof item.consequence === "string" && (item.riskLevel === "safe" || item.riskLevel === "warning" || item.riskLevel === "critical") && (item.verification === "not-verified" || item.verification === "pending" || item.verification === "verified" || item.verification === "failed");
}

// Fix 8: Use crypto.randomUUID() to prevent ID collisions on rapid double-clicks.
export function createReviewHistoryRecord(analysis: TransactionAnalysis, source: ReviewHistoryRecord["source"], id = `review:${crypto.randomUUID()}`, createdAt = Date.now()): ReviewHistoryRecord {
  const movement = analysis.movements[0];
  const consequence = movement ? `${movement.direction === "approval" ? "Permission" : movement.direction === "out" ? "Send" : "Receive"} ${movement.amount} ${movement.symbol}` : analysis.decoded.method;
  return { id, createdAt, source, walletAddress: analysis.draft.from, chainId: analysis.draft.chainId, method: analysis.decoded.method, consequence, riskLevel: analysis.risk.level, verification: analysis.verification.status, transactionHash: analysis.verification.transactionHash };
}

export function loadReviewHistory(storage?: StorageLike): ReviewHistoryRecord[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(REVIEW_HISTORY_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isRecord).sort((a, b) => b.createdAt - a.createdAt).slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

export function saveReviewHistory(records: ReviewHistoryRecord[], storage?: StorageLike) {
  storage?.setItem(REVIEW_HISTORY_STORAGE_KEY, JSON.stringify(records.slice(0, HISTORY_LIMIT)));
}

export function prependReviewHistory(records: ReviewHistoryRecord[], record: ReviewHistoryRecord) {
  return [record, ...records.filter((item) => item.id !== record.id)].sort((a, b) => b.createdAt - a.createdAt).slice(0, HISTORY_LIMIT);
}

export function updateReviewHistoryVerification(records: ReviewHistoryRecord[], id: string, verification: ReviewHistoryRecord["verification"], transactionHash?: string) {
  return records.map((item) => item.id === id ? { ...item, verification, transactionHash } : item);
}

export function filterReviewHistory(records: ReviewHistoryRecord[], filter: ReviewHistoryFilter) {
  if (filter === "all") return records;
  if (filter === "live" || filter === "demo") return records.filter((item) => item.source === filter);
  return records.filter((item) => item.riskLevel === filter);
}
