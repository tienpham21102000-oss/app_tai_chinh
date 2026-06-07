import { Platform } from "react-native";
import { MOCK_TRANSACTIONS } from "../utils/mockData";

type SQLiteDatabase = any;
let dbPromise: Promise<SQLiteDatabase> | null = null;

async function getDb() {
  if (Platform.OS === "web") {
    throw new Error("SQLite is not used on web.");
  }
  if (!dbPromise) {
    const SQLite = require("expo-sqlite") as typeof import("expo-sqlite");
    dbPromise = SQLite.openDatabaseAsync("spendsnap.db");
  }
  return dbPromise;
}

const WEB_KEYS = {
  transactions: "spendsnap_web_transactions_v1",
  categories: "spendsnap_web_categories_v1",
  settings: "spendsnap_web_settings_v1",
  transactionDeletes: "spendsnap_web_transaction_deletes_v1",
};

const MOCK_SEED_KEY = "mock_seed_version";
const MOCK_SEED_VERSION = "fixed_2022_2026_v1";
const CATEGORY_SEED_KEY = "default_categories_seeded";
const CATEGORY_DEFAULT_VERSION_KEY = "default_categories_version";
const CATEGORY_DEFAULT_VERSION = "expense_categories_v2";
const SHOULD_SEED_DEMO = process.env.EXPO_PUBLIC_SEED_DEMO_DATA === "1";

const DEFAULT_CATEGORY_BY_ID = {
  food: { name: "Food", icon: "\u{1f35c}", color: "#f97316" },
  transport: { name: "Transport", icon: "\u{1f6f5}", color: "#0ea5e9" },
  shopping: { name: "Shopping", icon: "\u{1f6cd}\u{fe0f}", color: "#a855f7" },
  housing: { name: "Housing", icon: "\u{1f3e0}", color: "#10b981" },
  health: { name: "Health", icon: "\u{1f48a}", color: "#f43f5e" },
  education: { name: "Education", icon: "\u{1f4da}", color: "#3b82f6" },
  entertainment: { name: "Entertainment", icon: "\u{1f3ac}", color: "#ec4899" },
  family: { name: "Family", icon: "\u{1f46a}", color: "#f59e0b" },
  work: { name: "Work", icon: "\u{1f4bc}", color: "#6366f1" },
  investment: { name: "Investment", icon: "\u{1f4c8}", color: "#84cc16" },
  others: { name: "Others", icon: "\u{1f4cc}", color: "#64748b" },
} satisfies Record<string, { name: string; icon: string; color: string }>;

const LEGACY_DEFAULT_CATEGORY_IDS = new Set(["food", "drinks", "transport", "shopping", "entertainment", "bills", "others"]);

export const DEFAULT_CATEGORIES: Array<{
  id: string;
  name: string;
  icon: string;
  color: string;
  budget_monthly: number;
}> = Object.entries(DEFAULT_CATEGORY_BY_ID).map(([id, value]) => ({
  id,
  name: value.name,
  icon: value.icon,
  color: value.color,
  budget_monthly: 0,
}));

function isOnlyKnownDefaultCategories(rows: Array<{ id?: string | null }>) {
  const nextIds = new Set(DEFAULT_CATEGORIES.map((category) => category.id));
  return rows.length > 0 && rows.every((row) => {
    const id = String(row.id ?? "");
    return nextIds.has(id) || LEGACY_DEFAULT_CATEGORY_IDS.has(id);
  });
}

function webReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis?.localStorage?.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function webWriteJson(key: string, value: unknown) {
  globalThis?.localStorage?.setItem(key, JSON.stringify(value));
}

