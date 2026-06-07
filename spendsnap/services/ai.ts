import { invokeAiExpense } from "./aiBackend";

export type ExtractedTransaction = {
  amount: number;
  category?: string;
  merchant?: string;
  date?: string;
  note?: string;
  confidence?: number;
};

const VALID_CATEGORIES = ["Food", "Transport", "Shopping", "Housing", "Health", "Education", "Entertainment", "Family", "Work", "Investment", "Others"];

export async function extractTransactionFromText(text: string, language: "vi" | "en" = "vi"): Promise<ExtractedTransaction> {
  try {
    const result = await invokeAiExpense<ExtractedTransaction>("extract-text", {
      text,
      today: new Date().toISOString(),
      language,
    });
    return normalizeExtracted(result);
  } catch (error) {
    console.warn("AI text extraction failed, using fallback:", error);
    return fallbackExtract(text);
  }
}

export function keywordClassify(merchant: string, note?: string | null): string {
  const text = `${merchant} ${note || ""}`.toLowerCase();
  if (/(pho|bun|com|food|lunch|dinner|lotteria|kfc|pizza|restaurant|cf|coffee|cafe|highlands|starbucks|tra sua|phuc long|gong cha|drink)/i.test(text)) return "Food";
  if (/(grab|taxi|transport|vinasun|mai linh|bus|train|flight|travel)/i.test(text)) return "Transport";
  if (/(shop|lazada|shopee|tiki|aeon|mall|market|clothes|shopping)/i.test(text)) return "Shopping";
  if (/(rent|house|housing|home|electric|water|internet|evn|vnpt|fpt|viettel|utility|bill)/i.test(text)) return "Housing";
  if (/(health|doctor|hospital|medicine|pharmacy|clinic|drug)/i.test(text)) return "Health";
  if (/(education|school|course|book|tuition|class|study)/i.test(text)) return "Education";
  if (/(movie|cinema|cgv|game|music|entertainment|fahasa)/i.test(text)) return "Entertainment";
  if (/(family|kids|baby|child|parent)/i.test(text)) return "Family";
  if (/(work|office|business|cowork|meeting)/i.test(text)) return "Work";
  if (/(invest|stock|crypto|fund|saving)/i.test(text)) return "Investment";
  return "Others";
}

export async function classifyCategoryWithLLM(
  merchant?: string | null,
  note?: string | null,
  retries = 2
): Promise<string> {
  const keywordResult = keywordClassify(merchant || "", note);
  if (keywordResult !== "Others") return keywordResult;

  const text = [merchant, note].filter(Boolean).join(" - ");
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await invokeAiExpense<{ category?: string }>("classify-category", {
        text,
        validCategories: VALID_CATEGORIES,
        language: "vi",
      });
      if (result.category && VALID_CATEGORIES.includes(result.category)) return result.category;
    } catch {
      // retry, then fall back
    }
  }

  return "Others";
}

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

function normalizeExtracted(input: ExtractedTransaction): ExtractedTransaction {
  return {
    amount: Number(input.amount) || 0,
    merchant: input.merchant || undefined,
    category: input.category || undefined,
    date: input.date || undefined,
    note: input.note || undefined,
    confidence: typeof input.confidence === "number" ? input.confidence : undefined,
  };
}

function fallbackExtract(text: string): ExtractedTransaction {
  const normalized = text.replace(/,/g, ".").trim();
  const amount = extractVndAmount(normalized);
  const merchant = normalized.split(/\s+/).slice(0, 3).join(" ");
  return {
    amount,
    merchant: merchant || undefined,
    category: keywordClassify(normalized),
    note: text.trim(),
    confidence: 0.2,
  };
}

function extractVndAmount(text: string): number {
  const unitMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(k|m|tr|trieu|million)\b/i);
  if (unitMatch) {
    const raw = Number(unitMatch[1].replace(",", "."));
    if (!Number.isFinite(raw)) return 0;
    const unit = unitMatch[2].toLowerCase();
    if (unit === "m" || unit === "tr" || unit === "trieu" || unit === "million") return Math.round(raw * 1_000_000);
    return Math.round(raw * 1_000);
  }

  const plainMatch = text.match(/(\d[\d.,]*)/);
  if (!plainMatch) return 0;
  const numeric = Number(plainMatch[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numeric) ? Math.round(numeric * 1_000) : 0;
}
