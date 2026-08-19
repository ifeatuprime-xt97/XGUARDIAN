import { describe, expect, it } from "vitest";
import { filterReviewHistory, loadReviewHistory, prependReviewHistory, saveReviewHistory, updateReviewHistoryVerification } from "./reviewHistory";
import type { ReviewHistoryRecord } from "./types";

const records: ReviewHistoryRecord[] = [
  { id: "review:1", createdAt: 10, source: "live", chainId: 196, method: "ERC-20 transfer", consequence: "Send 2 USDT", riskLevel: "safe", verification: "not-verified" },
  { id: "review:2", createdAt: 20, source: "demo", chainId: 1952, method: "Approve", consequence: "Permission 10 TOKEN", riskLevel: "critical", verification: "verified" },
];

describe("browser-local review history", () => {
  it("filters records deterministically by source and risk level", () => {
    expect(filterReviewHistory(records, "live")).toHaveLength(1);
    expect(filterReviewHistory(records, "critical")).toMatchObject([{ id: "review:2" }]);
    expect(filterReviewHistory(records, "all")).toHaveLength(2);
  });

  it("persists sanitized records, deduplicates new entries, and updates receipt state", () => {
    let stored = "";
    const storage = { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } };
    saveReviewHistory(records, storage);
    const loaded = loadReviewHistory(storage);
    expect(loaded.map((record) => record.id)).toEqual(["review:2", "review:1"]);
    const appended = prependReviewHistory(loaded, { ...records[0], createdAt: 30 });
    expect(appended).toHaveLength(2);
    expect(updateReviewHistoryVerification(appended, "review:1", "verified", "0xhash").find((record) => record.id === "review:1")).toMatchObject({ id: "review:1", verification: "verified", transactionHash: "0xhash" });
  });
});
