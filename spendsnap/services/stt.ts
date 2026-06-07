import * as FileSystem from "expo-file-system";

import { invokeAiExpense } from "./aiBackend";

type TranscriptionResponse = {
  text?: string;
};

export async function transcribeAudio(fileUri: string): Promise<string> {
  const audioBase64 = await readAudioAsBase64(fileUri);
  const data = await invokeAiExpense<TranscriptionResponse>("transcribe-audio", {
    audioBase64,
    mimeType: "audio/m4a",
    language: "vi",
  });
  const text = data.text?.trim();
  if (!text) throw new Error("Transcription returned empty text.");
  return text;
}

export async function transcribeAudioWeb(blob: Blob, mimeType = "audio/webm"): Promise<string> {
  const audioBase64 = await blobToBase64(blob);
  const data = await invokeAiExpense<TranscriptionResponse>("transcribe-audio", {
    audioBase64,
    mimeType,
    language: "vi",
  });
  const text = data.text?.trim();
  if (!text) throw new Error("Transcription returned empty text.");
  return text;
}

async function readAudioAsBase64(uri: string): Promise<string> {
  try {
    const FileSystemMod = require("expo-file-system");
    if (FileSystemMod?.File) {
      const file = new FileSystemMod.File(uri);
      return await file.base64();
    }
  } catch (err) {
    console.warn("Expo File API failed:", err);
  }

  try {
    const FileSystemLegacy = require("expo-file-system/legacy");
    if (typeof FileSystemLegacy?.readAsStringAsync === "function") {
      return await FileSystemLegacy.readAsStringAsync(uri, { encoding: "base64" });
    }
  } catch (err) {
    console.warn("Expo legacy FileSystem failed:", err);
  }

  if (typeof FileSystem.readAsStringAsync === "function") {
    return await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
  }

  throw new Error("No file-system read method available on this platform.");
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read audio blob."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return reject(new Error("Unexpected reader result."));
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}
