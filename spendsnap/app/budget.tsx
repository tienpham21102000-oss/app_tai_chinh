import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ensureDbReady, setSetting } from "../services/db";
import { syncTransactionsToSupabaseIfEnabled } from "../services/sync";
import { useI18n } from "../utils/i18n";
import { formatMoneyVnd, parseMoneyToVnd } from "../utils/money";
import { DEFAULT_BUDGET, LEGACY_BUDGET_KEY, getBudgetForMonth, isPastBudgetMonth, monthBudgetKey, monthLabel } from "../utils/budget";

export default function BudgetModal() {
  const [rawBudget, setRawBudget] = useState<string>(String(Math.round(DEFAULT_BUDGET / 1000)));
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const { t, language } = useI18n();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        await ensureDbReady();
        const value = await getBudgetForMonth(selectedMonth);
        if (!mounted) return;
        setRawBudget(String(Math.round(value / 1000)));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedMonth]);

  const budgetValue = useMemo(() => parseMoneyToVnd(rawBudget), [rawBudget]);
  const locked = isPastBudgetMonth(selectedMonth);
  const canSave = !loading && !locked && budgetValue > 0;

  async function onSave() {
    try {
      await ensureDbReady();
      await setSetting(monthBudgetKey(selectedMonth), String(budgetValue));
      if (
        !isPastBudgetMonth(selectedMonth) &&
        selectedMonth.getMonth() === new Date().getMonth() &&
        selectedMonth.getFullYear() === new Date().getFullYear()
      ) {
        await setSetting(LEGACY_BUDGET_KEY, String(budgetValue));
      }
      void syncTransactionsToSupabaseIfEnabled().catch((error) => {
        console.warn("Background budget sync failed:", error);
      });
      router.dismissTo("/");
    } catch (e) {
      Alert.alert("Save failed", e instanceof Error ? e.message : "Unknown error");
    }
  }

  function shiftMonth(delta: number) {
    setSelectedMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  return (
    <ScrollView className="flex-1 bg-[#f8fafc] px-4 pt-10" showsVerticalScrollIndicator={false}>
      <View className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-base font-extrabold text-slate-900">{t("monthlyBudgetGoal")}</Text>
          <View className="bg-emerald-50 px-2.5 py-1 rounded-full">
            <Text className="text-[10px] font-bold text-emerald-600">k</Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2.5 mb-4">
          <Pressable onPress={() => shiftMonth(-1)} className="w-9 h-9 rounded-full bg-white items-center justify-center border border-slate-100">
            <Ionicons name="chevron-back" size={18} color="#64748b" />
          </Pressable>
          <View className="items-center">
            <Text className="text-sm font-black text-slate-900">{monthLabel(selectedMonth, language)}</Text>
            {locked ? (
              <Text className="text-[10px] font-bold text-rose-500 mt-0.5">{language === "vi" ? "Tháng đã qua, chỉ xem" : "Past month, view only"}</Text>
            ) : (
              <Text className="text-[10px] font-bold text-emerald-600 mt-0.5">{language === "vi" ? "Có thể chỉnh sửa" : "Editable"}</Text>
            )}
          </View>
          <Pressable onPress={() => shiftMonth(1)} className="w-9 h-9 rounded-full bg-white items-center justify-center border border-slate-100">
            <Ionicons name="chevron-forward" size={18} color="#64748b" />
          </Pressable>
        </View>

        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
          {language === "vi" ? "Ngân sách (nhập số = k)" : "Budget (numbers = k)"}
        </Text>
        <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
          <TextInput
            value={rawBudget}
            onChangeText={setRawBudget}
            editable={!locked}
            keyboardType="numeric"
            placeholder="5000"
            placeholderTextColor="#94a3b8"
            className="flex-1 text-sm font-bold text-slate-800"
          />
          <Text className="text-xs text-slate-400 font-bold">k</Text>
        </View>
        <Text className="text-[10px] text-indigo-500 font-semibold mt-2 px-1">
          {formatMoneyVnd(budgetValue)}
        </Text>

        <Pressable
          onPress={onSave}
          disabled={!canSave}
          className="mt-5 w-full flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 shadow-md active:scale-95 disabled:opacity-40"
        >
          <Ionicons name="checkmark-circle" size={18} color="white" />
          <Text className="text-white font-extrabold text-sm">{language === "vi" ? "Lưu ngân sách" : "Save Budget"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
