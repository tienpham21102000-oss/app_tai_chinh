import { create } from "zustand";

import {
  ensureDbReady,
  insertTransaction,
  listTransactions,
  deleteTransaction as deleteDbTransaction,
  upsertTransaction,
  resetLocalDatabase,
} from "../services/db";
import { syncTransactionsToSupabaseIfEnabled } from "../services/sync";
import { uuid } from "../utils/uuid";

export type Transaction = {
  id: string;
  amount: number;
  category?: string | null;
  merchant?: string | null;
  date: string;
  note?: string | null;
  created_at: string;
  raw_text?: string | null;
  source?: string | null;
  synced?: number | null;
};

type Draft = {
  amount: number;
  category?: string;
  merchant?: string;
  date?: string;
  note?: string;
  raw_text?: string;
  source?: string;
};

type State = {
  transactions: Transaction[];
  refreshAll: () => Promise<void>;
  refreshToday: () => Promise<void>;
  addFromDraft: (draft: Draft) => Promise<void>;
  updateFromDraft: (id: string, draft: Draft & { created_at?: string }) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  resetAll: () => Promise<void>;
  seedDummyTransactions: (transactions: Transaction[]) => void;
};

export const useTransactionsStore = create<State>((set, get) => ({
  transactions: [],

  refreshAll: async () => {
    await ensureDbReady();
    const rows = await listTransactions();
    set({
      transactions: rows.map((row) => ({
        id: row.id,
        amount: Number(row.amount ?? 0),
        category: row.category,
        merchant: row.merchant,
        date: row.date ?? row.created_at ?? new Date().toISOString(),
        note: row.note,
        created_at: row.created_at ?? new Date().toISOString(),
        raw_text: row.raw_text,
        source: row.source,
        synced: row.synced,
      })),
    });
  },

  refreshToday: async () => {
    await get().refreshAll();
  },

  addFromDraft: async (draft) => {
    await ensureDbReady();
    const nowIso = new Date().toISOString();
    const tx = {
      id: uuid(),
      amount: Math.max(0, Math.round(draft.amount)),
      category: draft.category ?? null,
      merchant: draft.merchant ?? null,
      date: draft.date ?? nowIso,
      note: draft.note ?? null,
      created_at: nowIso,
      raw_text: draft.raw_text ?? null,
      source: draft.source ?? "manual_text",
      synced: 0,
    };
    await insertTransaction(tx);
    await get().refreshAll();
    void syncTransactionsToSupabaseIfEnabled().catch((error) => {
      console.warn("Background Supabase sync failed:", error);
    });
  },

  updateFromDraft: async (id, draft) => {
    await ensureDbReady();
    const nowIso = new Date().toISOString();
    const existing = get().transactions.find((tx) => tx.id === id);
    const tx = {
      id,
      amount: Math.max(0, Math.round(draft.amount)),
      category: draft.category ?? null,
      merchant: draft.merchant ?? null,
      date: draft.date ?? existing?.date ?? nowIso,
      note: draft.note ?? null,
      created_at: draft.created_at ?? existing?.created_at ?? nowIso,
      raw_text: draft.raw_text ?? null,
      source: draft.source ?? existing?.source ?? "manual_text",
      synced: 0,
    };
    await upsertTransaction(tx);
    await get().refreshAll();
  },

  deleteTransaction: async (id) => {
    await ensureDbReady();
    await deleteDbTransaction(id);
    await get().refreshAll();
  },

  seedDummyTransactions: (transactions) => {
    set({ transactions });
  },

  resetAll: async () => {
    await ensureDbReady();
    await resetLocalDatabase();
    set({ transactions: [] });
  },
}));
