import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { useTransactionsStore } from "../../stores/transactions";
import { ensureDbReady, getSetting } from "../../services/db";
import { formatMoneyVnd } from "../../utils/money";

const BUDGET_KEY = "monthly_budget_vnd";
const DEFAULT_BUDGET = 5_000_000;

function getCategoryEmoji(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("phở") || c.includes("ăn") || c.includes("food") || c.includes("lunch") || c.includes("dinner")) return "🍔";
  if (c.includes("cf") || c.includes("coffee") || c.includes("cà phê") || c.includes("highlands") || c.includes("starbucks") || c.includes("trà sữa")) return "☕";
  if (c.includes("grab") || c.includes("taxi") || c.includes("xe") || c.includes("di chuyển") || c.includes("transport")) return "🚗";
  if (c.includes("mua") || c.includes("shop") || c.includes("lazada") || c.includes("shopee") || c.includes("quần áo")) return "🛍️";
  if (c.includes("phim") || c.includes("chơi") || c.includes("nhạc") || c.includes("entertainment") || c.includes("game")) return "🎬";
  if (c.includes("điện") || c.includes("nước") || c.includes("bill") || c.includes("internet")) return "⚡";
  return "📦";
}

function getCategoryBg(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("phở") || c.includes("ăn") || c.includes("food") || c.includes("lunch") || c.includes("dinner")) return "bg-orange-50";
  if (c.includes("cf") || c.includes("coffee") || c.includes("cà phê") || c.includes("highlands") || c.includes("starbucks") || c.includes("trà sữa")) return "bg-amber-50";
  if (c.includes("grab") || c.includes("taxi") || c.includes("xe") || c.includes("di chuyển") || c.includes("transport")) return "bg-sky-50";
  if (c.includes("mua") || c.includes("shop") || c.includes("lazada") || c.includes("shopee") || c.includes("quần áo")) return "bg-purple-50";
  if (c.includes("phim") || c.includes("chơi") || c.includes("nhạc") || c.includes("entertainment") || c.includes("game")) return "bg-rose-50";
  if (c.includes("điện") || c.includes("nước") || c.includes("bill") || c.includes("internet")) return "bg-emerald-50";
  return "bg-slate-100";
}

