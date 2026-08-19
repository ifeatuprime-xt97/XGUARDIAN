import { invokeLLM, listLLMModels } from "./_core/llm";

export type GuardianEvidence = {
  intent: string;
  actual: string;
  network: string;
  simulation: { status: string; detail: string; gasEstimate?: string };
  findings: Array<{ title: string; detail: string; level: string }>;
  movements: Array<{ symbol: string; amount: string; direction: string; detail: string }>;
};

export type GuardianExplanation = {
  headline: string;
  explanation: string;
  questions: string[];
  source: "ai" | "deterministic-fallback";
};

const bannedClaims = /\b(scam|fraud|malicious|owner|identity|guarantee|guaranteed|safe to sign)\b/i;
const clip = (value: string, max: number) => value.trim().replace(/\s+/g, " ").slice(0, max);

export function deterministicExplanation(evidence: GuardianEvidence): GuardianExplanation {
  const findings = evidence.findings.slice(0, 2);
  const headline = findings[0]?.title ?? (evidence.simulation.status === "success" ? "Simulation completed" : "Simulation needs review");
  const findingText = findings.length ? findings.map((finding) => finding.detail).join(" ") : "No deterministic high-risk behavior was found by the configured local checks.";
  const movementText = evidence.movements.length ? `Decoded asset effect: ${evidence.movements.map((movement) => `${movement.direction} ${movement.amount} ${movement.symbol}`).join(", ")}.` : "No explicit decoded asset movement is available.";
  return {
    headline: clip(headline, 120),
    explanation: clip(`${evidence.actual} ${findingText} ${movementText} This explanation is limited to the shown X Layer simulation and deterministic evidence.`, 620),
    questions: ["Does the stated intent match the decoded effect?", "Do you recognize the destination or spender?", "Are the shown token permission and asset movements acceptable?"],
    source: "deterministic-fallback",
  };
}

function isUsableExplanation(value: unknown): value is Omit<GuardianExplanation, "source"> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { headline?: unknown; explanation?: unknown; questions?: unknown };
  return typeof candidate.headline === "string" && candidate.headline.length > 0 && candidate.headline.length <= 140 && !bannedClaims.test(candidate.headline)
    && typeof candidate.explanation === "string" && candidate.explanation.length > 0 && candidate.explanation.length <= 700 && !bannedClaims.test(candidate.explanation)
    && Array.isArray(candidate.questions) && candidate.questions.length > 0 && candidate.questions.length <= 3 && candidate.questions.every((question) => typeof question === "string" && question.length <= 180 && !bannedClaims.test(question));
}

export async function explainGuardianEvidence(evidence: GuardianEvidence): Promise<GuardianExplanation> {
  const fallback = deterministicExplanation(evidence);
  try {
    const { data } = await listLLMModels();
    const model = data.find((item) => item.id === "gpt-5-mini")?.id ?? data.find((item) => item.id === "claude-haiku-4-5")?.id;
    if (!model) return fallback;
    const response = await invokeLLM({
      model,
      messages: [
        { role: "system", content: "You are Guardian's transaction explainer. Use only the supplied evidence. Never claim an address is owned by a person, never allege scams or malicious behavior, never add balances, prices, assets, chain facts, or security intelligence that are absent. Do not recommend signing. Be direct and concise." },
        { role: "user", content: JSON.stringify(evidence) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "guardian_transaction_explanation",
          strict: true,
          schema: {
            type: "object",
            properties: {
              headline: { type: "string" },
              explanation: { type: "string" },
              questions: { type: "array", items: { type: "string" } },
            },
            required: ["headline", "explanation", "questions"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = response.choices[0]?.message?.content;
    const rawJson = typeof content === "string" ? content : "{}";
    const parsed: unknown = JSON.parse(rawJson);
    if (!isUsableExplanation(parsed)) {
      console.warn("[Guardian AI] Model response rejected by boundary checks.", JSON.stringify(parsed).slice(0, 900));
      return fallback;
    }
    return { headline: clip(parsed.headline, 140), explanation: clip(parsed.explanation, 700), questions: parsed.questions.map((question) => clip(question, 180)), source: "ai" };
  } catch (error) {
    console.warn("[Guardian AI] Falling back to deterministic transaction wording.", error);
    return fallback;
  }
}
