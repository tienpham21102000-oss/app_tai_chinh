import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

type AiAction = "extract-text" | "scan-receipt" | "transcribe-audio" | "classify-category";

export async function invokeAiExpense<T>(action: AiAction, payload: Record<string, unknown>): Promise<T> {
  const language = payload.language === "en" ? "en" : "vi";
  if (!isSupabaseConfigured()) {
    throw new Error(language === "vi" ? "AI cần cấu hình Supabase backend." : "Supabase is not configured. AI requires a production backend.");
  }

  const supabase = getSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) {
    throw new Error(language === "vi" ? "Vui lòng đăng nhập trước khi dùng tính năng AI." : "Please sign in before using AI features.");
  }

  const { data, error } = await supabase.functions.invoke("ai-expense", {
    body: { action, ...payload },
  });

  if (error) {
    throw new Error(await extractFunctionErrorMessage(error, language));
  }
  return data as T;
}

async function extractFunctionErrorMessage(error: unknown, language: "vi" | "en") {
  const fallback = error instanceof Error ? error.message : "AI backend request failed.";
  if (isNetworkLikeError(fallback)) {
    return language === "vi"
      ? "Không có internet hoặc không kết nối được AI backend. AI Voice và AI Camera cần mạng; bạn vẫn có thể nhập bằng AI Note."
      : "No internet connection or AI backend is unreachable. AI Voice and AI Camera require internet; you can still use AI Note.";
  }
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

function isNetworkLikeError(message: string) {
  return /failed to send|network|fetch|timeout|offline|internet|edge function/i.test(message);
}
