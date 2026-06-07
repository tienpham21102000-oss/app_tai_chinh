import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";

import { DEFAULT_CATEGORIES, ensureDbReady, getSetting, setSetting } from "../services/db";
import { cancelDailyReminder, scheduleDailyReminder } from "../services/reminders";
import { syncTransactionsToSupabaseIfEnabled } from "../services/sync";
import { useAuthStore } from "../stores/auth";
import { DEFAULT_BUDGET, LEGACY_BUDGET_KEY, getBudgetForMonth, monthBudgetKey } from "../utils/budget";
import { categoryLabel } from "../utils/categories";
import { useI18n } from "../utils/i18n";
import { formatMoneyVnd, parseMoneyToVnd } from "../utils/money";

const ONBOARDING_COMPLETE_PREFIX = "onboarding_complete_";
const DAILY_REMINDER_ENABLED_KEY = "daily_reminder_enabled";
const DAILY_REMINDER_TIME_KEY = "daily_reminder_time";

type Step = 0 | 1 | 2 | 3;

export default function Onboarding() {
  const user = useAuthStore((s) => s.user);
  const { language } = useI18n();
  const [step, setStep] = useState<Step>(0);
  const [budgetInput, setBudgetInput] = useState(String(Math.round(DEFAULT_BUDGET / 1000)));
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState("20:00");
  const [saving, setSaving] = useState(false);

  const isVi = language === "vi";
  const parsedBudget = useMemo(() => parseMoneyToVnd(budgetInput), [budgetInput]);
  const canContinueBudget = parsedBudget > 0;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await ensureDbReady();
        const [budget, notify, time] = await Promise.all([
          getBudgetForMonth(new Date()),
          getSetting(DAILY_REMINDER_ENABLED_KEY),
          getSetting(DAILY_REMINDER_TIME_KEY),
        ]);
        if (!active) return;
        setBudgetInput(String(Math.round(budget / 1000)));
        setReminderEnabled(notify !== "0");
        setReminderTime(time || "20:00");
      } catch {
        // Keep defaults.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const copy = {
    title: isVi ? "Thiết lập SpendSnap" : "Set up SpendSnap",
    subtitle: isVi
      ? "Chọn vài tùy chọn chính để app phân tích chi tiêu sát với thói quen của bạn."
      : "Pick a few defaults so the app can analyze spending around your habits.",
    next: isVi ? "Tiếp tục" : "Continue",
    back: isVi ? "Quay lại" : "Back",
    finish: isVi ? "Hoàn tất" : "Finish",
    budgetTitle: isVi ? "Mục tiêu ngân sách tháng" : "Monthly budget goal",
    budgetHint: isVi ? "Nhập theo đơn vị k. Ví dụ 5000 = 5.000k = 5.000.000đ." : "Enter the amount in k. Example: 5000 = 5,000k.",
    reminderTitle: isVi ? "Giờ nhắc hằng ngày" : "Daily reminder time",
    reminderHint: isVi ? "SpendSnap sẽ nhắc bạn ghi lại chi tiêu trong ngày." : "SpendSnap can remind you to log today's expenses.",
    categoriesTitle: isVi ? "Danh mục chi tiêu" : "Expense categories",
    categoriesHint: isVi ? "Đây là danh mục mặc định. Bạn có thể xóa, thêm hoặc đổi tên nếu cần." : "These are the default categories. You can delete, add, or rename them if needed.",
    editCategories: isVi ? "Chỉnh danh mục" : "Edit categories",
    introTitle: isVi ? "Bạn có thể ghi chi tiêu theo 3 cách" : "Track expenses in three ways",
    enableReminder: isVi ? "Bật nhắc hằng ngày" : "Enable daily reminder",
    time: isVi ? "Thời gian" : "Time",
    invalidBudget: isVi ? "Nhập ngân sách hợp lệ" : "Enter a valid budget",
  };

  const features = [
    {
      icon: "mic-outline" as const,
      title: "AI Voice",
      body: isVi ? "Nói khoản chi, app tự tách số tiền, nơi mua và danh mục." : "Say the expense and let AI extract amount, merchant, and category.",
    },
    {
      icon: "camera-outline" as const,
      title: "AI Camera",
      body: isVi ? "Chụp bill, kiểm tra kết quả, rồi lưu vào lịch sử." : "Snap a receipt, review the result, then save it to history.",
    },
    {
      icon: "create-outline" as const,
      title: "AI Note",
      body: isVi ? "Gõ nhanh một câu như 'cà phê 20k', AI sẽ chuẩn hóa giao dịch." : "Type a quick note like 'coffee 20k' and AI will normalize the transaction.",
    },
  ];

  async function saveBudget() {
    await ensureDbReady();
    await setSetting(monthBudgetKey(new Date()), String(parsedBudget));
    await setSetting(LEGACY_BUDGET_KEY, String(parsedBudget));
  }

  async function saveReminder() {
    await ensureDbReady();
    await setSetting(DAILY_REMINDER_ENABLED_KEY, reminderEnabled ? "1" : "0");
    await setSetting(DAILY_REMINDER_TIME_KEY, reminderTime);
    if (reminderEnabled) await scheduleDailyReminder(reminderTime, language);
    else await cancelDailyReminder();
  }

  async function goNext() {
    if (step === 1) await saveBudget();
    if (step === 2) await saveReminder();
    setStep((prev) => Math.min(3, prev + 1) as Step);
  }

  async function finish() {
    if (!user?.id) return;
    setSaving(true);
    try {
      await saveBudget();
      await saveReminder();
      await setSetting(`${ONBOARDING_COMPLETE_PREFIX}${user.id}`, "1");
      await syncTransactionsToSupabaseIfEnabled().catch(() => null);
      router.replace("/");
    } finally {
      setSaving(false);
    }
  }

  function renderStep() {
    if (step === 0) {
      return (
        <View>
          <Text className="text-2xl font-black text-slate-950 tracking-tight">{copy.introTitle}</Text>
          <Text className="text-sm text-slate-500 mt-2 mb-6 leading-5">{copy.subtitle}</Text>
          <View className="gap-3">
            {features.map((item) => (
              <View key={item.title} className="flex-row items-start gap-3 rounded-2xl bg-white border border-slate-100 p-4">
                <View className="w-10 h-10 rounded-2xl bg-indigo-50 items-center justify-center">
                  <Ionicons name={item.icon} size={20} color="#4f46e5" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-black text-slate-900">{item.title}</Text>
                  <Text className="text-xs text-slate-500 mt-1 leading-5">{item.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (step === 1) {
      return (
        <View>
          <Text className="text-2xl font-black text-slate-950 tracking-tight">{copy.budgetTitle}</Text>
          <Text className="text-sm text-slate-500 mt-2 mb-6 leading-5">{copy.budgetHint}</Text>
          <View className="rounded-2xl bg-white border border-slate-100 p-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-[10px] font-black uppercase text-slate-400">k</Text>
              <Text className="text-[10px] font-bold text-slate-400">1k = 1.000đ</Text>
            </View>
            <View className="flex-row items-center">
              <TextInput
                value={budgetInput}
                onChangeText={setBudgetInput}
                keyboardType="number-pad"
                placeholder="5000"
                className="flex-1 text-3xl font-black text-slate-950"
              />
              <Text className="text-2xl font-black text-slate-400">k</Text>
            </View>
            <Text className="text-xs font-bold text-indigo-600 mt-3">
              {parsedBudget > 0 ? formatMoneyVnd(parsedBudget) : copy.invalidBudget}
            </Text>
          </View>
          <View className="flex-row gap-2 mt-3">
            {[3000, 5000, 10000].map((value) => (
              <Pressable key={value} onPress={() => setBudgetInput(String(value))} className="flex-1 rounded-xl bg-slate-100 py-3 items-center">
                <Text className="text-xs font-black text-slate-700">{value.toLocaleString("vi-VN")}k</Text>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    if (step === 2) {
      return (
        <View>
          <Text className="text-2xl font-black text-slate-950 tracking-tight">{copy.reminderTitle}</Text>
          <Text className="text-sm text-slate-500 mt-2 mb-6 leading-5">{copy.reminderHint}</Text>
          <View className="rounded-2xl bg-white border border-slate-100 p-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-sm font-black text-slate-900">{copy.enableReminder}</Text>
              <Switch value={reminderEnabled} onValueChange={setReminderEnabled} />
            </View>
            <Text className="text-[10px] font-black uppercase text-slate-400 mb-2">{copy.time}</Text>
            <TextInput
              value={reminderTime}
              onChangeText={setReminderTime}
              placeholder="20:00"
              keyboardType="numbers-and-punctuation"
              editable={reminderEnabled}
              className="text-3xl font-black text-slate-950"
            />
            <View className="flex-row gap-2 mt-3">
              {["08:00", "20:00", "22:00"].map((time) => (
                <Pressable key={time} onPress={() => setReminderTime(time)} className="flex-1 rounded-xl bg-slate-100 py-3 items-center">
                  <Text className="text-xs font-black text-slate-700">{time}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      );
    }

    return (
      <View>
        <Text className="text-2xl font-black text-slate-950 tracking-tight">{copy.categoriesTitle}</Text>
        <Text className="text-sm text-slate-500 mt-2 mb-4 leading-5">{copy.categoriesHint}</Text>
        <View className="bg-white border border-slate-100 rounded-2xl overflow-hidden mb-4">
          {DEFAULT_CATEGORIES.map((item, index) => (
            <View key={item.id} className={`flex-row items-center gap-3 px-4 py-3 ${index === DEFAULT_CATEGORIES.length - 1 ? "" : "border-b border-slate-50"}`}>
              <View className="w-9 h-9 rounded-2xl items-center justify-center" style={{ backgroundColor: item.color }}>
                <Text className="text-base">{item.icon}</Text>
              </View>
              <Text className="text-sm font-black text-slate-800">{categoryLabel(item.name, language)}</Text>
            </View>
          ))}
        </View>
        <Pressable onPress={() => router.push("/categories")} className="flex-row items-center justify-between rounded-2xl bg-white border border-slate-100 p-4">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-2xl bg-emerald-50 items-center justify-center">
              <Ionicons name="pricetags-outline" size={20} color="#059669" />
            </View>
            <Text className="text-sm font-black text-slate-900">{copy.editCategories}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#64748b" />
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-[#f8fafc]" behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView className="flex-1 px-5 pt-14" contentContainerStyle={{ flexGrow: 1, paddingBottom: 160 }} keyboardShouldPersistTaps="handled">
        <View className="mb-8">
          <View className="w-12 h-12 rounded-2xl bg-indigo-600 items-center justify-center mb-4">
            <Ionicons name="wallet-outline" size={24} color="white" />
          </View>
          <Text className="text-3xl font-black text-slate-950 tracking-tight">{copy.title}</Text>
          <View className="flex-row gap-2 mt-5">
            {[0, 1, 2, 3].map((item) => (
              <View key={item} className={`h-1.5 flex-1 rounded-full ${item <= step ? "bg-indigo-600" : "bg-slate-200"}`} />
            ))}
          </View>
        </View>

        {renderStep()}

        <View className="flex-row gap-3 mt-8">
          {step > 0 ? (
            <Pressable onPress={() => setStep((prev) => Math.max(0, prev - 1) as Step)} className="w-24 rounded-2xl bg-slate-100 py-4 items-center">
              <Text className="text-sm font-black text-slate-600">{copy.back}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={step === 3 ? finish : goNext}
            disabled={(step === 1 && !canContinueBudget) || saving}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-4 ${(step === 1 && !canContinueBudget) || saving ? "bg-slate-300" : "bg-indigo-600"}`}
          >
            <Text className="text-sm font-black text-white">{step === 3 ? copy.finish : copy.next}</Text>
            <Ionicons name={step === 3 ? "checkmark" : "arrow-forward"} size={16} color="white" />
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
