import { ensureDbReady, getSetting, listTransactions, listUnsyncedTransactions, markTransactionsSynced, upsertTransaction, type DbTransactionRow } from "./db";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

type RemoteTransactionRow = {
  id: string;
  user_id: string;
  amount: number;
  category: string | null;
  merchant: string | null;
  date: string | null;
  note: string | null;
  created_at: string | null;
  raw_text: string | null;
  source: string | null;
  updated_at: string | null;
};

const TABLE = "transactions";

async function ensureSessionUserId(): Promise<string> {
  const supabase = getSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session?.user?.id) return sessionData.session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  const userId = data.user?.id ?? data.session?.user?.id;
  if (!userId) throw new Error("Supabase: failed to create anonymous session.");
  return userId;
}

function toLocalDbRow(r: RemoteTransactionRow): DbTransactionRow {
  const nowIso = new Date().toISOString();
  return {
    id: r.id,
    amount: Number(r.amount) || 0,
    category: r.category,
    merchant: r.merchant,
    date: r.date ?? r.created_at ?? nowIso,
    note: r.note,
    created_at: r.created_at ?? r.date ?? nowIso,
    raw_text: r.raw_text,
    source: r.source,
    synced: 1,
  };
}

export async function syncTransactionsToSupabase(): Promise<{ pushed: number; pulled: number }> {
  await ensureDbReady();
  const supabase = getSupabaseClient();
  const userId = await ensureSessionUserId();

  // 1) Pull remote and upsert locally
  const { data: remote, error: pullError } = await supabase
    .from(TABLE)
    .select(
      "id,user_id,amount,category,merchant,date,note,created_at,raw_text,source,updated_at"
    )
    .eq("user_id", userId);

  if (pullError) throw pullError;

  const remoteRows = (remote ?? []) as RemoteTransactionRow[];
  for (const r of remoteRows) {
    await upsertTransaction(toLocalDbRow(r));
  }

  // 2) Push local unsynced
  const unsynced = await listUnsyncedTransactions();
  if (unsynced.length > 0) {
    const nowIso = new Date().toISOString();
    const payload = unsynced.map((t) => ({
      id: t.id,
      user_id: userId,
      amount: t.amount,
      category: t.category,
      merchant: t.merchant,
      date: t.date,
      note: t.note,
      created_at: t.created_at,
      raw_text: t.raw_text,
      source: t.source,
      updated_at: nowIso,
    }));

    const { error: pushError } = await supabase.from(TABLE).upsert(payload, { onConflict: "id" });
    if (pushError) throw pushError;

    await markTransactionsSynced(unsynced.map((t) => t.id));
  }

  // 3) Refresh local listing (ensures any missing sync flags are up-to-date)
  // This is intentionally a lightweight pass: we already pulled/pushed.
  await listTransactions();

  return { pushed: unsynced.length, pulled: remoteRows.length };
}

export async function isSupabaseSyncEnabled(): Promise<boolean> {
  await ensureDbReady();
  const enabled = await getSetting("supabase_sync_enabled");
  return enabled === "1" && isSupabaseConfigured();
}

export async function syncTransactionsToSupabaseIfEnabled(): Promise<{ pushed: number; pulled: number } | null> {
  if (!(await isSupabaseSyncEnabled())) {
    return null;
  }

  return await syncTransactionsToSupabase();
}

