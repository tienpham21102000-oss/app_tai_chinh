import { create } from "zustand";

export type AddMode = "voice" | "camera" | "text";

export type AddIntent = {
  mode: AddMode;
  raw?: string;
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