export async function ensureDbReady() {
  if (Platform.OS === "web") {
    const existing = webReadJson<DbCategoryRow[]>(WEB_KEYS.categories, []);
    const settings = webReadJson<Record<string, string>>(WEB_KEYS.settings, {});
    const shouldUpgradeDefaults = settings?.[CATEGORY_DEFAULT_VERSION_KEY] !== CATEGORY_DEFAULT_VERSION && isOnlyKnownDefaultCategories(existing);
    if ((existing.length === 0 && settings?.[CATEGORY_SEED_KEY] !== "1") || shouldUpgradeDefaults) {
      webWriteJson(
        WEB_KEYS.categories,
        DEFAULT_CATEGORIES.map((c) => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          color: c.color,
          budget_monthly: c.budget_monthly,
        } satisfies DbCategoryRow))
      );
      webWriteJson(WEB_KEYS.settings, { ...(settings ?? {}), [CATEGORY_SEED_KEY]: "1", [CATEGORY_DEFAULT_VERSION_KEY]: CATEGORY_DEFAULT_VERSION });
    }
    // Ensure keys exist
    if (!settings || typeof settings !== "object") webWriteJson(WEB_KEYS.settings, {});
    const tx = webReadJson<DbTransactionRow[]>(WEB_KEYS.transactions, []);
    if (!Array.isArray(tx)) {
      webWriteJson(WEB_KEYS.transactions, []);
    } else if (SHOULD_SEED_DEMO && !tx.some((row) => row.source === "demo") && settings?.[MOCK_SEED_KEY] !== MOCK_SEED_VERSION) {
      webWriteJson(WEB_KEYS.transactions, [...tx, ...MOCK_TRANSACTIONS]);
      webWriteJson(WEB_KEYS.settings, { ...(settings ?? {}), [MOCK_SEED_KEY]: MOCK_SEED_VERSION });
    }
    const deletes = webReadJson<Array<{ id: string; created_at: string }>>(WEB_KEYS.transactionDeletes, []);
    if (!Array.isArray(deletes)) webWriteJson(WEB_KEYS.transactionDeletes, []);
    return;
  }

  const db = await getDb();
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await db.execAsync("PRAGMA foreign_keys = ON;");

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      amount INTEGER NOT NULL,
      category TEXT,
      merchant TEXT,
      date TEXT,
      note TEXT,
      created_at TEXT,
      raw_text TEXT,
      source TEXT,
      receipt_id TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
  `);

  try {
    await db.execAsync("ALTER TABLE transactions ADD COLUMN receipt_id TEXT;");
  } catch {}

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT,
      icon TEXT,
      color TEXT,
      budget_monthly INTEGER
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_transaction_deletions (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );
  `);

  const categorySeeded = await getSetting(CATEGORY_SEED_KEY);
  const categoryDefaultVersion = await getSetting(CATEGORY_DEFAULT_VERSION_KEY);
  const existingCategories = (await db.getAllAsync("SELECT id FROM categories")) as Array<{ id: string }>;
  const shouldUpgradeDefaults = categoryDefaultVersion !== CATEGORY_DEFAULT_VERSION && isOnlyKnownDefaultCategories(existingCategories);
  if (categorySeeded !== "1" || shouldUpgradeDefaults) {
    if (shouldUpgradeDefaults) {
      await db.execAsync("DELETE FROM categories;");
    }
    for (const c of DEFAULT_CATEGORIES) {
      await db.runAsync(
        "INSERT OR IGNORE INTO categories (id, name, icon, color, budget_monthly) VALUES (?, ?, ?, ?, ?)",
        c.id,
        c.name,
        c.icon,
        c.color,
        c.budget_monthly
      );
    }
    await setSetting(CATEGORY_SEED_KEY, "1");
    await setSetting(CATEGORY_DEFAULT_VERSION_KEY, CATEGORY_DEFAULT_VERSION);
  }

  const countRow = (await db.getFirstAsync("SELECT COUNT(*) AS count FROM transactions WHERE source = 'demo'")) as { count?: number } | null;
  const seedVersion = await getSetting(MOCK_SEED_KEY);
  if (SHOULD_SEED_DEMO && (countRow?.count ?? 0) === 0 && seedVersion !== MOCK_SEED_VERSION) {
    await db.execAsync("BEGIN;");
    try {
      for (const tx of MOCK_TRANSACTIONS) {
        await db.runAsync(
          `INSERT OR IGNORE INTO transactions (id, amount, category, merchant, date, note, created_at, raw_text, source, synced)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          tx.id,
          tx.amount,
          tx.category ?? null,
          tx.merchant ?? null,
          tx.date,
          tx.note ?? null,
          tx.created_at,
          tx.raw_text ?? null,
          tx.source ?? "demo",
          tx.synced ?? 1
        );
      }
      await db.runAsync(
        `INSERT INTO app_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
        MOCK_SEED_KEY,
        MOCK_SEED_VERSION
      );
      await db.execAsync("COMMIT;");
    } catch (e) {
      await db.execAsync("ROLLBACK;");
      throw e;
    }
  }
}

