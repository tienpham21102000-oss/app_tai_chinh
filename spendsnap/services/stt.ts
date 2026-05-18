import { requireOpenAiKey } from "./openai";

type WhisperResponse = {
  text?: string;
};

export async function transcribeAudio(fileUri: string): Promise<string> {
  const key = requireOpenAiKey();

  const form = new FormData();
  form.append("model", "whisper-1");
  form.append("language", "vi");
  form.append("file", { uri: fileUri, name: "recording.m4a", type: "audio/m4a" } as any);

  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  if (!resp.ok) {
    const bodyText = await resp.text().catch(() => "");
    throw new Error(`Whisper error (${resp.status})${bodyText ? `: ${bodyText.slice(0, 200)}` : ""}`);
  }

  const data = (await resp.json()) as WhisperResponse;
  const text = data.text?.trim();
  if (!text) throw new Error("Whisper returned empty text.");
  return text;
}

export async function transcribeAudioWeb(blob: Blob, mimeType = "audio/webm"): Promise<string> {
  const key = requireOpenAiKey();

  const form = new FormData();
  // Whisper accepts many formats; web mic commonly produces webm/opus.
  form.append("model", "whisper-1");
  form.append("language", "vi");
  form.append("file", blob, mimeType.includes("ogg") ? "recording.ogg" : "recording.webm");

  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  if (!resp.ok) throw new Error(`Whisper error (${resp.status})`);
  const data = (await resp.json()) as WhisperResponse;
  const text = data.text?.trim();
  if (!text) throw new Error("Whisper returned empty text.");
  return text;
}
