import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

type AiAction = "extract-text" | "scan-receipt" | "transcribe-audio" | "classify-category";

export async function invokeAiExpense<T>(action: AiAction, payload: Record<string, unknown>): Promise<T> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. AI requires a production backend.");
  }

  const supabase = getSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) {
    throw new Error("Please sign in before using AI features.");
  }

  const { data, error } = await supabase.functions.invoke("ai-expense", {
    body: { action, ...payload },
  });

  if (error) {
    throw new Error(await extractFunctionErrorMessage(error));
  }
  return data as T;
}

async function extractFunctionErrorMessage(error: unknown) {
  const fallback = error instanceof Error ? error.message : "AI backend request failed.";
  const context = (error as { context?: unknown })?.context;

  if (context && typeof (context as Response).text === "function") {
    try {
      const text = await (context as Response).clone().text();
      if (text) {
        try {
          const parsed = JSON.parse(text) as { error?: string; message?: string; msg?: string };
          return parsed.error || parsed.message || parsed.msg || text;
        } catch {
          return text;
        }
      }
    } catch {
      // fall through
    }
  }

  return fallback;
}
