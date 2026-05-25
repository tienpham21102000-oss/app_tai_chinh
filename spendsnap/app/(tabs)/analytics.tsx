import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { ensureDbReady, getSetting } from "../../services/db";
import { useTransactionsStore } from "../../stores/transactions";
import { formatMoneyVnd } from "../../utils/money";
import { generateYearOfSpending } from "../../utils/simulate";

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

const CATEGORY_ORDER = ["Food", "Drinks", "Travel", "Shopping", "Entertainment", "Bills", "Others"] as const;
const CATEGORY_HEX_COLORS: Record<string, string> = {
  Food: "#f97316",
  Drinks: "#d97706",
  Travel: "#0ea5e9",
  Shopping: "#a855f7",
  Entertainment: "#f43f5e",
  Bills: "#10b981",
  Others: "#94a3b8",
};
const CATEGORY_TAILWIND_COLORS: Record<string, string> = {
  Food: "bg-orange-500",
  Drinks: "bg-amber-500",
  Travel: "bg-sky-500",
  Shopping: "bg-purple-500",
  Entertainment: "bg-rose-500",
  Bills: "bg-emerald-500",
  Others: "bg-slate-400",
};
const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export default function AnalyticsScreen() {
  const { transactions, refreshAll, seedDummyTransactions } = useTransactionsStore();
  const [monthlyBudget, setMonthlyBudget] = useState<number>(DEFAULT_BUDGET);
  const [isSeeding, setIsSeeding] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [visibleCategories, setVisibleCategories] = useState<Record<string, boolean>>({
    Food: true,
    Drinks: true,
    Travel: true,
    Shopping: true,
    Entertainment: true,
    Bills: true,
    Others: true,
  });

  const monthlyTransactions = useMemo(() => {
    const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
    return transactions.filter((t) => {
      const txDate = new Date(t.date);
      return !Number.isNaN(txDate.getTime()) && txDate >= monthStart && txDate <= monthEnd;
    });
  }, [transactions, selectedMonth]);

  // Normalize category
  const normalizeCategory = (raw: string): string => {
    const norm = raw.toLowerCase();
    if (norm.includes("phở") || norm.includes("ăn") || norm.includes("food") || norm.includes("lunch") || norm.includes("dinner")) return "Food";
    if (norm.includes("cf") || norm.includes("coffee") || norm.includes("cà phê") || norm.includes("highlands") || norm.includes("starbucks") || norm.includes("trà sữa")) return "Drinks";
    if (norm.includes("grab") || norm.includes("taxi") || norm.includes("xe") || norm.includes("di chuyển") || norm.includes("transport")) return "Travel";
    if (norm.includes("mua") || norm.includes("shop") || norm.includes("lazada") || norm.includes("shopee") || norm.includes("quần áo")) return "Shopping";
    if (norm.includes("phim") || norm.includes("chơi") || norm.includes("nhạc") || norm.includes("entertainment") || norm.includes("game")) return "Entertainment";
    if (norm.includes("điện") || norm.includes("nước") || norm.includes("bill") || norm.includes("internet")) return "Bills";
    return "Others";
  };

  // Daily breakdown by category for the selected month
  const dailyCategoryBreakdown = useMemo(() => {
    const dayMap: Record<string, Record<string, number>> = {};
    const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split("T")[0];
      dayMap[key] = { Food: 0, Drinks: 0, Travel: 0, Shopping: 0, Entertainment: 0, Bills: 0, Others: 0 };
    }
    monthlyTransactions.forEach((t) => {
      const dateKey = t.date.split("T")[0];
      if (!dayMap[dateKey]) return;
      const cat = normalizeCategory(t.category || "Others");
      dayMap[dateKey][cat] = (dayMap[dateKey][cat] || 0) + t.amount;
    });
    return dayMap;
  }, [monthlyTransactions, selectedMonth]);

  // Calendar layout for selected month (up to 5 weeks × 7 days)
  const calendarWeeks = useMemo(() => {
    const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
    const firstDayOfWeek = monthStart.getDay();
    const mondayIndex = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const weeks: Array<Array<{ date: Date; isCurrentMonth: boolean; dayStr: string }>> = [];
    let week: Array<{ date: Date; isCurrentMonth: boolean; dayStr: string }> = [];
    const prevMonthEnd = new Date(monthStart);
    prevMonthEnd.setDate(0);
    for (let i = mondayIndex - 1; i >= 0; i -= 1) {
      const date = new Date(prevMonthEnd);
      date.setDate(prevMonthEnd.getDate() - i);
      week.push({ date, isCurrentMonth: false, dayStr: date.toISOString().split("T")[0] });
    }
    for (let day = 1; day <= monthEnd.getDate(); day += 1) {
      const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);
      week.push({ date, isCurrentMonth: true, dayStr: date.toISOString().split("T")[0] });
      if (week.length === 7) { weeks.push(week); week = []; }
    }
    if (week.length > 0) {
      let nextDay = 1;
      while (week.length < 7) {
        const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, nextDay);
        week.push({ date, isCurrentMonth: false, dayStr: date.toISOString().split("T")[0] });
        nextDay += 1;
      }
      weeks.push(week);
    }
    return weeks;
  }, [selectedMonth]);

  // Max single-category amount for shared ylim
  const maxCategoryAmount = useMemo(() => {
    let max = 0;
    Object.values(dailyCategoryBreakdown).forEach((breakdown) => {
      Object.entries(breakdown)
        .filter(([cat]) => visibleCategories[cat])
        .forEach(([, amount]) => { if (amount > max) max = amount; });
    });
    return Math.max(max, 50000);
  }, [dailyCategoryBreakdown, visibleCategories]);

  // Weekly totals per category
  const weeklyCategoryTotals = useMemo(() => {
    const totals: Array<Record<string, number>> = [];
    const maxWeeks = 5;
    for (let w = 0; w < maxWeeks; w += 1) {
      totals.push({ Food: 0, Drinks: 0, Travel: 0, Shopping: 0, Entertainment: 0, Bills: 0, Others: 0 });
    }
    calendarWeeks.slice(0, maxWeeks).forEach((week, wi) => {
      week.forEach((day) => {
        const breakdown = dailyCategoryBreakdown[day.dayStr];
        if (!breakdown) return;
        CATEGORY_ORDER.forEach((cat) => {
          totals[wi][cat] += breakdown[cat] || 0;
        });
      });
    });
    return totals;
  }, [calendarWeeks, dailyCategoryBreakdown]);

  // Weekly totals (all categories)
  const weeklyTotals = useMemo(() => {
    return weeklyCategoryTotals.map((wc) => Object.values(wc).reduce((s, v) => s + v, 0));
  }, [weeklyCategoryTotals]);

  // Aggregate expenditures by categories
  const categorySummary = useMemo(() => {
    const map: Record<string, number> = {};
    let total = 0;
    monthlyTransactions.forEach((t) => {
      const cat = normalizeCategory(t.category || "Other");
      map[cat] = (map[cat] || 0) + t.amount;
      total += t.amount;
    });
    const list = Object.keys(map).map((name) => {
      const amount = map[name];
      const percentage = total > 0 ? Math.round((amount / total) * 100) : 0;
      return { name, amount, percentage };
    });
    list.sort((a, b) => b.amount - a.amount);
    return { list, total };
  }, [monthlyTransactions]);

  const budgetSpentPercent = useMemo(() => {
    if (categorySummary.total === 0) return 0;
    return Math.min(100, Math.round((categorySummary.total / monthlyBudget) * 100));
  }, [categorySummary.total, monthlyBudget]);

  const remainingBudget = Math.max(0, monthlyBudget - categorySummary.total);
  const mainExpenseCategory = useMemo(() => {
    if (categorySummary.list.length === 0) return null;
    return categorySummary.list[0];
  }, [categorySummary.list]);

  const handleSeedDemoData = () => {
    setIsSeeding(true);
    try { seedDummyTransactions(generateYearOfSpending()); } finally { setIsSeeding(false); }
  };

  useEffect(() => { void refreshAll(); }, [refreshAll]);

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      try {
        await ensureDbReady();
        const v = await getSetting(BUDGET_KEY);
        const n = v ? Number(v) : DEFAULT_BUDGET;
        if (!active) return;
        setMonthlyBudget(Number.isFinite(n) ? n : DEFAULT_BUDGET);
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, []));

  const maxWeeks = Math.min(calendarWeeks.length, 5);

  return (
    <ScrollView className="flex-1 bg-[#f8fafc] px-4 pt-14" showsVerticalScrollIndicator={false}>
      <Text className="text-2xl font-black text-slate-900 mb-5 tracking-tight">Financial Analytics</Text>

      {/* Month Selector */}
      <View className="flex-row justify-between items-center mb-6 bg-white border border-slate-100 rounded-3xl p-4 shadow-md">
        <Pressable onPress={() => { const prev = new Date(selectedMonth); prev.setMonth(prev.getMonth() - 1); setSelectedMonth(prev); }} className="p-2 rounded-lg active:bg-slate-100">
          <Ionicons name="chevron-back" size={24} color="#334155" />
        </Pressable>
        <Text className="text-lg font-black text-slate-900">
          {selectedMonth.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}
        </Text>
        <Pressable onPress={() => { const next = new Date(selectedMonth); next.setMonth(next.getMonth() + 1); setSelectedMonth(next); }} className="p-2 rounded-lg active:bg-slate-100">
          <Ionicons name="chevron-forward" size={24} color="#334155" />
        </Pressable>
      </View>

      {/* Category Toggles */}
      <View className="mb-6 bg-white border border-slate-100 rounded-3xl p-4 shadow-md">
        <Text className="text-xs font-bold text-slate-400 uppercase mb-3">Hiển thị danh mục</Text>
        <View className="flex-wrap flex-row gap-2">
          {CATEGORY_ORDER.map((cat) => (
            <Pressable key={cat} onPress={() => setVisibleCategories({ ...visibleCategories, [cat]: !visibleCategories[cat] })}
              className={`px-3 py-2 rounded-full border ${visibleCategories[cat] ? "bg-indigo-100 border-indigo-300" : "bg-slate-50 border-slate-200"}`}>
              <Text className={`text-xs font-bold ${visibleCategories[cat] ? "text-indigo-700" : "text-slate-500"}`}>{cat}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Demo Data Button */}
      <Pressable onPress={handleSeedDemoData} disabled={isSeeding} className="mb-6 rounded-3xl bg-slate-900 px-4 py-3 items-center">
        <Text className="text-sm font-black text-white">{isSeeding ? "Đang tạo dữ liệu mô phỏng..." : "Tạo dữ liệu chi tiêu 1 năm"}</Text>
      </Pressable>

      {/* Monthly Budget Summary Progress Card */}
      <View className="bg-white border border-slate-100 rounded-3xl p-5 shadow-lg mb-6 relative overflow-hidden">
        <View className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-indigo-500/5 blur-lg" />
        <View className="flex-row justify-between items-center mb-4">
          <View>
            <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Remaining Budget</Text>
            <Text className="text-2xl font-black text-slate-900 mt-1">{formatMoneyVnd(remainingBudget)}</Text>
          </View>
          <View className="bg-indigo-50 px-3 py-1.5 rounded-2xl border border-indigo-100">
            <Text className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">{budgetSpentPercent}% Spent</Text>
          </View>
        </View>
        <View className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden mb-3">
          <View style={{ width: `${budgetSpentPercent}%` }} className="h-full bg-indigo-600 rounded-full" />
        </View>
        <View className="flex-row justify-between items-center">
          <Text className="text-[10px] font-bold text-slate-400">Spent: {formatMoneyVnd(categorySummary.total)}</Text>
          <Text className="text-[10px] font-bold text-slate-400">Total Limit: {formatMoneyVnd(monthlyBudget)}</Text>
        </View>
      </View>

      {/* WEEKLY CATEGORY BAR CHART GRID - DẠNG BẢNG */}
      <Text className="text-base font-black text-slate-800 mb-4 tracking-tight">Chi tiêu theo tuần</Text>
      <View className="bg-white border border-slate-100 rounded-3xl p-4 shadow-md mb-6">
        <View style={{ borderWidth: 0.5, borderColor: '#e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
          {/* Header: Thứ */}
          <View style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0' }}>
            {WEEKDAY_LABELS.map((label, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 4, borderRightWidth: i < 6 ? 0.5 : 0, borderRightColor: '#e2e8f0' }}>
                <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
              </View>
            ))}
          </View>
          {/* Các dòng tuần */}
          {calendarWeeks.slice(0, 5).map((week, weekIndex) => (
            <View key={weekIndex} style={{ flexDirection: 'row', borderBottomWidth: weekIndex < maxWeeks - 1 ? 0.5 : 0, borderBottomColor: '#e2e8f0' }}>
              {week.map((day, dayIndex) => {
                const breakdown = dailyCategoryBreakdown[day.dayStr] || {};
                const totalDay = Object.entries(breakdown).filter(([cat]) => visibleCategories[cat]).reduce((sum, [, v]) => sum + v, 0);
                const visibleCats = CATEGORY_ORDER.filter((cat) => visibleCategories[cat] && (breakdown[cat] || 0) > 0);
                const dayHasSpending = totalDay > 0 && visibleCats.length > 0;
                return (
                  <View key={dayIndex} style={{ flex: 1, padding: 2, borderRightWidth: dayIndex < 6 ? 0.5 : 0, borderRightColor: '#e2e8f0', backgroundColor: day.isCurrentMonth ? 'white' : '#f8fafc' }}>
                    {/* Ghi chú tuần ở đầu mỗi dòng */}
                    {dayIndex === 0 && (
                      <Text style={{ fontSize: 6, fontWeight: 'bold', color: '#6366f1', marginBottom: 1 }}>Tuần {weekIndex + 1}/{maxWeeks}</Text>
                    )}
                    <Text style={{ fontSize: 9, fontWeight: 'bold', textAlign: 'center', marginBottom: 2, color: day.isCurrentMonth ? (dayHasSpending ? '#1e293b' : '#94a3b8') : '#cbd5e1' }}>
                      {day.date.getDate()}
                    </Text>
                    <View style={{ height: 60, justifyContent: 'flex-end', alignItems: 'center' }}>
                      {dayHasSpending && (
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 2 }}>
                          {visibleCats.map((cat) => {
                            const amount = breakdown[cat] || 0;
                            const pct = maxCategoryAmount > 0 ? (amount / maxCategoryAmount) : 0;
                            const barHeightPx = Math.max(pct * 50, 4);
                            return (
                              <View key={cat} style={{ alignItems: 'center' }}>
                                <View style={{ height: barHeightPx, width: 20, borderRadius: 2, backgroundColor: CATEGORY_HEX_COLORS[cat], justifyContent: 'center', alignItems: 'center' }}>
                                  {/* Luôn hiển thị số tiền */}
                                  <Text style={{ fontSize: 5, fontWeight: 'bold', color: 'white', textAlign: 'center', lineHeight: 6 }}>
                                    {amount >= 1000000
                                      ? `${(amount / 1000000).toFixed(1)}tr`
                                      : amount >= 1000
                                        ? `${Math.round(amount / 1000)}k`
                                        : `${amount}`}
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* Category color legend */}
        <View className="mt-4 pt-3 border-t border-slate-100">
          <Text className="text-[9px] font-bold text-slate-400 uppercase mb-2">Chú thích</Text>
          <View className="flex-row flex-wrap gap-x-4 gap-y-1.5">
            {CATEGORY_ORDER.filter((cat) => visibleCategories[cat]).map((cat) => (
              <View key={cat} className="flex-row items-center gap-1.5">
                <View className={`w-2.5 h-2.5 rounded-sm ${CATEGORY_TAILWIND_COLORS[cat]}`} />
                <Text className="text-[9px] font-bold text-slate-600">{cat}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* CATEGORY BREAKDOWN - CÓ CHIA THEO TUẦN */}
      <Text className="text-base font-black text-slate-800 mb-4 tracking-tight">Category Breakdown</Text>

      {categorySummary.list.length === 0 ? (
        <View className="items-center py-12 px-6 bg-white border border-slate-100 rounded-3xl shadow-sm mb-6">
          <View className="w-16 h-16 rounded-full bg-slate-50 items-center justify-center mb-3">
            <Ionicons name="pie-chart-outline" size={28} color="#94a3b8" />
          </View>
          <Text className="text-sm font-black text-slate-800">No data to analyze</Text>
          <Text className="text-xs text-slate-400 text-center mt-1">Log some transactions first to generate dynamic statistics!</Text>
        </View>
      ) : (
        <View className="bg-white border border-slate-100 rounded-3xl p-5 shadow-md mb-6">
          {/* Tìm category lớn nhất để làm tỉ lệ */}
          {(() => {
            const maxTotal = Math.max(...categorySummary.list.map((c) => c.amount), 1);
            return categorySummary.list.map((c, catIndex) => {
              // Tính tổng category này theo từng tuần
              const weeklyBreakdown = weeklyCategoryTotals.map((wc) => wc[c.name] || 0);
              const catTotal = weeklyBreakdown.reduce((s, v) => s + v, 0);
              
              // Chiều rộng bar = tỉ lệ so với category lớn nhất
              const barWidthPct = Math.max((catTotal / maxTotal) * 100, 5);
              
              // Màu nền cho category này
              const catHex = CATEGORY_HEX_COLORS[c.name] || '#6366f1';
              
              // Tạo 5 biến thể màu từ đậm đến nhạt dựa trên màu category
              const generateShades = (hex: string, count: number): string[] => {
                const r = parseInt(hex.slice(1,3), 16);
                const g = parseInt(hex.slice(3,5), 16);
                const b = parseInt(hex.slice(5,7), 16);
                const shades: string[] = [];
                for (let i = 0; i < count; i++) {
                  const nr = Math.min(255, Math.round(r + (255 - r) * (i / count) * 0.6));
                  const ng = Math.min(255, Math.round(g + (255 - g) * (i / count) * 0.6));
                  const nb = Math.min(255, Math.round(b + (255 - b) * (i / count) * 0.6));
                  shades.push(`rgb(${nr},${ng},${nb})`);
                }
                return shades;
              };
              const WEEK_SEG_COLORS = generateShades(catHex, 5);
              
              // Chuẩn bị segments cho thanh ngang chia theo tuần
              const segments = weeklyBreakdown.map((amount, wi) => ({
                week: wi + 1,
                amount,
                pct: catTotal > 0 ? (amount / catTotal) * 100 : 0,
                color: WEEK_SEG_COLORS[wi],
              })).filter((s) => s.amount > 0);
              
              return (
                <View key={c.name} className="mb-5 last:mb-0">
                  <View className="flex-row justify-between items-center mb-2">
                    <View className="flex-row items-center gap-2.5">
                      <View className={`w-9 h-9 rounded-xl items-center justify-center ${getCategoryBg(c.name)}`}>
                        <Text className="text-lg">{getCategoryEmoji(c.name)}</Text>
                      </View>
                      <View>
                        <Text className="text-xs font-black text-slate-800 uppercase tracking-wide">{c.name}</Text>
                        <Text className="text-[9px] text-slate-400">{c.percentage}% tổng chi tiêu</Text>
                      </View>
                    </View>
                    <Text className="text-xs font-black text-slate-800">{formatMoneyVnd(catTotal)}</Text>
                  </View>
                  {/* Thanh tỉ lệ với màu chia theo tuần */}
                  <View className="w-full bg-slate-100 rounded-lg overflow-hidden" style={{ height: 32 }}>
                    <View style={{ width: `${barWidthPct}%`, height: '100%', flexDirection: 'row', overflow: 'hidden', borderRadius: 8 }}>
                      {segments.length > 0 ? (
                        segments.map((seg) => (
                          <View key={seg.week} style={{ width: `${seg.pct}%`, height: '100%', backgroundColor: seg.color, justifyContent: 'center', alignItems: 'center' }}>
                            {seg.pct > 10 && (
                              <Text style={{ fontSize: 8, fontWeight: 'bold', color: 'white' }}>{formatMoneyVnd(seg.amount)}</Text>
                            )}
                          </View>
                        ))
                      ) : (
                        <View style={{ width: '100%', height: '100%', backgroundColor: catHex, borderRadius: 8 }} />
                      )}
                    </View>
                  </View>
                  {/* Chú thích màu tuần */}
                  {segments.length > 0 && (
                    <View className="flex-row flex-wrap gap-x-4 gap-y-1.5 mt-1.5">
                      {segments.map((seg) => (
                        <View key={seg.week} className="flex-row items-center gap-1.5">
                          <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: seg.color }} />
                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#475569' }}>Tuần {seg.week}: {formatMoneyVnd(seg.amount)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            });
          })()}
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