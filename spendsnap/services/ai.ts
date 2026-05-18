import { getOpenAiKey } from "./openai";

export type ExtractedTransaction = {
  amount: number;
  category?: string;
  merchant?: string;
  date?: string;
  note?: string;
  confidence?: number;
};

export async function extractTransactionFromText(text: string): Promise<ExtractedTransaction> {
  const key = getOpenAiKey();
  if (!key) {
    return fallbackExtract(text);
  }

  const system =
    "You extract structured expense transaction data from Vietnamese or English text. " +
    "Return JSON only with fields: amount (number, VND), merchant (string), category (string), date (ISO string), note (string), confidence (0..1). " +
    "If amount is missing, set amount to 0.";

  const user = `Text: ${text}\n\nToday: ${new Date().toISOString()}`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    throw new Error(`OpenAI error (${resp.status})`);
  }

  const data = (await resp.json()) as any;
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("No extraction content.");

  const parsed = JSON.parse(content);
  return {
    amount: Number(parsed.amount) || 0,
    merchant: parsed.merchant || undefined,
    category: parsed.category || undefined,
    date: parsed.date || undefined,
    note: parsed.note || undefined,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : undefined,
  };
}

function fallbackExtract(text: string): ExtractedTransaction {
  const normalized = text.replace(/,/g, ".").trim();
  const amount = extractVndAmount(normalized);
  const merchant = normalized.split(/\s+/).slice(0, 3).join(" ");
  return {
    amount,
    merchant: merchant || undefined,
    category: guessCategory(normalized),
    note: text.trim(),
    confidence: 0.2,
  };
}

function extractVndAmount(text: string): number {
  const kMatch = text.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) return Math.round(Number(kMatch[1]) * 1000);

  const vndMatch = text.match(/(\d[\d.]{0,})/);
  if (!vndMatch) return 0;
  const asInt = Number(vndMatch[1].replace(/\./g, ""));
  return Number.isFinite(asInt) ? asInt : 0;
}

function guessCategory(text: string): string | undefined {
  const t = text.toLowerCase();
  if (t.includes("grab") || t.includes("uber") || t.includes("taxi")) return "Transport";
  if (t.includes("cafe") || t.includes("coffee") || t.includes("highlands") || t.includes("starbucks"))
    return "Coffee";
  if (t.includes("ăn") || t.includes("lunch") || t.includes("dinner") || t.includes("food"))
    return "Food";
  return undefined;
}