export type DbTransactionRow = {
  id: string;
  amount: number;
  category: string | null;
  merchant: string | null;
  date: string | null;
  note: string | null;
  created_at: string | null;
  raw_text: string | null;
  source: string | null;
  receipt_id?: string | null;
  synced: number | null;
};

export async function listTransactions(): Promise<DbTransactionRow[]> {
  if (Platform.OS === "web") {
    const rows = webReadJson<DbTransactionRow[]>(WEB_KEYS.transactions, []);
    return [...rows].sort((a, b) => {
      const da = new Date(a.date ?? a.created_at ?? 0).getTime();
      const dbt = new Date(b.date ?? b.created_at ?? 0).getTime();
      return dbt - da;
    });
  }
  const db = await getDb();
  return (await db.getAllAsync("SELECT * FROM transactions ORDER BY date DESC, created_at DESC")) as DbTransactionRow[];
}

export async function listTransactionsSince(isoDateStart: string): Promise<DbTransactionRow[]> {
  if (Platform.OS === "web") {
    const start = new Date(isoDateStart).getTime();
    const all = await listTransactions();
    return all.filter((r) => {
      const t = new Date(r.date ?? r.created_at ?? 0).getTime();
      return Number.isFinite(t) && t >= start;
    });
  }
  const db = await getDb();
  return (await db.getAllAsync(
    "SELECT * FROM transactions WHERE date >= ? ORDER BY date DESC, created_at DESC",
    isoDateStart
  )) as DbTransactionRow[];
}