export default function AnalyticsScreen() {
  const { transactions, refreshAll } = useTransactionsStore();
  const [monthlyBudget, setMonthlyBudget] = useState<number>(DEFAULT_BUDGET);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          await ensureDbReady();
          const v = await getSetting(BUDGET_KEY);
          const n = v ? Number(v) : DEFAULT_BUDGET;
          if (!active) return;
          setMonthlyBudget(Number.isFinite(n) ? n : DEFAULT_BUDGET);
        } catch {
          // ignore
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  // Aggregate expenditures by categories
  const categorySummary = useMemo(() => {
    const map: Record<string, number> = {};
    let total = 0;

    transactions.forEach((t) => {
      // Normalize category labels to group them nicely
      let cat = t.category || "Other";
      const norm = cat.toLowerCase();
      if (norm.includes("phở") || norm.includes("ăn") || norm.includes("food") || norm.includes("lunch") || norm.includes("dinner")) {
        cat = "Food";
      } else if (norm.includes("cf") || norm.includes("coffee") || norm.includes("cà phê") || norm.includes("highlands") || norm.includes("starbucks") || norm.includes("trà sữa")) {
        cat = "Drinks";
      } else if (norm.includes("grab") || norm.includes("taxi") || norm.includes("xe") || norm.includes("di chuyển") || norm.includes("transport")) {
        cat = "Travel";
      } else if (norm.includes("mua") || norm.includes("shop") || norm.includes("lazada") || norm.includes("shopee") || norm.includes("quần áo")) {
        cat = "Shopping";
      } else if (norm.includes("phim") || norm.includes("chơi") || norm.includes("nhạc") || norm.includes("entertainment") || norm.includes("game")) {
        cat = "Entertainment";
      } else if (norm.includes("điện") || norm.includes("nước") || norm.includes("bill") || norm.includes("internet")) {
        cat = "Bills";
      } else {
        cat = "Others";
      }

      map[cat] = (map[cat] || 0) + t.amount;
      total += t.amount;
    });

    const list = Object.keys(map).map((name) => {
      const amount = map[name];
      const percentage = total > 0 ? Math.round((amount / total) * 100) : 0;
      return { name, amount, percentage };
    });

    // Sort descending by amount
    list.sort((a, b) => b.amount - a.amount);

    return { list, total };
  }, [transactions]);

  const budgetSpentPercent = useMemo(() => {
    if (categorySummary.total === 0) return 0;
    return Math.min(100, Math.round((categorySummary.total / monthlyBudget) * 100));
  }, [categorySummary.total, monthlyBudget]);

  const remainingBudget = Math.max(0, monthlyBudget - categorySummary.total);

  // Dynamic Insight generation
  const mainExpenseCategory = useMemo(() => {
    if (categorySummary.list.length === 0) return null;
    return categorySummary.list[0];
  }, [categorySummary.list]);

  return (
    <ScrollView className="flex-1 bg-[#f8fafc] px-4 pt-14" showsVerticalScrollIndicator={false}>
      {/* Title */}
      <Text className="text-2xl font-black text-slate-900 mb-5 tracking-tight">Financial Analytics</Text>

      {/* Monthly Budget Summary Progress Card */}
      <View className="bg-white border border-slate-100 rounded-3xl p-5 shadow-lg mb-6 relative overflow-hidden">
        <View className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-indigo-500/5 blur-lg" />
        <View className="flex-row justify-between items-center mb-4">
          <View>
            <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Remaining Budget</Text>
            <Text className="text-2xl font-black text-slate-900 mt-1">
              {formatMoneyVnd(remainingBudget)}
            </Text>
          </View>
          <View className="bg-indigo-50 px-3 py-1.5 rounded-2xl border border-indigo-100">
            <Text className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">{budgetSpentPercent}% Spent</Text>
          </View>
        </View>

        {/* Progress Bar Container */}
        <View className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden mb-3">
          <View
            style={{ width: `${budgetSpentPercent}%` }}
            className="h-full bg-indigo-600 rounded-full"
          />
        </View>

        <View className="flex-row justify-between items-center">
          <Text className="text-[10px] font-bold text-slate-400">Spent: {formatMoneyVnd(categorySummary.total)}</Text>
          <Text className="text-[10px] font-bold text-slate-400">Total Limit: {formatMoneyVnd(monthlyBudget)}</Text>
        </View>
      </View>

      {/* Category Breakdown list */}
      <Text className="text-base font-black text-slate-800 mb-4 tracking-tight">Category Breakdown</Text>

      {categorySummary.list.length === 0 ? (
        <View className="items-center py-12 px-6 bg-white border border-slate-100 rounded-3xl shadow-sm mb-6">
          <View className="w-16 h-16 rounded-full bg-slate-50 items-center justify-center mb-3">
            <Ionicons name="pie-chart-outline" size={28} color="#94a3b8" />
          </View>
          <Text className="text-sm font-black text-slate-800">No data to analyze</Text>
          <Text className="text-xs text-slate-400 text-center mt-1">
            Log some transactions first to generate dynamic statistics!
          </Text>
        </View>
      ) : (
        <View className="bg-white border border-slate-100 rounded-3xl p-5 shadow-md mb-6">
          {categorySummary.list.map((c, index) => {
            // Curated harmonious bar colors
            const barColors = [
              "bg-indigo-500",
              "bg-emerald-500",
              "bg-amber-500",
              "bg-violet-500",
              "bg-rose-500",
              "bg-sky-500",
              "bg-slate-400",
            ];
            const barColor = barColors[index % barColors.length];

            return (
              <View key={c.name} className="mb-4 last:mb-0">
                <View className="flex-row justify-between items-center mb-2">
                  <View className="flex-row items-center gap-2.5">
                    <View className={`w-9 h-9 rounded-xl items-center justify-center ${getCategoryBg(c.name)}`}>
                      <Text className="text-lg">{getCategoryEmoji(c.name)}</Text>
                    </View>
                    <Text className="text-xs font-black text-slate-800 uppercase tracking-wide">{c.name}</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[10px] font-bold text-slate-400">{c.percentage}%</Text>
                    <Text className="text-xs font-black text-slate-800">{formatMoneyVnd(c.amount)}</Text>
                  </View>
                </View>
                {/* Custom Bar progress track */}
                <View className="w-full h-2 bg-slate-50 rounded-full overflow-hidden">
                  <View
                    style={{ width: `${c.percentage}%` }}
                    className={`h-full rounded-full ${barColor}`}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* AI Smart Insights */}
      <Text className="text-base font-black text-slate-800 mb-3 tracking-tight">Smart Insights</Text>
      <View className="bg-slate-900 rounded-3xl p-5 shadow-xl relative overflow-hidden mb-12">
        <View className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-indigo-500/20 blur-xl" />
        <View className="flex-row items-start gap-3">
          <View className="w-8 h-8 rounded-full bg-white/10 items-center justify-center mt-0.5 border border-white/10">
            <Ionicons name="sparkles" size={14} color="#a78bfa" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-black text-white tracking-tight">AI Assistant Advice</Text>
            {mainExpenseCategory ? (
              <Text className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Bạn đã dành ngân sách nhiều nhất cho danh mục <Text className="font-black text-indigo-300 uppercase">{mainExpenseCategory.name}</Text> trong tháng này, chiếm tổng số{" "}
                <Text className="font-black text-white">{formatMoneyVnd(mainExpenseCategory.amount)}</Text> ({mainExpenseCategory.percentage}% tổng chi tiêu).
                Hãy thử đặt ra hạn mức nhỏ hơn cho danh mục này để tối ưu hóa khoản tiết kiệm của bạn nhé! 💡
              </Text>
            ) : (
              <Text className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Chào mừng bạn đến với SpendSnap! Tôi là Trợ lý tài chính AI của bạn. Sau khi bạn ghi lại các giao dịch chi tiêu đầu tiên, tôi sẽ phân tích xu hướng chi tiêu để đề xuất lời khuyên tiết kiệm tại đây. 🌟
              </Text>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
