import { ScrollView, Text, View, Pressable, Switch, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";

import { ensureDbReady, getSetting, setSetting } from "../../services/db";
import { isSupabaseConfigured } from "../../services/supabase";
import { syncTransactionsToSupabase } from "../../services/sync";
import { useTransactionsStore } from "../../stores/transactions";
import { formatMoneyVnd } from "../../utils/money";

const BUDGET_KEY = "monthly_budget_vnd";
const SYNC_ENABLED_KEY = "supabase_sync_enabled";
const DEFAULT_BUDGET = 5_000_000;

export default function SettingsScreen() {
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const resetAll = useTransactionsStore((s) => s.resetAll);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(DEFAULT_BUDGET);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          await ensureDbReady();
          const v = await getSetting(BUDGET_KEY);
          const n = v ? Number(v) : DEFAULT_BUDGET;
          const sync = await getSetting(SYNC_ENABLED_KEY);
          if (!active) return;
          setMonthlyBudget(Number.isFinite(n) ? n : DEFAULT_BUDGET);
          setSyncEnabled(sync === "1");
        } catch {
          // ignore
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const handleToggleSync = async (next: boolean) => {
    if (next && !isSupabaseConfigured()) {
      Alert.alert(
        "Supabase not configured",
        "Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env, then restart Expo."
      );
      return;
    }

    setSyncEnabled(next);
    try {
      await ensureDbReady();
      await setSetting(SYNC_ENABLED_KEY, next ? "1" : "0");
      if (next) {
        const result = await syncTransactionsToSupabase();
        Alert.alert("Synced", `Pushed: ${result.pushed}, Pulled: ${result.pulled}`);
      }
    } catch (e) {
      setSyncEnabled(false);
      await setSetting(SYNC_ENABLED_KEY, "0").catch(() => {});
      Alert.alert("Sync failed", e instanceof Error ? e.message : "Unknown error");
    }
  };

  const handleResetData = () => {
    Alert.alert(
      "Confirm Reset",
      "Are you sure you want to delete all transaction data? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              await resetAll();
              Alert.alert("Done", "Local database has been reset.");
            } catch (e) {
              Alert.alert("Reset failed", e instanceof Error ? e.message : "Unknown error");
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView className="flex-1 bg-[#f8fafc] px-4 pt-14" showsVerticalScrollIndicator={false}>
      {/* Title */}
      <Text className="text-2xl font-bold text-slate-900 mb-6">Settings</Text>

      {/* Profile Card */}
      <View className="flex-row items-center bg-white border border-slate-100 rounded-3xl p-5 shadow-sm mb-6">
        <View className="w-14 h-14 rounded-full bg-indigo-500 items-center justify-center shadow-md">
          <Text className="text-white text-xl font-bold">U</Text>
        </View>
        <View className="ml-4 flex-1">
          <Text className="text-base font-bold text-slate-800">User Account</Text>
          <Text className="text-xs text-slate-400 font-semibold">Tier: SpendSnap Pro 🚀</Text>
        </View>
        <Pressable className="bg-indigo-50 px-3.5 py-2 rounded-2xl active:scale-95">
          <Text className="text-xs font-bold text-indigo-600">Edit</Text>
        </Pressable>
      </View>

      {/* Settings Sections */}
      <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Preferences</Text>
      <View className="bg-white border border-slate-100 rounded-3xl overflow-hidden mb-6 shadow-sm">
        {/* Sync Settings */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-50">
          <View className="flex-row items-center gap-3.5">
            <View className="w-9 h-9 rounded-xl bg-sky-50 items-center justify-center">
              <Ionicons name="cloud-upload-outline" size={18} color="#0284c7" />
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-800">Supabase Cloud Sync</Text>
              <Text className="text-[10px] text-slate-400 font-medium">Backup new transactions automatically and keep local entries in sync</Text>
            </View>
          </View>
          <Switch
            value={syncEnabled}
            onValueChange={handleToggleSync}
            trackColor={{ false: "#e2e8f0", true: "#818cf8" }}
            thumbColor={syncEnabled ? "#6366f1" : "#f4f4f5"}
          />
        </View>

        {/* Notifications */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-50">
          <View className="flex-row items-center gap-3.5">
            <View className="w-9 h-9 rounded-xl bg-indigo-50 items-center justify-center">
              <Ionicons name="notifications-outline" size={18} color="#4f46e5" />
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-800">Daily Reminders</Text>
              <Text className="text-[10px] text-slate-400 font-medium">Alert me to record my expenses</Text>
            </View>
          </View>
          <Switch
            value={notifyEnabled}
            onValueChange={setNotifyEnabled}
            trackColor={{ false: "#e2e8f0", true: "#818cf8" }}
            thumbColor={notifyEnabled ? "#6366f1" : "#f4f4f5"}
          />
        </View>

        {/* Currency Setting */}
        <Pressable className="flex-row items-center justify-between px-5 py-4 border-b border-slate-50 active:bg-slate-50">
          <View className="flex-row items-center gap-3.5">
            <View className="w-9 h-9 rounded-xl bg-amber-50 items-center justify-center">
              <Ionicons name="cash-outline" size={18} color="#d97706" />
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-800">Default Currency</Text>
              <Text className="text-[10px] text-slate-400 font-medium">Vietnamese Dong (VND - ₫)</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
        </Pressable>

        {/* Budget Setting */}
        <Pressable
          onPress={() => router.push("/budget")}
          className="flex-row items-center justify-between px-5 py-4 border-b border-slate-50 active:bg-slate-50"
        >
          <View className="flex-row items-center gap-3.5">
            <View className="w-9 h-9 rounded-xl bg-emerald-50 items-center justify-center">
              <Ionicons name="calculator-outline" size={18} color="#059669" />
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-800">Monthly Budget Goal</Text>
              <Text className="text-[10px] text-slate-400 font-medium">
                Set to: {formatMoneyVnd(monthlyBudget)}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
        </Pressable>

        {/* Categories */}
        <Pressable
          onPress={() => router.push("/categories")}
          className="flex-row items-center justify-between px-5 py-4 active:bg-slate-50"
        >
          <View className="flex-row items-center gap-3.5">
            <View className="w-9 h-9 rounded-xl bg-violet-50 items-center justify-center">
              <Ionicons name="pricetags-outline" size={18} color="#7c3aed" />
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-800">Categories</Text>
              <Text className="text-[10px] text-slate-400 font-medium">Manage labels, icons, and budgets</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
        </Pressable>
      </View>

      <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Security & Maintenance</Text>
      <View className="bg-white border border-slate-100 rounded-3xl overflow-hidden mb-6 shadow-sm">
        {/* API Key Status */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-50">
          <View className="flex-row items-center gap-3.5">
            <View className="w-9 h-9 rounded-xl bg-violet-50 items-center justify-center">
              <Ionicons name="key-outline" size={18} color="#7c3aed" />
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-800">OpenAI API Connection</Text>
              <Text className="text-[10px] text-emerald-500 font-bold uppercase">CONNECTED & LIVE ✨</Text>
            </View>
          </View>
        </View>

        {/* Reset App Data */}
        <Pressable onPress={handleResetData} className="flex-row items-center justify-between px-5 py-4 active:bg-slate-50">
          <View className="flex-row items-center gap-3.5">
            <View className="w-9 h-9 rounded-xl bg-rose-50 items-center justify-center">
              <Ionicons name="trash-outline" size={18} color="#e11d48" />
            </View>
            <View>
              <Text className="text-sm font-bold text-rose-600">Reset Local Database</Text>
              <Text className="text-[10px] text-slate-400 font-medium">Wipe all logged cash transaction history</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
        </Pressable>
      </View>

      {/* App Info footer */}
      <View className="items-center mt-4 mb-16">
        <Text className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">SpendSnap v1.0.0</Text>
        <Text className="text-[9px] text-slate-400 font-medium mt-1">Made with ❤️ by Google Deepmind AI Team</Text>
      </View>
    </ScrollView>
  );
}