export async function insertTransaction(row: DbTransactionRow) {
  if (Platform.OS === "web") {
    const rows = webReadJson<DbTransactionRow[]>(WEB_KEYS.transactions, []);
    rows.push({ ...row, synced: row.synced ?? 0 });
    webWriteJson(WEB_KEYS.transactions, rows);
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO transactions (id, amount, category, merchant, date, note, created_at, raw_text, source, receipt_id, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.amount,
    row.category,
    row.merchant,
    row.date,
    row.note,
    row.created_at,
    row.raw_text,
    row.source,
    row.receipt_id ?? null,
    row.synced ?? 0
  );
}

export async function upsertTransaction(row: DbTransactionRow) {
  if (Platform.OS === "web") {
    const rows = webReadJson<DbTransactionRow[]>(WEB_KEYS.transactions, []);
    const idx = rows.findIndex((r) => r.id === row.id);
    if (idx >= 0) rows[idx] = { ...row, synced: row.synced ?? 0 };
    else rows.push({ ...row, synced: row.synced ?? 0 });
    webWriteJson(WEB_KEYS.transactions, rows);
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO transactions (id, amount, category, merchant, date, note, created_at, raw_text, source, receipt_id, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       amount=excluded.amount,
       category=excluded.category,
       merchant=excluded.merchant,
       date=excluded.date,
       note=excluded.note,
       created_at=excluded.created_at,
       raw_text=excluded.raw_text,
       source=excluded.source,
       receipt_id=excluded.receipt_id,
       synced=excluded.synced`,
    row.id,
    row.amount,
    row.category,
    row.merchant,
    row.date,
    row.note,
    row.created_at,
    row.raw_text,
    row.source,
    row.receipt_id ?? null,
    row.synced ?? 0
  );
}

export async function listUnsyncedTransactions(): Promise<DbTransactionRow[]> {
  if (Platform.OS === "web") {
    const rows = await listTransactions();
    return rows.filter((r) => (r.synced ?? 0) === 0);
  }
  const db = await getDb();
  return (await db.getAllAsync(
    "SELECT * FROM transactions WHERE (synced IS NULL OR synced = 0) ORDER BY date DESC, created_at DESC"
  )) as DbTransactionRow[];
}

export async function markTransactionsSynced(ids: string[]) {
  if (ids.length === 0) return;
  if (Platform.OS === "web") {
    const rows = webReadJson<DbTransactionRow[]>(WEB_KEYS.transactions, []);
    const idSet = new Set(ids);
    for (const r of rows) {
      if (idSet.has(r.id)) r.synced = 1;
    }
    webWriteJson(WEB_KEYS.transactions, rows);
    return;
  }
  const db = await getDb();
  const placeholders = ids.map(() => "?").join(",");
  await db.runAsync(`UPDATE transactions SET synced = 1 WHERE id IN (${placeholders})`, ...ids);
}

export async function deleteTransaction(id: string) {
  if (Platform.OS === "web") {
    const rows = webReadJson<DbTransactionRow[]>(WEB_KEYS.transactions, []);
    webWriteJson(
      WEB_KEYS.transactions,
      rows.filter((r) => r.id !== id)
    );
    const settings = webReadJson<Record<string, string>>(WEB_KEYS.settings, {});
    webWriteJson(WEB_KEYS.settings, { ...(settings ?? {}), [CATEGORY_SEED_KEY]: "1", [CATEGORY_DEFAULT_VERSION_KEY]: CATEGORY_DEFAULT_VERSION });
    return;
  }
  const db = await getDb();
  await db.runAsync("DELETE FROM transactions WHERE id = ?", id);
}

export async function queueTransactionDeletion(id: string) {
  const nowIso = new Date().toISOString();
  if (Platform.OS === "web") {
    const rows = webReadJson<Array<{ id: string; created_at: string }>>(WEB_KEYS.transactionDeletes, []);
    if (!rows.some((row) => row.id === id)) rows.push({ id, created_at: nowIso });
    webWriteJson(WEB_KEYS.transactionDeletes, rows);
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO pending_transaction_deletions (id, created_at)
     VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET created_at=excluded.created_at`,
    id,
    nowIso
  );
}

export async function listPendingTransactionDeletions(): Promise<string[]> {
  if (Platform.OS === "web") {
    return webReadJson<Array<{ id: string; created_at: string }>>(WEB_KEYS.transactionDeletes, []).map((row) => row.id);
  }
  const db = await getDb();
  const rows = (await db.getAllAsync("SELECT id FROM pending_transaction_deletions")) as Array<{ id: string }>;
  return rows.map((row) => row.id);
}

export async function clearPendingTransactionDeletions(ids: string[]) {
  if (ids.length === 0) return;
  if (Platform.OS === "web") {
    const idSet = new Set(ids);
    const rows = webReadJson<Array<{ id: string; created_at: string }>>(WEB_KEYS.transactionDeletes, []);
    webWriteJson(
      WEB_KEYS.transactionDeletes,
      rows.filter((row) => !idSet.has(row.id))
    );
    return;
  }
  const db = await getDb();
  const placeholders = ids.map(() => "?").join(",");
  await db.runAsync(`DELETE FROM pending_transaction_deletions WHERE id IN (${placeholders})`, ...ids);
}

export type DbCategoryRow = {
  id: string;
  name: string | null;
  icon: string | null;
  color: string | null;
  budget_monthly: number | null;
};

export async function listCategories(): Promise<DbCategoryRow[]> {
  if (Platform.OS === "web") {
    const rows = webReadJson<DbCategoryRow[]>(WEB_KEYS.categories, []);
    return [...rows].sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
  }
  const db = await getDb();
  return (await db.getAllAsync("SELECT * FROM categories ORDER BY name ASC")) as DbCategoryRow[];
}

export async function upsertCategory(row: DbCategoryRow) {
  if (Platform.OS === "web") {
    const rows = webReadJson<DbCategoryRow[]>(WEB_KEYS.categories, []);
    const idx = rows.findIndex((r) => r.id === row.id);
    const next = { ...row, budget_monthly: row.budget_monthly ?? 0 };
    if (idx >= 0) rows[idx] = next;
    else rows.push(next);
    webWriteJson(WEB_KEYS.categories, rows);
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO categories (id, name, icon, color, budget_monthly)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       icon=excluded.icon,
       color=excluded.color,
       budget_monthly=excluded.budget_monthly`,
    row.id,
    row.name,
    row.icon,
    row.color,
    row.budget_monthly ?? 0
  );
}

export async function deleteCategory(id: string) {
  if (Platform.OS === "web") {
    const rows = webReadJson<DbCategoryRow[]>(WEB_KEYS.categories, []);
    webWriteJson(
      WEB_KEYS.categories,
      rows.filter((r) => r.id !== id)
    );
    return;
  }
  const db = await getDb();
  await db.runAsync("DELETE FROM categories WHERE id = ?", id);
}

export async function restoreDefaultCategories() {
  if (Platform.OS === "web") {
    const settings = webReadJson<Record<string, string>>(WEB_KEYS.settings, {});
    webWriteJson(
      WEB_KEYS.categories,
      DEFAULT_CATEGORIES.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        budget_monthly: c.budget_monthly,
      } satisfies DbCategoryRow))
    );
    webWriteJson(WEB_KEYS.settings, { ...(settings ?? {}), [CATEGORY_SEED_KEY]: "1" });
    return;
  }
  const db = await getDb();
  await db.execAsync("DELETE FROM categories;");
  for (const c of DEFAULT_CATEGORIES) {
    await db.runAsync(
      "INSERT INTO categories (id, name, icon, color, budget_monthly) VALUES (?, ?, ?, ?, ?)",
      c.id,
      c.name,
      c.icon,
      c.color,
      c.budget_monthly
    );
  }
  await setSetting(CATEGORY_SEED_KEY, "1");
  await setSetting(CATEGORY_DEFAULT_VERSION_KEY, CATEGORY_DEFAULT_VERSION);
}

export async function getSetting(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    const settings = webReadJson<Record<string, string>>(WEB_KEYS.settings, {});
    return settings[key] ?? null;
  }
  const db = await getDb();
  const row = (await db.getFirstAsync("SELECT value FROM app_settings WHERE key = ?", key)) as
    | { value?: string | null }
    | null
    | undefined;
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  if (Platform.OS === "web") {
    const settings = webReadJson<Record<string, string>>(WEB_KEYS.settings, {});
    settings[key] = value;
    webWriteJson(WEB_KEYS.settings, settings);
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    key,
    value
  );
}

export async function listSettings(): Promise<Array<{ key: string; value: string | null }>> {
  if (Platform.OS === "web") {
    const settings = webReadJson<Record<string, string>>(WEB_KEYS.settings, {});
    return Object.entries(settings).map(([key, value]) => ({ key, value }));
  }
  const db = await getDb();
  return (await db.getAllAsync("SELECT key, value FROM app_settings")) as Array<{ key: string; value: string | null }>;
}

export async function resetLocalDatabase() {
  if (Platform.OS === "web") {
    webWriteJson(WEB_KEYS.transactions, []);
    webWriteJson(
      WEB_KEYS.categories,
      DEFAULT_CATEGORIES.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        budget_monthly: c.budget_monthly,
      } satisfies DbCategoryRow))
    );
    webWriteJson(WEB_KEYS.settings, { [CATEGORY_SEED_KEY]: "1", [CATEGORY_DEFAULT_VERSION_KEY]: CATEGORY_DEFAULT_VERSION });
    webWriteJson(WEB_KEYS.transactionDeletes, []);
    return;
  }
  const db = await getDb();
  await db.execAsync("BEGIN;");
  try {
    await db.execAsync("DELETE FROM transactions;");
    await db.execAsync("DELETE FROM pending_transaction_deletions;");
    await db.execAsync("DELETE FROM categories;");
    await db.execAsync("DELETE FROM app_settings;");
    await db.execAsync("COMMIT;");
  } catch (e) {
    await db.execAsync("ROLLBACK;");
    throw e;
  }
  // Re-seed defaults after wipe.
  for (const c of DEFAULT_CATEGORIES) {
    await db.runAsync(
      "INSERT INTO categories (id, name, icon, color, budget_monthly) VALUES (?, ?, ?, ?, ?)",
      c.id,
      c.name,
      c.icon,
      c.color,
      c.budget_monthly
    );
  }
  await setSetting(CATEGORY_SEED_KEY, "1");
  await setSetting(CATEGORY_DEFAULT_VERSION_KEY, CATEGORY_DEFAULT_VERSION);
}
