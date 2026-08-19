import { GuardianEvidence } from "./guardianExplanation";

export type RemediationResponse = {
  headline: string;
  advice: string[];
  safeAlternative?: string;
};

export type PortfolioInsightsResponse = {
  headline: string;
  summary: string;
  riskPatterns: string[];
};

const REMEDIATION_SYSTEM_PROMPT =
  "You are Guardian's transaction security remediation expert. Your goal is to analyze a dangerous transaction and suggest safer alternatives to the user. Do not claim absolute certainty. Return JSON with a headline, an array of actionable advice strings, and an optional safeAlternative string (a description of what a safer transaction would look like).";

const PORTFOLIO_SYSTEM_PROMPT =
  "You are Guardian's portfolio security analyst. Your goal is to analyze a user's transaction history and provide a security summary. Highlight any risky patterns or excellent security hygiene. Return JSON with a headline, a summary string, and an array of riskPatterns (notable observations).";

function parseGeminiJson(text: string): unknown {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  return JSON.parse(withoutFence);
}

export async function generateRemediation(
  evidence: GuardianEvidence
): Promise<RemediationResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      headline: "Remediation Unavailable",
      advice: ["Connect an API key to view suggestions."],
    };
  }

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
          parts: [{ text: REMEDIATION_SYSTEM_PROMPT }],
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
              advice: { type: "ARRAY", items: { type: "STRING" } },
              safeAlternative: { type: "STRING" },
            },
            required: ["headline", "advice"],
          },
        },
      }),
    });

    if (!response.ok) throw new Error("Remediation fetch failed");

    const result = await response.json();
    const text =
      result.candidates?.[0]?.content?.parts
        ?.map((part: any) => part.text ?? "")
        .join("")
        .trim() ?? "";
    
    if (!text) throw new Error("Empty response");

    return parseGeminiJson(text) as RemediationResponse;
  } catch (error) {
    console.error("Remediation error:", error);
    return {
      headline: "Could not generate remediation",
      advice: ["The AI service is currently unavailable. Please review the transaction manually."],
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function generatePortfolioInsights(
  history: any[]
): Promise<PortfolioInsightsResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      headline: "Insights Unavailable",
      summary: "Connect an API key to view insights.",
      riskPatterns: [],
    };
  }

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
          parts: [{ text: PORTFOLIO_SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: JSON.stringify(history) }],
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
              summary: { type: "STRING" },
              riskPatterns: { type: "ARRAY", items: { type: "STRING" } },
            },
            required: ["headline", "summary", "riskPatterns"],
          },
        },
      }),
    });

    if (!response.ok) throw new Error("Insights fetch failed");

    const result = await response.json();
    const text =
      result.candidates?.[0]?.content?.parts
        ?.map((part: any) => part.text ?? "")
        .join("")
        .trim() ?? "";
    
    if (!text) throw new Error("Empty response");

    return parseGeminiJson(text) as PortfolioInsightsResponse;
  } catch (error) {
    console.error("Insights error:", error);
    return {
      headline: "Could not generate insights",
      summary: "The AI service is currently unavailable.",
      riskPatterns: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}
