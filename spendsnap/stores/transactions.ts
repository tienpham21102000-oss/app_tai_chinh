import { create } from "zustand";

import {
  ensureDbReady,
  insertTransaction,
  listTransactions,
  deleteTransaction as deleteDbTransaction,
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
  deleteTransaction: (id: string) => Promise<void>;
  resetAll: () => Promise<void>;
};

export const useTransactionsStore = create<State>((set, get) => ({
  transactions: [],

  refreshAll: async () => {
    await ensureDbReady();
    const rows = await listTransactions();
    const nowIso = new Date().toISOString();
    set({
      transactions: rows.map((r) => {
        let finalDate = r.date ?? r.created_at ?? nowIso;
        if (
          !finalDate ||
          finalDate === "null" ||
          finalDate === "undefined" ||
          isNaN(new Date(finalDate).getTime())
        ) {
          finalDate = r.created_at && !isNaN(new Date(r.created_at).getTime()) ? r.created_at : nowIso;
        }

        return {
          id: r.id,
          amount: r.amount,
          category: r.category,
          merchant: r.merchant,
          date: finalDate,
          note: r.note,
          created_at: r.created_at ?? nowIso,
          raw_text: r.raw_text,
          source: r.source,
          synced: r.synced,
        };
      }),
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

  deleteTransaction: async (id) => {
    await ensureDbReady();
    await deleteDbTransaction(id);
    await get().refreshAll();
  },

  resetAll: async () => {
    await ensureDbReady();
    await resetLocalDatabase();
    set({ transactions: [] });
  },
}));
