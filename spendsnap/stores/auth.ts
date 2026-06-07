import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";

import { getSupabaseClient, isSupabaseConfigured } from "../services/supabase";

WebBrowser.maybeCompleteAuthSession();

type AuthState = {
  initialized: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  error: string | null;
  initialize: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

function ensureConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.");
  }
}

function getCallbackParam(url: string, name: string): string | null {
  const queryStart = url.indexOf("?");
  const hashStart = url.indexOf("#");
  const chunks: string[] = [];

  if (queryStart >= 0) {
    const queryEnd = hashStart >= 0 && hashStart > queryStart ? hashStart : url.length;
    chunks.push(url.slice(queryStart + 1, queryEnd));
  }

  if (hashStart >= 0) {
    chunks.push(url.slice(hashStart + 1));
  }

  for (const chunk of chunks) {
    const params = new URLSearchParams(chunk);
    const value = params.get(name);
    if (value) return value;
  }

  return null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  initialized: false,
  loading: false,
  session: null,
  user: null,
  error: null,

  initialize: async () => {
    if (get().initialized) return;
    set({ loading: true, error: null });
    try {
      ensureConfigured();
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      set({
        session: data.session ?? null,
        user: data.session?.user ?? null,
        initialized: true,
        loading: false,
      });

      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null, initialized: true });
      });
    } catch (e) {
      set({
        initialized: true,
        loading: false,
        session: null,
        user: null,
        error: e instanceof Error ? e.message : "Authentication failed.",
      });
    }
  },

  signInWithEmail: async (email, password) => {
    set({ loading: true, error: null });
    try {
      ensureConfigured();
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      set({ session: data.session ?? null, user: data.user ?? data.session?.user ?? null, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Sign in failed." });
      throw e;
    }
  },

  signUpWithEmail: async (email, password) => {
    set({ loading: true, error: null });
    try {
      ensureConfigured();
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      set({ session: data.session ?? null, user: data.user ?? data.session?.user ?? null, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Sign up failed." });
      throw e;
    }
  },

  signInWithGoogle: async () => {
    set({ loading: true, error: null });
    try {
      ensureConfigured();
      const supabase = getSupabaseClient();
      const redirectTo = Linking.createURL("auth");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (!data.url) throw new Error("Google sign-in URL was not returned.");

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== "success" || !result.url) {
        throw new Error("Google sign-in was cancelled.");
      }

      const accessToken = getCallbackParam(result.url, "access_token");
      const refreshToken = getCallbackParam(result.url, "refresh_token");
      if (accessToken && refreshToken) {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) throw sessionError;
        set({
          session: sessionData.session ?? null,
          user: sessionData.session?.user ?? null,
          loading: false,
        });
        return;
      }

      const code = getCallbackParam(result.url, "code");
      if (code) {
        const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
        set({
          session: sessionData.session ?? null,
          user: sessionData.session?.user ?? null,
          loading: false,
        });
        return;
      }

      throw new Error("Google sign-in callback did not include a session.");
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Google sign-in failed." });
      throw e;
    }
  },

  signOut: async () => {
    set({ loading: true, error: null });
    try {
      ensureConfigured();
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      set({ session: null, user: null, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Sign out failed." });
      throw e;
    }
  },
}));
