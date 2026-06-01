import { create } from "zustand";

import { ensureDbReady, getSetting, setSetting } from "../services/db";

export type AppLanguage = "vi" | "en";

const LANGUAGE_KEY = "app_language";

type PreferencesState = {
  language: AppLanguage;
  loaded: boolean;
  loadLanguage: () => Promise<void>;
  setLanguage: (language: AppLanguage) => Promise<void>;
};

export const usePreferencesStore = create<PreferencesState>((set) => ({
  language: "vi",
  loaded: false,
  loadLanguage: async () => {
    await ensureDbReady();
    const value = await getSetting(LANGUAGE_KEY);
    set({ language: value === "en" ? "en" : "vi", loaded: true });
  },
  setLanguage: async (language) => {
    set({ language, loaded: true });
    await ensureDbReady();
    await setSetting(LANGUAGE_KEY, language);
  },
}));
