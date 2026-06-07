import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

import { invokeAiExpense } from "./aiBackend";
import { uploadReceiptImageBase64 } from "./receipts";

export type OcrExtractedTransaction = {
  amount: number;
  merchant?: string;
  category?: string;
  date?: string;
  note?: string;
  confidence?: number;
  receiptId?: string;
};

export async function extractTransactionFromReceiptImage(
  imageUri: string,
  language: "vi" | "en" = "vi"
): Promise<OcrExtractedTransaction> {
  const { base64, mimeType } = await readImageAsBase64(imageUri);
  const parsed = await invokeAiExpense<OcrExtractedTransaction>("scan-receipt", {
    imageBase64: base64,
    mimeType,
    today: new Date().toISOString(),
    language,
  });

  let receiptId: string | undefined;
  try {
    const uploaded = await uploadReceiptImageBase64(base64, mimeType);
    receiptId = uploaded?.id;
  } catch (error) {
    console.warn("Receipt upload failed:", error);
  }

  return {
    amount: Number(parsed.amount) || 0,
    merchant: parsed.merchant || undefined,
    category: parsed.category || undefined,
    date: parsed.date || undefined,
    note: parsed.note || undefined,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : undefined,
    receiptId,
  };
}

async function readImageAsBase64(uri: string): Promise<{ base64: string; mimeType: string }> {
  if (Platform.OS !== "web") {
    try {
      const FileSystemMod = require("expo-file-system");
      if (FileSystemMod?.File) {
        const file = new FileSystemMod.File(uri);
        const base64 = await file.base64();
        return { base64, mimeType: guessMimeTypeFromUri(uri) };
      }
    } catch (err) {
      console.warn("Expo File API failed:", err);
    }

    try {
      const FileSystemLegacy = require("expo-file-system/legacy");
      if (typeof FileSystemLegacy?.readAsStringAsync === "function") {
        const base64 = await FileSystemLegacy.readAsStringAsync(uri, { encoding: "base64" });
        return { base64, mimeType: guessMimeTypeFromUri(uri) };
      }
    } catch (err) {
      console.warn("Expo legacy FileSystem failed:", err);
    }

    if (typeof FileSystem.readAsStringAsync === "function") {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
      return { base64, mimeType: guessMimeTypeFromUri(uri) };
    }

    throw new Error("No file-system read method available on this platform.");
  }

  const resp = await fetch(uri);
  if (!resp.ok) throw new Error(`Failed to load image (${resp.status})`);
  const blob = await resp.blob();
  const base64 = await blobToBase64(blob);
  return { base64, mimeType: blob.type || guessMimeTypeFromUri(uri) };
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
