import { ScrollView, Text, View, Pressable, Switch, Alert, Modal, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";

import { ensureDbReady, getSetting, setSetting } from "../../services/db";
import { isSupabaseConfigured } from "../../services/supabase";
import { getSupabaseSyncStatus, syncTransactionsToSupabase, syncTransactionsToSupabaseIfEnabled } from "../../services/sync";
import { useAuthStore } from "../../stores/auth";
import { useTransactionsStore } from "../../stores/transactions";
import { usePreferencesStore } from "../../stores/preferences";
import { cancelDailyReminder, scheduleDailyReminder } from "../../services/reminders";
import { useI18n } from "../../utils/i18n";
import { formatMoneyVnd } from "../../utils/money";
import { DEFAULT_BUDGET, getBudgetForMonth } from "../../utils/budget";

const SYNC_ENABLED_KEY = "supabase_sync_enabled";
const DAILY_REMINDER_ENABLED_KEY = "daily_reminder_enabled";
const DAILY_REMINDER_TIME_KEY = "daily_reminder_time";

export default function SettingsScreen() {
  const { t, language } = useI18n();
  const setLanguage = usePreferencesStore((s) => s.setLanguage);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ unsynced: number; pendingDeletes: number }>({ unsynced: 0, pendingDeletes: 0 });
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState("20:00");
  const resetAll = useTransactionsStore((s) => s.resetAll);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(DEFAULT_BUDGET);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          await ensureDbReady();
          const n = await getBudgetForMonth(new Date());
          const sync = await getSetting(SYNC_ENABLED_KEY);
          const status = await getSupabaseSyncStatus();
          const notify = await getSetting(DAILY_REMINDER_ENABLED_KEY);
          const time = await getSetting(DAILY_REMINDER_TIME_KEY);
          if (!active) return;
          setMonthlyBudget(n);
          setSyncEnabled(sync !== "0" && isSupabaseConfigured());
          setSyncStatus({ unsynced: status.unsynced, pendingDeletes: status.pendingDeletes });
          setNotifyEnabled(notify !== "0");
          setReminderTime(time || "20:00");
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
        setSyncing(true);
        const result = await syncTransactionsToSupabase();
        const status = await getSupabaseSyncStatus();
        setSyncStatus({ unsynced: status.unsynced, pendingDeletes: status.pendingDeletes });
        Alert.alert(language === "vi" ? "Đã đồng bộ" : "Synced", `Pushed: ${result.pushed}, Pulled: ${result.pulled}`);
      }
    } catch (e) {
      setSyncEnabled(false);
      await setSetting(SYNC_ENABLED_KEY, "0").catch(() => {});
      Alert.alert(language === "vi" ? "Đồng bộ thất bại" : "Sync failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSyncing(false);
    }
  };

  const handleManualSync = async () => {
    if (!syncEnabled) return;
    setSyncing(true);
    try {
      const result = await syncTransactionsToSupabase();
      const status = await getSupabaseSyncStatus();
      setSyncStatus({ unsynced: status.unsynced, pendingDeletes: status.pendingDeletes });
      Alert.alert(language === "vi" ? "Đã đồng bộ" : "Synced", `Pushed: ${result.pushed}, Pulled: ${result.pulled}`);
    } catch (e) {
      Alert.alert(language === "vi" ? "Đồng bộ thất bại" : "Sync failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSyncing(false);
    }
  };

  const handleResetData = () => {
    setResetConfirmText("");
    setResetConfirmOpen(true);
  };

  const confirmResetData = async () => {
    const normalized = resetConfirmText.trim().toLowerCase();
    if (language === "vi" ? normalized !== "đồng ý" : normalized !== "yes") {
      Alert.alert(t("resetFailed"), t("resetDatabaseWrong"));
      return;
    }
    try {
      await resetAll();
      setResetConfirmOpen(false);
      setResetConfirmText("");
      Alert.alert(t("done"), t("resetDatabaseDone"));
    } catch (e) {
      Alert.alert(t("resetFailed"), e instanceof Error ? e.message : "Unknown error");
    }
  };

  const safePush = (route: any) => {
    try {
      router.push(route);
    } catch (e) {
      Alert.alert("Navigation Error", "Cannot open this screen.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace("/auth");
    } catch (e) {
      Alert.alert(language === "vi" ? "Đăng xuất thất bại" : "Sign out failed", e instanceof Error ? e.message : "Unknown error");
    }
  };

  const handleReminderEnabledChange = async (next: boolean) => {
    setNotifyEnabled(next);
    await ensureDbReady();
    await setSetting(DAILY_REMINDER_ENABLED_KEY, next ? "1" : "0");
    if (next) {
      await scheduleDailyReminder(reminderTime, language);
    } else {
      await cancelDailyReminder();
    }
    void syncTransactionsToSupabaseIfEnabled().catch((error) => {
      console.warn("Background reminder sync failed:", error);
    });
  };

  const handleReminderTimeChange = async (value: string) => {
    const cleaned = value.replace(/[^\d:]/g, "").slice(0, 5);
    setReminderTime(cleaned);
    if (/^\d{2}:\d{2}$/.test(cleaned)) {
      const [hour, minute] = cleaned.split(":").map(Number);
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        await ensureDbReady();
        await setSetting(DAILY_REMINDER_TIME_KEY, cleaned);
        if (notifyEnabled) await scheduleDailyReminder(cleaned, language);
        void syncTransactionsToSupabaseIfEnabled().catch((error) => {
          console.warn("Background reminder time sync failed:", error);
        });
      }
    }
  };

  const handleLanguageChange = async (nextLanguage: "vi" | "en") => {
    await setLanguage(nextLanguage);
    void syncTransactionsToSupabaseIfEnabled().catch((error) => {
      console.warn("Background settings sync failed:", error);
    });
  };

  return (
    <ScrollView className="flex-1 bg-[#f8fafc] px-4 pt-14" showsVerticalScrollIndicator={false}>
      <Modal transparent visible={resetConfirmOpen} animationType="fade" onRequestClose={() => setResetConfirmOpen(false)}>
        <View className="flex-1 bg-black/40 justify-center px-6">
          <View className="bg-white rounded-3xl p-5 border border-slate-100">
            <Text className="text-lg font-black text-slate-900">{t("confirmResetTitle")}</Text>
            <Text className="text-xs text-slate-500 mt-2 leading-5">{t("confirmResetInput")}</Text>
            <TextInput
              value={resetConfirmText}
              onChangeText={setResetConfirmText}
              autoCapitalize="none"
              placeholder={language === "vi" ? "đồng ý" : "yes"}
              placeholderTextColor="#94a3b8"
              className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900"
            />
            <View className="flex-row gap-2 mt-4">
              <Pressable
                onPress={() => setResetConfirmOpen(false)}
                className="flex-1 rounded-2xl bg-slate-100 py-3 items-center active:opacity-70"
              >
                <Text className="text-xs font-black text-slate-600">{t("cancel")}</Text>
              </Pressable>
              <Pressable
                onPress={() => void confirmResetData()}
                className="flex-1 rounded-2xl bg-rose-600 py-3 items-center active:opacity-70"
              >
                <Text className="text-xs font-black text-white">{t("reset")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {/* Title */}
      <Text className="text-2xl font-bold text-slate-900 mb-6">{t("settings")}</Text>

      {/* Profile Card */}
      <View className="flex-row items-center bg-white border border-slate-100 rounded-3xl p-5 shadow-sm mb-6">
        <View className="w-14 h-14 rounded-full bg-indigo-500 items-center justify-center shadow-md">
          <Text className="text-white text-xl font-bold">U</Text>
        </View>
        <View className="ml-4 flex-1">
          <Text className="text-base font-bold text-slate-800">{user?.email ?? "User Account"}</Text>
          <Text className="text-xs text-slate-400 font-semibold">Tier: SpendSnap Pro</Text>
        </View>
        <Pressable
          onPress={() => void handleSignOut()}
          className="bg-indigo-50 px-3.5 py-2 rounded-2xl active:scale-95"
        >
          <Text className="text-xs font-bold text-indigo-600">{language === "vi" ? "Đăng xuất" : "Sign out"}</Text>
        </Pressable>
      </View>

      {/* Settings Sections */}
      <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">{t("options")}</Text>
      <View className="bg-white border border-slate-100 rounded-3xl overflow-hidden mb-6 shadow-sm">
        <View className="px-5 py-4 border-b border-slate-50">
          <View className="flex-row items-center gap-3.5 mb-3">
            <View className="w-9 h-9 rounded-xl bg-indigo-50 items-center justify-center">
              <Ionicons name="language-outline" size={18} color="#4f46e5" />
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-800">{t("language")}</Text>
              <Text className="text-[10px] text-slate-400 font-medium">{t("languageSubtitle")}</Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => void handleLanguageChange("vi")}
              className={`flex-1 rounded-2xl px-3 py-3 items-center ${language === "vi" ? "bg-indigo-600" : "bg-slate-50"}`}
            >
              <Text className={language === "vi" ? "text-white text-xs font-black" : "text-slate-600 text-xs font-black"}>
                {t("vietnamese")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void handleLanguageChange("en")}
              className={`flex-1 rounded-2xl px-3 py-3 items-center ${language === "en" ? "bg-indigo-600" : "bg-slate-50"}`}
            >
              <Text className={language === "en" ? "text-white text-xs font-black" : "text-slate-600 text-xs font-black"}>
                {t("english")}
              </Text>
            </Pressable>
          </View>
        </View>
        {/* Sync Settings */}
        <View className="px-5 py-4 border-b border-slate-50">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3.5 flex-1 pr-3">
              <View className="w-9 h-9 rounded-xl bg-sky-50 items-center justify-center">
                <Ionicons name="cloud-upload-outline" size={18} color="#0284c7" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-slate-800">{t("sync")}</Text>
                <Text className="text-[10px] text-slate-400 font-medium">{t("syncHint")}</Text>
                <Text className="text-[10px] text-slate-500 font-bold mt-1">
                  {language === "vi" ? "Chờ đồng bộ" : "Pending"}: {syncStatus.unsynced + syncStatus.pendingDeletes}
                </Text>
              </View>
            </View>
            <Switch
              value={syncEnabled}
              onValueChange={handleToggleSync}
              trackColor={{ false: "#e2e8f0", true: "#818cf8" }}
              thumbColor={syncEnabled ? "#6366f1" : "#f4f4f5"}
            />
          </View>
          {syncEnabled ? (
            <Pressable
              onPress={() => void handleManualSync()}
              disabled={syncing}
              className="mt-3 rounded-2xl bg-sky-50 py-3 items-center active:opacity-70 disabled:opacity-40"
            >
              <Text className="text-xs font-black text-sky-700">
                {syncing ? (language === "vi" ? "Đang đồng bộ..." : "Syncing...") : language === "vi" ? "Đồng bộ ngay" : "Sync now"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Notifications */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-50">
          <View className="flex-row items-center gap-3.5">
            <View className="w-9 h-9 rounded-xl bg-indigo-50 items-center justify-center">
              <Ionicons name="notifications-outline" size={18} color="#4f46e5" />
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-800">{t("dailyReminders")}</Text>
              <Text className="text-[10px] text-slate-400 font-medium">{t("dailyRemindersHint")}</Text>
            </View>
          </View>
          <Switch
            value={notifyEnabled}
            onValueChange={(next) => void handleReminderEnabledChange(next)}
            trackColor={{ false: "#e2e8f0", true: "#818cf8" }}
            thumbColor={notifyEnabled ? "#6366f1" : "#f4f4f5"}
          />
        </View>

        {notifyEnabled ? (
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-50">
            <View className="flex-row items-center gap-3.5">
              <View className="w-9 h-9 rounded-xl bg-violet-50 items-center justify-center">
                <Ionicons name="time-outline" size={18} color="#7c3aed" />
              </View>
              <View>
                <Text className="text-sm font-bold text-slate-800">{language === "vi" ? "Giờ nhắc" : "Reminder time"}</Text>
                <Text className="text-[10px] text-slate-400 font-medium">{language === "vi" ? "Định dạng 24 giờ, ví dụ 20:00" : "24-hour format, e.g. 20:00"}</Text>
              </View>
            </View>
            <TextInput
              value={reminderTime}
              onChangeText={(value) => void handleReminderTimeChange(value)}
              keyboardType="numbers-and-punctuation"
              placeholder="20:00"
              placeholderTextColor="#94a3b8"
              className="w-20 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-center text-sm font-black text-slate-800"
            />
          </View>
        ) : null}

        {/* Currency Setting */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-50">
          <View className="flex-row items-center gap-3.5">
            <View className="w-9 h-9 rounded-xl bg-amber-50 items-center justify-center">
              <Ionicons name="cash-outline" size={18} color="#d97706" />
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-800">{t("defaultCurrency")}</Text>
              <Text className="text-[10px] text-slate-400 font-medium">{t("defaultCurrencyHint")}</Text>
            </View>
          </View>
          <Ionicons name="lock-closed-outline" size={16} color="#94a3b8" />
        </View>

        {/* Budget Setting */}
        <Pressable
          onPress={() => safePush("/budget")}
          className="flex-row items-center justify-between px-5 py-4 border-b border-slate-50 active:bg-slate-50"
        >
          <View className="flex-row items-center gap-3.5">
            <View className="w-9 h-9 rounded-xl bg-emerald-50 items-center justify-center">
              <Ionicons name="calculator-outline" size={18} color="#059669" />
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-800">{t("monthlyBudgetGoal")}</Text>
              <Text className="text-[10px] text-slate-400 font-medium">
                {language === "vi" ? "Đang đặt" : "Set to"}: {formatMoneyVnd(monthlyBudget)}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
        </Pressable>

        {/* Categories */}
        <Pressable
          onPress={() => safePush("/categories")}
          className="flex-row items-center justify-between px-5 py-4 active:bg-slate-50"
        >
          <View className="flex-row items-center gap-3.5">
            <View className="w-9 h-9 rounded-xl bg-violet-50 items-center justify-center">
              <Ionicons name="pricetags-outline" size={18} color="#7c3aed" />
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-800">{t("categories")}</Text>
              <Text className="text-[10px] text-slate-400 font-medium">{t("manageCategoriesHint")}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
        </Pressable>
      </View>

      <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">{t("maintenance")}</Text>
      <View className="bg-white border border-slate-100 rounded-3xl overflow-hidden mb-6 shadow-sm">
        {/* API Key Status */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-50">
          <View className="flex-row items-center gap-3.5">
            <View className="w-9 h-9 rounded-xl bg-violet-50 items-center justify-center">
              <Ionicons name="key-outline" size={18} color="#7c3aed" />
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-800">OpenAI API Connection</Text>
              <Text className="text-[10px] text-emerald-500 font-bold uppercase">{t("connectedLive")}</Text>
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
              <Text className="text-sm font-bold text-rose-600">{t("resetDatabase")}</Text>
              <Text className="text-[10px] text-slate-400 font-medium">{t("resetDatabaseHint")}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
        </Pressable>
      </View>

      {/* App Info footer */}
      <View className="items-center mt-4 mb-16">
      <Text className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">SpendSnap v1.0.0</Text>
        <Text className="text-[9px] text-slate-400 font-medium mt-1">Made for SpendSnap</Text>
      </View>
    </ScrollView>
  );
}
