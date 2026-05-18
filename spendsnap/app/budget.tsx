import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ensureDbReady, getSetting, setSetting } from "../services/db";
import { formatMoneyVnd, parseMoneyToVnd } from "../utils/money";

const BUDGET_KEY = "monthly_budget_vnd";
const DEFAULT_BUDGET = 5_000_000;

export default function BudgetModal() {
  const [rawBudget, setRawBudget] = useState<string>(String(DEFAULT_BUDGET));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await ensureDbReady();
        const value = await getSetting(BUDGET_KEY);
        if (!mounted) return;
        const asNum = value ? Number(value) : DEFAULT_BUDGET;
        setRawBudget(String(Number.isFinite(asNum) ? asNum : DEFAULT_BUDGET));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const budgetValue = useMemo(() => parseMoneyToVnd(rawBudget), [rawBudget]);
  const canSave = !loading && budgetValue > 0;

  async function onSave() {
    try {
      await ensureDbReady();
      await setSetting(BUDGET_KEY, String(budgetValue));
      router.back();
    } catch (e) {
      Alert.alert("Save failed", e instanceof Error ? e.message : "Unknown error");
    }
  }

  return (
    <ScrollView className="flex-1 bg-[#f8fafc] px-4 pt-10" showsVerticalScrollIndicator={false}>
      <View className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-base font-extrabold text-slate-900">Monthly Budget Goal</Text>
          <View className="bg-emerald-50 px-2.5 py-1 rounded-full">
            <Text className="text-[10px] font-bold text-emerald-600">VND</Text>
          </View>
        </View>

        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
          Budget (numbers only)
        </Text>
        <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
          <TextInput
            value={rawBudget}
            onChangeText={setRawBudget}
            keyboardType="numeric"
            placeholder="5000000"
            placeholderTextColor="#94a3b8"
            className="flex-1 text-sm font-bold text-slate-800"
          />
          <Text className="text-xs text-slate-400 font-bold">VND</Text>
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
          <Text className="text-white font-extrabold text-sm">Save Budget</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

