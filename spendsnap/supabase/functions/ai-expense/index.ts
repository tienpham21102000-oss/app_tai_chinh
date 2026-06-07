import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_CATEGORIES = ["Food", "Transport", "Shopping", "Housing", "Health", "Education", "Entertainment", "Family", "Work", "Investment", "Others"];
const FREE_DAILY_AI_LIMIT = 20;
const PREMIUM_DAILY_AI_LIMIT = 500;

type AiAction = "extract-text" | "scan-receipt" | "transcribe-audio" | "classify-category";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) throw new Error("OPENAI_API_KEY is not configured.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase function env is not configured.");

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ error: "Authentication required." }, 401);

    const body = await req.json();
    const action = String(body?.action ?? "") as AiAction;
    if (!isAiAction(action)) return json({ error: "Unsupported action." }, 400);

    const limitError = await getUsageLimitError(supabase, userData.user.id, action);
    if (limitError) return json(limitError, 429);

    let result: unknown;
    const language = String(body.language ?? "vi") === "en" ? "en" : "vi";
    if (action === "extract-text") {
      result = await extractText(openAiKey, String(body.text ?? ""), String(body.today ?? new Date().toISOString()), language);
    } else if (action === "scan-receipt") {
      result = await scanReceipt(
        openAiKey,
        String(body.imageBase64 ?? ""),
        String(body.mimeType ?? "image/jpeg"),
        String(body.today ?? new Date().toISOString()),
        language
      );
    } else if (action === "transcribe-audio") {
      result = await transcribeAudio(
        openAiKey,
        String(body.audioBase64 ?? ""),
        String(body.mimeType ?? "audio/m4a"),
        String(body.language ?? "vi")
      );
    } else {
      result = await classifyCategory(openAiKey, String(body.text ?? ""), language);
    }

    await logUsage(supabase, userData.user.id, action);
    return json(result);
  } catch (error) {
    console.error("[ai-expense]", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

function isAiAction(action: string): action is AiAction {
  return action === "extract-text" || action === "scan-receipt" || action === "transcribe-audio" || action === "classify-category";
}

async function getUsageLimitError(supabase: ReturnType<typeof createClient>, userId: string, action: AiAction) {
  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("status,current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (subscriptionError) {
    console.warn("[ai-expense] subscription check skipped:", subscriptionError.message);
  }

  const status = String(subscription?.status ?? "free");
  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end).getTime() : 0;
  const isPremium = status === "active" && (!periodEnd || periodEnd > Date.now());
  const limit = isPremium ? PREMIUM_DAILY_AI_LIMIT : FREE_DAILY_AI_LIMIT;

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());
  if (error) {
    console.warn("[ai-expense] usage limit check skipped:", error.message);
    return null;
  }
  if ((count ?? 0) >= limit) {
    return {
      error: isPremium
        ? "Daily AI limit reached. Please try again tomorrow."
        : "Free daily AI limit reached. Upgrade to Premium or try again tomorrow.",
      action,
    };
  }
  return null;
}

async function logUsage(supabase: ReturnType<typeof createClient>, userId: string, action: AiAction) {
  const { error } = await supabase.from("ai_usage").insert({
    user_id: userId,
    action,
    input_units: 1,
  });
  if (error) {
    console.warn("[ai-expense] usage log skipped:", error.message);
  }
}

async function extractText(openAiKey: string, text: string, today: string, language: "vi" | "en") {
  const responseLanguage = language === "vi" ? "Vietnamese" : "English";
  const system =
    "Extract structured expense data from Vietnamese or English text. " +
    `Use ${responseLanguage} for merchant and note when natural language is needed. ` +
    "Return JSON only with fields: amount number in VND, merchant string, category string, date ISO string, note string, confidence number 0..1. " +
    "Treat plain numbers without a unit as thousands of VND, so 200 means 200000. If amount is missing, use 0. " +
    `Category must be one of: ${VALID_CATEGORIES.join(", ")}.`;

  const content = await chatJson(openAiKey, [
    { role: "system", content: system },
    { role: "user", content: `Today: ${today}\nText: ${text}` },
  ]);
  return normalizeExpense(content);
}

async function classifyCategory(openAiKey: string, text: string, language: "vi" | "en") {
  const content = await chatJson(openAiKey, [
    {
      role: "system",
      content:
        `Classify this expense into exactly one category: ${VALID_CATEGORIES.join(", ")}. ` +
        `The user language is ${language === "vi" ? "Vietnamese" : "English"}, but category must still be one of the English keys. ` +
        "Return JSON only with field category.",
    },
    { role: "user", content: text },
  ]);
  const category = VALID_CATEGORIES.includes(String(content.category)) ? String(content.category) : "Others";
  return { category };
}

async function scanReceipt(openAiKey: string, imageBase64: string, mimeType: string, today: string, language: "vi" | "en") {
  if (!imageBase64) throw new Error("imageBase64 is required.");
  const responseLanguage = language === "vi" ? "Vietnamese" : "English";

  const system =
    "You are a receipt scanner for personal finance. Extract only accounting fields. " +
    "Do not output card digits, phone numbers, names, or addresses. " +
    `Use ${responseLanguage} for note. ` +
    "Return JSON only with fields: amount number in VND, merchant string, category string, date ISO string, note string, confidence number 0..1. " +
    "Use the final paid total. Treat plain numbers as VND unless the receipt clearly uses k/m/tr shorthand. " +
    `Category must be one of: ${VALID_CATEGORIES.join(", ")}.`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      max_tokens: 400,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: `Today: ${today}. Extract this receipt.` },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) throw new Error(`OpenAI receipt error ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const data = await resp.json();
  const parsed = safeJsonParse(data?.choices?.[0]?.message?.content ?? "{}");
  return normalizeExpense(parsed);
}

async function transcribeAudio(openAiKey: string, audioBase64: string, mimeType: string, language: string) {
  if (!audioBase64) throw new Error("audioBase64 is required.");
  const bytes = base64ToBytes(audioBase64);
  const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("ogg") ? "ogg" : "m4a";
  const form = new FormData();
  form.append("model", "whisper-1");
  form.append("language", language);
  form.append("file", new File([bytes], `recording.${ext}`, { type: mimeType }));

  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openAiKey}` },
    body: form,
  });

  if (!resp.ok) throw new Error(`OpenAI transcription error ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const data = await resp.json();
  return { text: String(data.text ?? "").trim() };
}

async function chatJson(openAiKey: string, messages: Array<{ role: string; content: string }>) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  if (!resp.ok) throw new Error(`OpenAI error ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const data = await resp.json();
  return safeJsonParse(data?.choices?.[0]?.message?.content ?? "{}");
}

function normalizeExpense(input: Record<string, unknown>) {
  const category = typeof input.category === "string" && VALID_CATEGORIES.includes(input.category)
    ? input.category
    : "Others";
  return {
    amount: Number(input.amount) || 0,
    merchant: typeof input.merchant === "string" ? input.merchant : undefined,
    category,
    date: typeof input.date === "string" ? input.date : undefined,
    note: typeof input.note === "string" ? input.note : undefined,
    confidence: typeof input.confidence === "number" ? input.confidence : undefined,
  };
}

function safeJsonParse(content: string): Record<string, unknown> {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(content.slice(start, end + 1));
    throw new Error("Model returned non-JSON content.");
  }
}

function base64ToBytes(base64: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
