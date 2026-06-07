import {
  ensureDbReady,
  clearPendingTransactionDeletions,
  getSetting,
  listCategories,
  listPendingTransactionDeletions,
  listSettings,
  listTransactions,
  listUnsyncedTransactions,
  markTransactionsSynced,
  setSetting,
  upsertCategory,
  upsertTransaction,
  type DbCategoryRow,
  type DbTransactionRow,
} from "./db";
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
  receipt_id: string | null;
  updated_at: string | null;
};

const TABLE = "transactions";
const CATEGORY_TABLE = "categories";
const SETTINGS_TABLE = "user_settings";

async function ensureSessionUserId(): Promise<string> {
  const supabase = getSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session?.user?.id) return sessionData.session.user.id;
  throw new Error("You must sign in before syncing data.");
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
    receipt_id: r.receipt_id,
    synced: 1,
  };
}

export async function syncTransactionsToSupabase(): Promise<{ pushed: number; pulled: number }> {
  await ensureDbReady();
  const supabase = getSupabaseClient();
  const userId = await ensureSessionUserId();

  // 1) Replay local deletes before pulling, otherwise deleted remote rows can reappear locally.
  const pendingDeletes = await listPendingTransactionDeletions();
  if (pendingDeletes.length > 0) {
    const { error: deleteError } = await supabase
      .from(TABLE)
      .delete()
      .eq("user_id", userId)
      .in("id", pendingDeletes);
    if (deleteError) throw deleteError;
    await clearPendingTransactionDeletions(pendingDeletes);
  }

  // 2) Push local unsynced rows before pulling to avoid cloud rows overwriting offline edits.
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
      receipt_id: t.receipt_id ?? null,
      updated_at: nowIso,
    }));

    const { error: pushError } = await supabase.from(TABLE).upsert(payload, { onConflict: "id" });
    if (pushError) throw pushError;

    await markTransactionsSynced(unsynced.map((t) => t.id));
  }

  // 3) Pull remote and upsert locally
  const { data: remote, error: pullError } = await supabase
    .from(TABLE)
    .select(
      "id,user_id,amount,category,merchant,date,note,created_at,raw_text,source,receipt_id,updated_at"
    )
    .eq("user_id", userId);

  if (pullError) throw pullError;

  const remoteRows = (remote ?? []) as RemoteTransactionRow[];
  for (const r of remoteRows) {
    await upsertTransaction(toLocalDbRow(r));
  }

  // 4) Refresh local listing (ensures any missing sync flags are up-to-date)
  // This is intentionally a lightweight pass: we already pulled/pushed.
  await listTransactions();
  await syncCategories(supabase, userId);
  await syncSettings(supabase, userId);

  return { pushed: unsynced.length, pulled: remoteRows.length };
}

async function syncCategories(supabase: ReturnType<typeof getSupabaseClient>, userId: string) {
  const { data: remote, error: pullError } = await supabase
    .from(CATEGORY_TABLE)
    .select("id,user_id,name,icon,color,sort_order,deleted_at,updated_at")
    .eq("user_id", userId)
    .is("deleted_at", null);
  if (pullError) throw pullError;

  for (const row of remote ?? []) {
    await upsertCategory({
      id: String(row.id),
      name: row.name ?? null,
      icon: row.icon ?? null,
      color: row.color ?? null,
      budget_monthly: 0,
    } satisfies DbCategoryRow);
  }

  const local = await listCategories();
  const payload = local.map((c, index) => ({
    id: c.id,
    user_id: userId,
    name: c.name ?? "Unnamed",
    icon: c.icon,
    color: c.color,
    sort_order: index,
    updated_at: new Date().toISOString(),
  }));
  if (payload.length > 0) {
    const { error: pushError } = await supabase
      .from(CATEGORY_TABLE)
      .upsert(payload, { onConflict: "user_id,id" });
    if (pushError) throw pushError;
  }
}

async function syncSettings(supabase: ReturnType<typeof getSupabaseClient>, userId: string) {
  const { data: remote, error: pullError } = await supabase
    .from(SETTINGS_TABLE)
    .select("key,value,updated_at")
    .eq("user_id", userId);
  if (pullError) throw pullError;

  for (const row of remote ?? []) {
    if (typeof row.key === "string") await setSetting(row.key, row.value ?? "");
  }

  const local = await listSettings();
  const payload = local
    .filter((s) => !s.key.startsWith("mock_"))
    .map((s) => ({
      user_id: userId,
      key: s.key,
      value: s.value,
      updated_at: new Date().toISOString(),
    }));
  if (payload.length > 0) {
    const { error: pushError } = await supabase
      .from(SETTINGS_TABLE)
      .upsert(payload, { onConflict: "user_id,key" });
    if (pushError) throw pushError;
  }
}

export async function isSupabaseSyncEnabled(): Promise<boolean> {
  await ensureDbReady();
  const enabled = await getSetting("supabase_sync_enabled");
  return enabled !== "0" && isSupabaseConfigured();
}

export async function syncTransactionsToSupabaseIfEnabled(): Promise<{ pushed: number; pulled: number } | null> {
  if (!(await isSupabaseSyncEnabled())) {
    return null;
  }

  return await syncTransactionsToSupabase();
}

export async function deleteTransactionFromSupabaseIfEnabled(id: string): Promise<void> {
  if (!(await isSupabaseSyncEnabled())) return;
  const supabase = getSupabaseClient();
  const userId = await ensureSessionUserId();
  const { error } = await supabase.from(TABLE).delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
  await clearPendingTransactionDeletions([id]);
}

export async function deleteCategoryFromSupabaseIfEnabled(id: string): Promise<void> {
  if (!(await isSupabaseSyncEnabled())) return;
  const supabase = getSupabaseClient();
  const userId = await ensureSessionUserId();
  const { error } = await supabase.from(CATEGORY_TABLE).delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function replaceCategoriesInSupabaseIfEnabled(): Promise<void> {
  if (!(await isSupabaseSyncEnabled())) return;
  const supabase = getSupabaseClient();
  const userId = await ensureSessionUserId();
  const local = await listCategories();
  const localIds = local.map((category) => category.id);

  if (localIds.length > 0) {
    const { error: deleteMissingError } = await supabase
      .from(CATEGORY_TABLE)
      .delete()
      .eq("user_id", userId)
      .not("id", "in", `(${localIds.map((id) => `"${id}"`).join(",")})`);
    if (deleteMissingError) throw deleteMissingError;
  } else {
    const { error: deleteAllError } = await supabase.from(CATEGORY_TABLE).delete().eq("user_id", userId);
    if (deleteAllError) throw deleteAllError;
  }

  const payload = local.map((c, index) => ({
    id: c.id,
    user_id: userId,
    name: c.name ?? "Unnamed",
    icon: c.icon,
    color: c.color,
    sort_order: index,
    updated_at: new Date().toISOString(),
  }));

  if (payload.length > 0) {
    const { error: upsertError } = await supabase.from(CATEGORY_TABLE).upsert(payload, { onConflict: "user_id,id" });
    if (upsertError) throw upsertError;
  }
}
