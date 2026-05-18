import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Link, router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTransactionsStore } from "../../stores/transactions";
import { ensureDbReady, getSetting } from "../../services/db";
import { isSameLocalDay } from "../../utils/dates";
import { formatMoneyVnd } from "../../utils/money";

const BUDGET_KEY = "monthly_budget_vnd";
const DEFAULT_BUDGET = 5_000_000;

function getCategoryEmoji(category?: string | null): string {
  const c = (category ?? "").toLowerCase();
  if (c.includes("phở") || c.includes("ăn") || c.includes("food") || c.includes("lunch") || c.includes("dinner")) return "🍔";
  if (c.includes("cf") || c.includes("coffee") || c.includes("cà phê") || c.includes("highlands") || c.includes("starbucks") || c.includes("trà sữa")) return "☕";
  if (c.includes("grab") || c.includes("taxi") || c.includes("xe") || c.includes("di chuyển") || c.includes("transport")) return "🚗";
  if (c.includes("mua") || c.includes("shop") || c.includes("lazada") || c.includes("shopee") || c.includes("quần áo")) return "🛍️";
  if (c.includes("phim") || c.includes("chơi") || c.includes("nhạc") || c.includes("entertainment") || c.includes("game")) return "🎬";
  if (c.includes("điện") || c.includes("nước") || c.includes("bill") || c.includes("internet")) return "⚡";
  return "📦";
}

function getCategoryBg(category?: string | null): string {
  const c = (category ?? "").toLowerCase();
  if (c.includes("phở") || c.includes("ăn") || c.includes("food") || c.includes("lunch") || c.includes("dinner")) return "bg-orange-50";
  if (c.includes("cf") || c.includes("coffee") || c.includes("cà phê") || c.includes("highlands") || c.includes("starbucks") || c.includes("trà sữa")) return "bg-amber-50";
  if (c.includes("grab") || c.includes("taxi") || c.includes("xe") || c.includes("di chuyển") || c.includes("transport")) return "bg-sky-50";
  if (c.includes("mua") || c.includes("shop") || c.includes("lazada") || c.includes("shopee") || c.includes("quần áo")) return "bg-purple-50";
  if (c.includes("phim") || c.includes("chơi") || c.includes("nhạc") || c.includes("entertainment") || c.includes("game")) return "bg-rose-50";
  if (c.includes("điện") || c.includes("nước") || c.includes("bill") || c.includes("internet")) return "bg-emerald-50";
  return "bg-slate-100";
}

