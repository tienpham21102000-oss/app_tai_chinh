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
    "Treat plain numbers without a unit as thousands of VND, so 200 means 200000 VND. " +
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

// ─── LLM CATEGORY CLASSIFICATION ──────────────────────────────
// Given a transaction's merchant name + note, classify into one of the known categories.
// Falls back to keyword matching if no OpenAI key is available.

const VALID_CATEGORIES = ["Food", "Drinks", "Travel", "Shopping", "Entertainment", "Bills", "Others"];

/**
 * Keyword-based category matching (same as normalizeCategory in analytics.tsx)
 */
export function keywordClassify(merchant: string, note?: string | null): string {
  const text = `${merchant} ${note || ""}`.toLowerCase();
  if (text.includes("phở") || text.includes("ăn") || text.includes("food") || text.includes("lunch") || text.includes("dinner") || text.includes("cơm") || text.includes("bún") || text.includes("lotteria")) return "Food";
  if (text.includes("cf") || text.includes("coffee") || text.includes("cà phê") || text.includes("highlands") || text.includes("starbucks") || text.includes("trà sữa") || text.includes("phúc long") || text.includes("gong cha")) return "Drinks";
  if (text.includes("grab") || text.includes("taxi") || text.includes("xe") || text.includes("di chuyển") || text.includes("transport") || text.includes("be ") || text.includes("vinasun") || text.includes("mai linh")) return "Travel";
  if (text.includes("mua") || text.includes("shop") || text.includes("lazada") || text.includes("shopee") || text.includes("quần áo") || text.includes("tiki") || text.includes("vinmart") || text.includes("big c") || text.includes("aeon")) return "Shopping";
  if (text.includes("phim") || text.includes("chơi") || text.includes("nhạc") || text.includes("entertainment") || text.includes("game") || text.includes("cgv") || text.includes("lotte cinema") || text.includes("fahasa")) return "Entertainment";
  if (text.includes("điện") || text.includes("nước") || text.includes("bill") || text.includes("internet") || text.includes("evn") || text.includes("vnpt") || text.includes("fpt") || text.includes("viettel")) return "Bills";
  return "Others";
}

/**
 * Classify a transaction's category using keyword matching first, then LLM fallback.
 * For batch usage: process one transaction at a time.
 */
export async function classifyCategoryWithLLM(
  merchant?: string | null,
  note?: string | null,
  retries = 2
): Promise<string> {
  // Step 1: try keyword matching
  const keywordResult = keywordClassify(merchant || "", note);
  if (keywordResult !== "Others") {
    return keywordResult;
  }

  // Step 2: if still "Others", try OpenAI
  const key = getOpenAiKey();
  if (!key) return "Others";

  const text = [merchant, note].filter(Boolean).join(" - ");

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const system =
        "You classify Vietnamese expense transactions into exactly one category from this list: " +
        VALID_CATEGORIES.join(", ") +
        ". Return JSON with field: category (string). " +
        `Examples: "Phở 24" → Food, "Highlands Coffee" → Drinks, "Grab" → Travel, "Shopee" → Shopping, "CGV" → Entertainment, "EVN" → Bills. ` +
        "If unsure, choose the most likely category. Never return unknown or null.";

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
            { role: "user", content: `Text: "${text}"` },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!resp.ok) continue;
      const data = (await resp.json()) as any;
      const content = data?.choices?.[0]?.message?.content;
      if (!content) continue;

      const parsed = JSON.parse(content);
      const cat = parsed?.category;
      if (cat && VALID_CATEGORIES.includes(cat)) return cat;
    } catch {
      // retry
    }
  }

  return "Others";
}

/**
 * Batch classify multiple transactions with LLM.
 * Returns a map of transaction id → category.
 */
export async function batchClassifyWithLLM(
  items: Array<{ id: string; merchant?: string | null; note?: string | null }>,
  concurrency = 3
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const queue = [...items];

  const worker = async () => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      result[item.id] = await classifyCategoryWithLLM(item.merchant, item.note);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);

  return result;
}

// ─── FALLBACK (original) ──────────────────────────────────────

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
  const unitMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(k|m|tr|triệu)\b/i);
  if (unitMatch) {
    const raw = Number(unitMatch[1].replace(",", "."));
    if (!Number.isFinite(raw)) return 0;
    const unit = unitMatch[2].toLowerCase();
    if (unit === "m" || unit === "tr" || unit === "triệu") return Math.round(raw * 1000000);
    return Math.round(raw * 1000);
  }

  const plainMatch = text.match(/(\d[\d.,]*)/);
  if (!plainMatch) return 0;
  const numeric = Number(plainMatch[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numeric) ? Math.round(numeric * 1000) : 0;
}

function guessCategory(text: string): string | undefined {
  const t = text.toLowerCase();
  if (t.includes("grab") || t.includes("uber") || t.includes("taxi")) return "Transport";
  if (t.includes("cafe") || t.includes("coffee") || t.includes("highlands") || t.includes("starbucks")) return "Coffee";
  if (t.includes("ăn") || t.includes("lunch") || t.includes("dinner") || t.includes("food")) return "Food";
  return undefined;
}
