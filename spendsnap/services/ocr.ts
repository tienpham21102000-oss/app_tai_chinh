import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

import { requireOpenAiKey } from "./openai";

export type OcrExtractedTransaction = {
  amount: number;
  merchant?: string;
  category?: string;
  date?: string;
  note?: string;
  confidence?: number;
};

export async function extractTransactionFromReceiptImage(
  imageUri: string
): Promise<OcrExtractedTransaction> {
  const key = requireOpenAiKey();

  const { base64, mimeType } = await readImageAsBase64(imageUri);

  const system =
    "You are an expert receipt scanner. " +
    "Analyze the receipt image to extract the following transaction details for personal accounting. " +
    "The receipts are typically in Vietnamese or English. " +
    "Guidelines: " +
    "1. For the 'amount', find the final total amount paid (e.g., 'TỔNG CỘNG', 'Thanh toán', 'Total', 'Tổng tiền', 'Thành tiền', 'Khách trả', 'Tiền mặt'). If there are multiple totals (like subtotal, discount, final total), always extract the final paid total. If it uses 'k' or 'K' (e.g., '50k', '120k'), multiply it by 1000 to get the exact integer. If the text shows a plain number without a unit, treat it as thousands of VND, so 200 means 200000. Extract as a number in VND (do not include currency symbols or dots, e.g., 75000). " +
    "2. For 'merchant', look at the header of the receipt to identify the store or company name (e.g., 'Highlands Coffee', 'Circle K', 'Grab', 'Bách Hóa Xanh'). " +
    "3. For 'category', classify the receipt into one of these: 'Food', 'Drinks', 'Transport', 'Shopping', 'Entertainment', 'Bills', 'Others'. " +
    "4. For 'note', provide a short summary of the items purchased (e.g., '2 Cà phê đá', 'Bánh mì + Pepsi', 'Đi siêu thị'). " +
    "5. For 'date', extract the transaction date (ISO format like YYYY-MM-DD or YYYY-MM-DDT...)." +
    "Return a valid JSON object ONLY with exactly these fields: amount (number), merchant (string), category (string), date (string), note (string), confidence (number, 0 to 1). " +
    "Do NOT extract PII such as credit card digits, phone numbers, individual full names, or home addresses. Only output raw JSON.";

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // Softer safety filter, faster and cost-efficient vision model
      temperature: 0.1,
      response_format: { type: "json_object" },
      max_tokens: 300,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: `Today's date is: ${new Date().toISOString()}. Extract transaction from this receipt.` },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const bodyText = await resp.text().catch(() => "");
    throw new Error(
      `OpenAI OCR error (${resp.status})${bodyText ? `: ${bodyText.slice(0, 500)}` : ""}`
    );
  }

  const data = (await resp.json()) as any;
  const message = data?.choices?.[0]?.message;
  const content = message?.content;
  if (!content) {
    const refusal = message?.refusal;
    const finishReason = data?.choices?.[0]?.finish_reason;
    throw new Error(
      `No OCR extraction content.${refusal ? ` Refusal: ${String(refusal).slice(0, 200)}` : ""}${
        finishReason ? ` finish_reason=${finishReason}` : ""
      }`
    );
  }

  const parsed = safeJsonParse(content);
  return {
    amount: Number(parsed.amount) || 0,
    merchant: parsed.merchant || undefined,
    category: parsed.category || undefined,
    date: parsed.date || undefined,
    note: parsed.note || undefined,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : undefined,
  };
}

async function readImageAsBase64(uri: string): Promise<{ base64: string; mimeType: string }> {
  if (Platform.OS !== "web") {
    // 1. Try modern Expo SDK 54 File API first (highly recommended for new SDKs)
    try {
      const FileSystemMod = require("expo-file-system");
      if (FileSystemMod && FileSystemMod.File) {
        const file = new FileSystemMod.File(uri);
        const base64 = await file.base64();
        const mimeType = guessMimeTypeFromUri(uri);
        return { base64, mimeType };
      }
    } catch (err) {
      console.warn("Expo File API try failed:", err);
    }

    // 2. Try legacy fallback import
    try {
      const FileSystemLegacy = require("expo-file-system/legacy");
      if (FileSystemLegacy && typeof FileSystemLegacy.readAsStringAsync === "function") {
        const base64 = await FileSystemLegacy.readAsStringAsync(uri, { encoding: "base64" });
        const mimeType = guessMimeTypeFromUri(uri);
        return { base64, mimeType };
      }
    } catch (err) {
      console.warn("Expo Legacy API try failed:", err);
    }

    // 3. Fallback to standard imported FileSystem module
    if (FileSystem && typeof FileSystem.readAsStringAsync === "function") {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
      const mimeType = guessMimeTypeFromUri(uri);
      return { base64, mimeType };
    }

    throw new Error("No file-system read method available on this platform.");
  }

  // On web, expo-file-system may not handle every asset/uri. Fetch it and encode.
  const resp = await fetch(uri);
  if (!resp.ok) throw new Error(`Failed to load image (${resp.status})`);
  const blob = await resp.blob();
  const base64 = await blobToBase64(blob);
  const mimeType = blob.type || guessMimeTypeFromUri(uri);
  return { base64, mimeType };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image blob."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return reject(new Error("Unexpected reader result."));
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

function guessMimeTypeFromUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "image/jpeg";
}

function safeJsonParse(content: string): any {
  try {
    return JSON.parse(content);
  } catch {
    // Sometimes models wrap JSON in extra text. Try to recover by slicing the first {...} block.
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const maybe = content.slice(start, end + 1);
      return JSON.parse(maybe);
    }
    throw new Error("OCR returned non-JSON content.");
  }
}