export default function HomeScreen() {
  const { transactions, refreshToday } = useTransactionsStore();
  const [now] = useState(() => new Date());
  const [monthlyBudget, setMonthlyBudget] = useState<number>(DEFAULT_BUDGET);

  useEffect(() => {
    void refreshToday();
  }, [refreshToday]);

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

  const todayTransactions = useMemo(
    () => transactions.filter((t) => isSameLocalDay(new Date(t.date), now)),
    [transactions, now]
  );

  const todayTotal = useMemo(
    () => todayTransactions.reduce((acc, t) => acc + t.amount, 0),
    [todayTransactions]
  );

  const monthlyTotal = useMemo(() => {
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return transactions
      .filter((t) => {
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((acc, t) => acc + t.amount, 0);
  }, [transactions, now]);

  const monthlySpentPercent = useMemo(() => {
    if (!monthlyBudget || monthlyBudget <= 0) return 0;
    return Math.min(100, Math.round((monthlyTotal / monthlyBudget) * 100));
  }, [monthlyTotal, monthlyBudget]);

  const monthlyStatus = useMemo(() => {
    if (monthlySpentPercent >= 95) return { label: "● Over limit", color: "text-rose-300" };
    if (monthlySpentPercent >= 80) return { label: "● Watch out", color: "text-amber-300" };
    return { label: "● Healthy", color: "text-emerald-300" };
  }, [monthlySpentPercent]);

  const greeting = useMemo(() => {
    const hours = now.getHours();
    if (hours < 12) return "Good morning ☀️";
    if (hours < 18) return "Good afternoon 🌤️";
    return "Good evening 🌙";
  }, [now]);

  // Limit constants
  const dailyLimit = 250000;
  const limitProgressPercent = useMemo(() => {
    return Math.min(100, Math.round((todayTotal / dailyLimit) * 100));
  }, [todayTotal]);

  return (
    <View className="flex-1 bg-[#f8fafc] px-4 pt-14">
      {/* Premium Header */}
      <View className="flex-row items-center justify-between mb-5">
        <View>
          <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{greeting}</Text>
          <Text className="text-2xl font-black text-slate-900 tracking-tight">SpendSnap</Text>
        </View>
        <View className="flex-row items-center gap-3">
          <Link href="/settings" asChild>
            <Pressable className="w-10 h-10 items-center justify-center rounded-full bg-white border border-slate-100 shadow-sm active:scale-95">
              <Ionicons name="settings-outline" size={20} color="#64748b" />
            </Pressable>
          </Link>
          <View className="w-10 h-10 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 shadow-md">
            <Text className="text-white font-black text-sm">S</Text>
          </View>
        </View>
      </View>

      {/* Main Budget Card - Bright and Glowing Premium Style */}
      <View className="bg-indigo-600 rounded-3xl p-6 mb-5 shadow-xl relative overflow-hidden">
        {/* Glow Graphics */}
        <View className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-pink-500/30 blur-3xl" />
        <View className="absolute -left-16 -bottom-16 w-48 h-48 rounded-full bg-indigo-400/20 blur-3xl" />

        <View className="flex-row justify-between items-start">
          <View>
            <Text className="text-indigo-200 text-[10px] font-extrabold tracking-widest uppercase">Today's Total spent</Text>
            <Text className="text-3xl font-black text-white mt-1 tracking-tight">
              {formatMoneyVnd(todayTotal)}
            </Text>
          </View>
          <View className="bg-white/10 px-2.5 py-1 rounded-full border border-white/10">
            <Text className="text-[10px] font-bold text-white uppercase tracking-wider">Active Wallet</Text>
          </View>
        </View>

        {/* Dynamic Limit Progress Indicator */}
        <View className="mt-5">
          <View className="flex-row justify-between items-center mb-1.5">
            <Text className="text-indigo-200 text-[9px] font-bold uppercase tracking-wider">Daily Budget Limit</Text>
            <Text className="text-[9px] font-black text-white">
              {formatMoneyVnd(todayTotal)} / {formatMoneyVnd(dailyLimit)} ({limitProgressPercent}%)
            </Text>
          </View>
          {/* Progress track */}
          <View className="w-full h-2.5 bg-indigo-900/30 rounded-full overflow-hidden">
            <View
              style={{ width: `${limitProgressPercent}%` }}
              className={`h-full rounded-full ${
                limitProgressPercent >= 90 ? "bg-amber-400" : "bg-emerald-400"
              }`}
            />
          </View>
        </View>

        <View className="w-full h-[1px] bg-white/10 my-4" />

        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-indigo-200 text-[9px] uppercase font-extrabold tracking-wider">Monthly Accumulation</Text>
            <Text className="text-base font-black text-white mt-0.5">
              {formatMoneyVnd(monthlyTotal)} / {formatMoneyVnd(monthlyBudget)} ({monthlySpentPercent}%)
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-indigo-200 text-[9px] uppercase font-extrabold tracking-wider">Status</Text>
            <Text className={`text-xs font-black mt-0.5 uppercase tracking-wide ${monthlyStatus.color}`}>
              {monthlyStatus.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Floating Action Shortcuts Grid */}
      <View className="flex-row gap-3 mb-6">
        <Link href="/add" asChild>
          <Pressable className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-indigo-50 border border-indigo-100 py-3 shadow-sm active:scale-95">
            <Ionicons name="mic" size={16} color="#4f46e5" />
            <Text className="text-[#4f46e5] text-[11px] font-black">AI Voice</Text>
          </Pressable>
        </Link>
        <Link href="/add" asChild>
          <Pressable className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-100 py-3 shadow-sm active:scale-95">
            <Ionicons name="camera" size={16} color="#059669" />
            <Text className="text-[#059669] text-[11px] font-black">Scan Bill</Text>
          </Pressable>
        </Link>
        <Link href="/add" asChild>
          <Pressable className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-white border border-slate-100 py-3 shadow-sm active:scale-95">
            <Ionicons name="create" size={16} color="#64748b" />
            <Text className="text-slate-600 text-[11px] font-black">Quick Type</Text>
          </Pressable>
        </Link>
      </View>

      {/* Transactions Section Header */}
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-base font-black text-slate-800 tracking-tight">Today's Transactions</Text>
        <Pressable
          onPress={() => router.push("/add")}
          className="flex-row items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 shadow-sm active:scale-95"
        >
          <Ionicons name="add" size={14} color="white" />
          <Text className="text-white text-[10px] font-extrabold">New Log</Text>
        </Pressable>
      </View>

      {/* Today's Transactions FlatList */}
      <FlatList
        data={todayTransactions}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/transaction/${item.id}`)}
            className="mb-3 flex-row items-center justify-between rounded-3xl border border-slate-100 bg-white p-4 shadow-sm active:opacity-75"
          >
            <View className="flex-row items-center gap-3.5 flex-1">
              <View className={`w-12 h-12 rounded-2xl items-center justify-center ${getCategoryBg(item.category)}`}>
                <Text className="text-2xl">{getCategoryEmoji(item.category)}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-black text-slate-800" numberOfLines={1}>
                  {item.merchant ?? "Unspecified Merchant"}
                </Text>
                <Text className="text-[10px] text-slate-400 mt-0.5 font-bold uppercase tracking-wider">
                  {item.category ?? "Uncategorized"}
                </Text>
              </View>
            </View>
            <View className="items-end ml-4">
              <Text className="text-sm font-black text-slate-900">
                -{formatMoneyVnd(item.amount)}
              </Text>
              <Text className="text-[9px] text-slate-400 mt-0.5">
                {item.note ? (item.note.length > 15 ? `${item.note.slice(0, 15)}...` : item.note) : "No note"}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="mt-6 items-center py-10 px-6 bg-white border border-slate-100 rounded-3xl shadow-sm">
            <View className="w-16 h-16 rounded-full bg-slate-50 items-center justify-center mb-3">
              <Ionicons name="receipt-outline" size={28} color="#94a3b8" />
            </View>
            <Text className="text-sm font-black text-slate-800">No expenses logged today</Text>
            <Text className="text-xs text-slate-400 text-center mt-1">
              Say, upload, or write some transactions using the shortcuts above!
            </Text>
          </View>
        }
      />
    </View>
  );
}
