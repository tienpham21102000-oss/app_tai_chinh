import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import { uuid } from "../utils/uuid";

export type UploadedReceipt = {
  id: string;
  storagePath: string;
};

export async function uploadReceiptImageBase64(base64: string, mimeType: string): Promise<UploadedReceipt | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = sessionData.session?.user?.id;
  if (!userId) return null;

  const id = uuid();
  const extension = extensionFromMimeType(mimeType);
  const storagePath = `${userId}/${id}.${extension}`;
  const bytes = base64ToUint8Array(base64);

  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(storagePath, bytes.buffer as ArrayBuffer, {
      contentType: mimeType || "image/jpeg",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from("receipts").insert({
    id,
    user_id: userId,
    storage_path: storagePath,
    mime_type: mimeType || "image/jpeg",
  });
  if (insertError) throw insertError;

  return { id, storagePath };
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  return "jpg";
}

function base64ToUint8Array(base64: string) {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
