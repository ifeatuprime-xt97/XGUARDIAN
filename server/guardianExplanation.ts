export type GuardianEvidence = {
  intent: string;
  actual: string;
  network: string;
  simulation: { status: string; detail: string; gasEstimate?: string };
  findings: Array<{ title: string; detail: string; level: string }>;
  movements: Array<{
    symbol: string;
    amount: string;
    direction: string;
    detail: string;
  }>;
};

export type GuardianExplanation = {
  headline: string;
  explanation: string;
  questions: string[];
  source: "ai" | "deterministic-fallback";
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

const bannedClaims =
  /\b(scam|fraud|malicious|owner|identity|guarantee|guaranteed|safe to sign)\b/i;
const clip = (value: string, max: number) =>
  value.trim().replace(/\s+/g, " ").slice(0, max);

const GUARDIAN_SYSTEM_PROMPT =
  "You are Guardian's transaction explainer. Use only the supplied evidence. Never claim an address is owned by a person, never allege scams or malicious behavior, never add balances, prices, assets, chain facts, or security intelligence that are absent. Do not recommend signing. Return only JSON with headline, explanation, and questions.";

export function deterministicExplanation(
  evidence: GuardianEvidence
): GuardianExplanation {
  const findings = evidence.findings.slice(0, 2);
  const headline =
    findings[0]?.title ??
    (evidence.simulation.status === "success"
      ? "Simulation completed"
      : "Simulation needs review");
  const findingText = findings.length
    ? findings.map((finding) => finding.detail).join(" ")
    : "No deterministic high-risk behavior was found by the configured local checks.";
  const movementText = evidence.movements.length
    ? `Decoded asset effect: ${evidence.movements
        .map(
          (movement) =>
            `${movement.direction} ${movement.amount} ${movement.symbol}`
        )
        .join(", ")}.`
    : "No explicit decoded asset movement is available.";

  return {
    headline: clip(headline, 120),
    explanation: clip(
      `${evidence.actual} ${findingText} ${movementText} This explanation is limited to the shown X Layer simulation and deterministic evidence.`,
      620
    ),
    questions: [
      "Does the stated intent match the decoded effect?",
      "Do you recognize the destination or spender?",
      "Are the shown token permission and asset movements acceptable?",
    ],
    source: "deterministic-fallback",
  };
}

function isUsableExplanation(
  value: unknown
): value is Omit<GuardianExplanation, "source"> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    headline?: unknown;
    explanation?: unknown;
    questions?: unknown;
  };

  return (
    typeof candidate.headline === "string" &&
    candidate.headline.length > 0 &&
    candidate.headline.length <= 140 &&
    !bannedClaims.test(candidate.headline) &&
    typeof candidate.explanation === "string" &&
    candidate.explanation.length > 0 &&
    candidate.explanation.length <= 700 &&
    !bannedClaims.test(candidate.explanation) &&
    Array.isArray(candidate.questions) &&
    candidate.questions.length > 0 &&
    candidate.questions.length <= 3 &&
    candidate.questions.every(
      (question) =>
        typeof question === "string" &&
        question.length <= 180 &&
        !bannedClaims.test(question)
    )
  );
}

function parseGeminiJson(text: string): unknown {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  return JSON.parse(withoutFence);
}

async function explainWithGemini(
  evidence: GuardianEvidence
): Promise<Omit<GuardianExplanation, "source"> | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: GUARDIAN_SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: JSON.stringify(evidence) }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 512,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              headline: { type: "STRING" },
              explanation: { type: "STRING" },
              questions: {
                type: "ARRAY",
                items: { type: "STRING" },
              },
            },
            required: ["headline", "explanation", "questions"],
          },
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.warn(
        `[Guardian AI] Gemini request failed: ${response.status} ${response.statusText} ${detail.slice(
          0,
          500
        )}`
      );
      return null;
    }

    const result = (await response.json()) as GeminiGenerateContentResponse;
    const text =
      result.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "";
    if (!text) return null;

    const parsed = parseGeminiJson(text);
    if (!isUsableExplanation(parsed)) {
      console.warn(
        "[Guardian AI] Gemini response rejected by boundary checks.",
        JSON.stringify(parsed).slice(0, 900)
      );
      return null;
    }

    return {
      headline: clip(parsed.headline, 140),
      explanation: clip(parsed.explanation, 700),
      questions: parsed.questions.map((question) => clip(question, 180)),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function explainGuardianEvidence(
  evidence: GuardianEvidence
): Promise<GuardianExplanation> {
  const fallback = deterministicExplanation(evidence);

  try {
    const explanation = await explainWithGemini(evidence);
    if (!explanation) return fallback;
    return { ...explanation, source: "ai" };
  } catch (error) {
    console.warn(
      "[Guardian AI] Falling back to deterministic transaction wording.",
      error
    );
    return fallback;
  }
}
