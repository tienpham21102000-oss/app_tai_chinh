import { create } from "zustand";

export type AddMode = "voice" | "camera" | "text";

export type AddIntent = {
  mode: AddMode;
  raw?: string;
  editTransaction?: {
    id: string;
    amount: number;
    category?: string | null;
    merchant?: string | null;
    date?: string | null;
    note?: string | null;
    raw_text?: string | null;
    source?: string | null;
    receipt_id?: string | null;
    created_at?: string | null;
  };
};

type State = {
  intent: AddIntent | null;
  setIntent: (intent: AddIntent) => void;
  clearIntent: () => void;
};

export const useAddIntentStore = create<State>((set) => ({
  intent: null,
  setIntent: (intent) => set({ intent }),
  clearIntent: () => set({ intent: null }),
}));
