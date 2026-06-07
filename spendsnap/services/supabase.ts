import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

type SupabaseConfig = {
  url: string;
  anonKey: string;
};

function getSupabaseConfig(): SupabaseConfig | null {
  const fromExtra = (Constants.expoConfig as any)?.extra ?? {};
  const url =
    (process.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined) ??
    (fromExtra.supabaseUrl as string | undefined) ??
    null;
  const anonKey =
    (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ??
    (fromExtra.supabaseAnonKey as string | undefined) ??
    null;

  if (!url || !anonKey) return null;
  return { url, anonKey };
}

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return !!getSupabaseConfig();
}

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const cfg = getSupabaseConfig();
  if (!cfg) {
    throw new Error("Missing Supabase config. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.");
  }

  client = createClient(cfg.url, cfg.anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
