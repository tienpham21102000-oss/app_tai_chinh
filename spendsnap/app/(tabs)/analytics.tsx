import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { ensureDbReady, getSetting } from "../../services/db";
import { useTransactionsStore } from "../../stores/transactions";
import { useI18n } from "../../utils/i18n";
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
  Food: "#f97316", Drinks: "#d97706", Travel: "#0ea5e9",
  Shopping: "#a855f7", Entertainment: "#f43f5e", Bills: "#10b981", Others: "#94a3b8",
};
const CATEGORY_TAILWIND_COLORS: Record<string, string> = {
  Food: "bg-orange-500", Drinks: "bg-amber-500", Travel: "bg-sky-500",
  Shopping: "bg-purple-500", Entertainment: "bg-rose-500", Bills: "bg-emerald-500", Others: "bg-slate-400",
};
const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTH_LABELS = ["1","2","3","4","5","6","7","8","9","10","11","12"];

function normalizeCategory(raw: string): string {
  const norm = raw.toLowerCase();
  if (norm.includes("phở") || norm.includes("ăn") || norm.includes("food") || norm.includes("lunch") || norm.includes("dinner")) return "Food";
  if (norm.includes("cf") || norm.includes("coffee") || norm.includes("cà phê") || norm.includes("highlands") || norm.includes("starbucks") || norm.includes("trà sữa")) return "Drinks";
  if (norm.includes("grab") || norm.includes("taxi") || norm.includes("xe") || norm.includes("di chuyển") || norm.includes("transport")) return "Travel";
  if (norm.includes("mua") || norm.includes("shop") || norm.includes("lazada") || norm.includes("shopee") || norm.includes("quần áo")) return "Shopping";
  if (norm.includes("phim") || norm.includes("chơi") || norm.includes("nhạc") || norm.includes("entertainment") || norm.includes("game")) return "Entertainment";
  if (norm.includes("điện") || norm.includes("nước") || norm.includes("bill") || norm.includes("internet")) return "Bills";
  return "Others";
}

function categoryLabel(category: string, t: (key: any) => string): string {
  if (category === "Food") return t("food");
  if (category === "Drinks") return t("drinks");
  if (category === "Travel") return t("travel");
  if (category === "Shopping") return t("shop");
  if (category === "Entertainment") return t("fun");
  if (category === "Bills") return t("bills");
  return t("categories");
}

type ViewMode = "month" | "year";

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = (angle - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

function generateShades(hex: string, count: number): string[] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const shades: string[] = [];
  for (let i = 0; i < count; i++) {
    const nr = Math.min(255, Math.round(r + (255 - r) * (i / count) * 0.6));
    const ng = Math.min(255, Math.round(g + (255 - g) * (i / count) * 0.6));
    const nb = Math.min(255, Math.round(b + (255 - b) * (i / count) * 0.6));
    shades.push(`rgb(${nr},${ng},${nb})`);
  }
  return shades;
}

function safeDateKey(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function YearCategoryPie({
  categories,
  total,
  totalLabel,
  spentLabel,
  labelForCategory,
}: {
  categories: Array<{ name: string; amount: number; percentage: number }>;
  total: number;
  totalLabel: string;
  spentLabel: string;
  labelForCategory: (category: string) => string;
}) {
  return (
    <View>
      <View className="items-center mb-5">
        <View className="relative items-center justify-center" style={{ width: 220, height: 220 }}>
          <Svg width={220} height={220} viewBox="0 0 220 220">
            {categories.length === 1 ? (
              <Circle cx={110} cy={110} r={98} fill={CATEGORY_HEX_COLORS[categories[0].name] || "#6366f1"} />
            ) : (
              (() => {
                let startAngle = 0;
                return categories.map((c) => {
                  const angle = (c.amount / Math.max(total, 1)) * 360;
                  const endAngle = startAngle + angle;
                  const path = describeSlice(110, 110, 98, startAngle, endAngle);
                  startAngle = endAngle;
                  return (
                    <Path
                      key={c.name}
                      d={path}
                      fill={CATEGORY_HEX_COLORS[c.name] || "#6366f1"}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  );
                });
              })()
            )}
            <Circle cx={110} cy={110} r={54} fill="#ffffff" />
          </Svg>
          <View className="absolute items-center px-4">
            <Text className="text-[10px] font-black text-slate-900 uppercase tracking-wider text-center">{totalLabel}</Text>
            <Text className="text-lg font-black text-slate-900 mt-1">{formatMoneyVnd(total)}</Text>
          </View>
        </View>
      </View>
      {categories.map((c) => (
        <View key={c.name} className="mb-3 last:mb-0 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2.5 flex-1">
            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: CATEGORY_HEX_COLORS[c.name] || "#6366f1" }} />
            <View className="flex-1">
              <Text className="text-xs font-black text-slate-800 uppercase tracking-wide">{labelForCategory(c.name)}</Text>
              <Text className="text-[9px] text-slate-400">{c.percentage}% {spentLabel}</Text>
            </View>
          </View>
          <Text className="text-xs font-black text-slate-800">{formatMoneyVnd(c.amount)}</Text>
        </View>
      ))}
    </View>
  );
}

export default function AnalyticsScreen() {
  const { transactions, refreshAll, seedDummyTransactions } = useTransactionsStore();
  const { t, language } = useI18n();
  const [monthlyBudget, setMonthlyBudget] = useState<number>(DEFAULT_BUDGET);
  const [isSeeding, setIsSeeding] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [visibleCategories, setVisibleCategories] = useState<Record<string, boolean>>({
    Food: true, Drinks: true, Travel: true,
    Shopping: true, Entertainment: true, Bills: true, Others: true,
  });
  const [chartWidth, setChartWidth] = useState(0);
  const [tooltip, setTooltip] = useState<{ x: number, y: number, text: string } | null>(null);

  const activeCats = useMemo(() => CATEGORY_ORDER.filter((cat) => visibleCategories[cat]), [visibleCategories]);

  // Monthly data
  const monthlyTransactions = useMemo(() => {
    const ms = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    const me = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
    return transactions.filter((t) => {
      const d = new Date(t.date ?? t.created_at ?? "");
      return !Number.isNaN(d.getTime()) && d >= ms && d <= me;
    });
  }, [transactions, selectedMonth]);

  const dailyCategoryBreakdown = useMemo(() => {
    const dm: Record<string, Record<string, number>> = {};
    const ms = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    const me = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
    for (let d = new Date(ms); d <= me; d.setDate(d.getDate() + 1)) {
      dm[d.toISOString().split("T")[0]] = { Food: 0, Drinks: 0, Travel: 0, Shopping: 0, Entertainment: 0, Bills: 0, Others: 0 };
    }
    monthlyTransactions.forEach((t) => {
      const k = safeDateKey(t.date ?? t.created_at);
      if (!k || !dm[k]) return;
      dm[k][normalizeCategory(t.category || "Others")] += t.amount;
    });
    return dm;
  }, [monthlyTransactions, selectedMonth]);

  const calendarWeeks = useMemo(() => {
    const ms = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    const me = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
    const mi = ms.getDay() === 0 ? 6 : ms.getDay() - 1;
    const w: Array<Array<{ date: Date; isCurrentMonth: boolean; dayStr: string }>> = [];
    let wk: Array<{ date: Date; isCurrentMonth: boolean; dayStr: string }> = [];
    const pm = new Date(ms); pm.setDate(0);
    for (let i = mi - 1; i >= 0; i--) { const d = new Date(pm); d.setDate(pm.getDate() - i); wk.push({ date: d, isCurrentMonth: false, dayStr: d.toISOString().split("T")[0] }); }
    for (let d = 1; d <= me.getDate(); d++) { const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), d); wk.push({ date, isCurrentMonth: true, dayStr: date.toISOString().split("T")[0] }); if (wk.length === 7) { w.push(wk); wk = []; } }
    if (wk.length > 0) { let nd = 1; while (wk.length < 7) { const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, nd); wk.push({ date, isCurrentMonth: false, dayStr: date.toISOString().split("T")[0] }); nd++; } w.push(wk); }
    return w;
  }, [selectedMonth]);

  const maxCategoryAmount = useMemo(() => {
    let mx = 0;
    Object.values(dailyCategoryBreakdown).forEach((b) => Object.entries(b).filter(([c]) => visibleCategories[c]).forEach(([, v]) => { if (v > mx) mx = v; }));
    return Math.max(mx, 50000);
  }, [dailyCategoryBreakdown, visibleCategories]);

  // Yearly data
  const yearlyTransactions = useMemo(() => {
    const ys = new Date(selectedYear, 0, 1);
    const ye = new Date(selectedYear, 11, 31);
    return transactions.filter((t) => {
      const d = new Date(t.date ?? t.created_at ?? "");
      return !Number.isNaN(d.getTime()) && d >= ys && d <= ye;
    });
  }, [transactions, selectedYear]);

  const monthlyCategoryBreakdown = useMemo(() => {
    const mm: Record<string, Record<string, number>> = {};
    for (let m = 0; m < 12; m++) mm[`${selectedYear}-${String(m + 1).padStart(2, "0")}`] = { Food: 0, Drinks: 0, Travel: 0, Shopping: 0, Entertainment: 0, Bills: 0, Others: 0 };
    yearlyTransactions.forEach((t) => {
      const d = new Date(t.date ?? t.created_at ?? "");
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!mm[k]) return;
      mm[k][normalizeCategory(t.category || "Others")] += t.amount;
    });
    return mm;
  }, [yearlyTransactions, selectedYear]);

  // Shared
  const categorySummary = useMemo(() => {
    const mp: Record<string, number> = {}; let tot = 0;
    const src = viewMode === "month" ? monthlyTransactions : yearlyTransactions;
    src.forEach((t) => { const c = normalizeCategory(t.category || "Other"); mp[c] = (mp[c] || 0) + t.amount; tot += t.amount; });
    const lst = Object.keys(mp).map((n) => ({ name: n, amount: mp[n], percentage: tot > 0 ? Math.round((mp[n] / tot) * 100) : 0 }));
    lst.sort((a, b) => b.amount - a.amount);
    return { list: lst, total: tot };
  }, [monthlyTransactions, yearlyTransactions, viewMode]);

  const budgetSpentPercent = useMemo(() => {
    if (!monthlyBudget || monthlyBudget <= 0) return 0;
    return Math.round((categorySummary.total / monthlyBudget) * 100);
  }, [categorySummary.total, monthlyBudget]);
  const budgetLinePercent = Math.min(100, Math.max(0, budgetSpentPercent));
  const remainingBudget = monthlyBudget - categorySummary.total;
  const isOverBudget = remainingBudget < 0;
  const mainExpenseCategory = useMemo(() => categorySummary.list.length === 0 ? null : categorySummary.list[0], [categorySummary.list]);

  const weeklyCategoryTotals = useMemo(() => {
    const t: Array<Record<string, number>> = [];
    for (let w = 0; w < 5; w++) t.push({ Food: 0, Drinks: 0, Travel: 0, Shopping: 0, Entertainment: 0, Bills: 0, Others: 0 });
    calendarWeeks.slice(0, 5).forEach((wk, wi) => wk.forEach((d) => { const b = dailyCategoryBreakdown[d.dayStr]; if (!b) return; CATEGORY_ORDER.forEach((c) => { t[wi][c] += b[c] || 0; }); }));
    return t;
  }, [calendarWeeks, dailyCategoryBreakdown]);

  const handleSeedDemoData = () => { setIsSeeding(true); try { seedDummyTransactions(generateYearOfSpending()); } finally { setIsSeeding(false); } };
  useEffect(() => { void refreshAll(); }, [refreshAll]);
  useFocusEffect(useCallback(() => { let active = true; (async () => { try { await ensureDbReady(); const v = await getSetting(BUDGET_KEY); const n = v ? Number(v) : DEFAULT_BUDGET; if (!active) return; setMonthlyBudget(isFinite(n) ? n : DEFAULT_BUDGET); } catch {} })(); return () => { active = false; }; }, []));

  const maxWeeks = Math.min(calendarWeeks.length, 5);
  const COL_W = chartWidth > 0 ? (chartWidth - 20) / 12 : 30;
  const LINE_H = 150;

  // Yearly chart data
  const yearlyChartData = useMemo(() => {
    const ac = activeCats;
    const mcd = ac.map((cat) => MONTH_LABELS.map((_, m) => { const k = `${selectedYear}-${String(m + 1).padStart(2, "0")}`; const b = monthlyCategoryBreakdown[k] || {}; return b[cat] || 0; }));
    const maxV = Math.max(1, ...mcd.flat());
    const getY = (val: number, h: number) => h - (val / maxV) * (h - 8);
    return { activeCats: ac, monthCatData: mcd, maxCatValue: maxV, getY };
  }, [activeCats, monthlyCategoryBreakdown, selectedYear]);

  // Toggle a category on/off
  function toggleCategory(cat: string) {
    setVisibleCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  return (
    <ScrollView className="flex-1 bg-[#f8fafc] px-4 pt-14" showsVerticalScrollIndicator={false}>
      <Text className="text-2xl font-black text-slate-900 mb-5 tracking-tight">{t("analytics")}</Text>

      {/* View Mode Toggle */}
      <View className="flex-row mb-6 bg-white border border-slate-100 rounded-3xl p-1 shadow-md">
        <Pressable onPress={() => setViewMode("month")} className={`flex-1 py-2.5 rounded-2xl items-center ${viewMode === "month" ? "bg-indigo-600" : "bg-transparent"}`}>
          <Text className={`text-xs font-black ${viewMode === "month" ? "text-white" : "text-slate-500"}`}>{t("monthView")}</Text>
        </Pressable>
        <Pressable onPress={() => setViewMode("year")} className={`flex-1 py-2.5 rounded-2xl items-center ${viewMode === "year" ? "bg-indigo-600" : "bg-transparent"}`}>
          <Text className={`text-xs font-black ${viewMode === "year" ? "text-white" : "text-slate-500"}`}>{t("yearView")}</Text>
        </Pressable>
      </View>

      {/* Month Selector */}
      {viewMode === "month" && (
        <View className="flex-row justify-between items-center mb-6 bg-white border border-slate-100 rounded-3xl p-4 shadow-md">
          <Pressable onPress={() => { const p = new Date(selectedMonth); p.setMonth(p.getMonth() - 1); setSelectedMonth(p); }} className="p-2 rounded-lg active:bg-slate-100">
            <Ionicons name="chevron-back" size={24} color="#334155" />
          </Pressable>
          <Text className="text-lg font-black text-slate-900">{selectedMonth.toLocaleDateString(language === "vi" ? "vi-VN" : "en-US", { month: "long", year: "numeric" })}</Text>
          <Pressable onPress={() => { const n = new Date(selectedMonth); n.setMonth(n.getMonth() + 1); setSelectedMonth(n); }} className="p-2 rounded-lg active:bg-slate-100">
            <Ionicons name="chevron-forward" size={24} color="#334155" />
          </Pressable>
        </View>
      )}

      {/* Year Selector */}
      {viewMode === "year" && (
        <View className="flex-row justify-between items-center mb-6 bg-white border border-slate-100 rounded-3xl p-4 shadow-md">
          <Pressable onPress={() => setSelectedYear((y) => y - 1)} className="p-2 rounded-lg active:bg-slate-100">
            <Ionicons name="chevron-back" size={24} color="#334155" />
          </Pressable>
          <Text className="text-lg font-black text-slate-900">{language === "vi" ? `Năm ${selectedYear}` : selectedYear}</Text>
          <Pressable onPress={() => setSelectedYear((y) => y + 1)} className="p-2 rounded-lg active:bg-slate-100">
            <Ionicons name="chevron-forward" size={24} color="#334155" />
          </Pressable>
        </View>
      )}

      {/* Budget card — month view only */}
      {viewMode === "month" && (
        <View className="bg-white border border-slate-100 rounded-3xl p-5 shadow-lg mb-6 relative overflow-hidden">
          <View className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-indigo-500/5 blur-lg" />
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("remainingBudget")}</Text>
              <Text className={`text-2xl font-black mt-1 ${isOverBudget ? "text-rose-600" : "text-slate-900"}`}>{formatMoneyVnd(remainingBudget)}</Text>
            </View>
            <View className={`px-3 py-1.5 rounded-2xl border ${isOverBudget ? "bg-rose-50 border-rose-100" : "bg-emerald-50 border-emerald-100"}`}>
              <Text className={`text-[10px] font-black uppercase tracking-wider ${isOverBudget ? "text-rose-600" : "text-emerald-600"}`}>{budgetSpentPercent}% {t("spent")}</Text>
            </View>
          </View>
          <View className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden mb-3">
            <View
              style={{ width: `${budgetLinePercent}%`, backgroundColor: isOverBudget ? "#ef4444" : "#10b981" }}
              className="h-full rounded-full"
            />
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-[10px] font-bold text-slate-400">{t("spent")}: {formatMoneyVnd(categorySummary.total)}</Text>
            <Text className="text-[10px] font-bold text-slate-400">{t("totalLimit")}: {formatMoneyVnd(monthlyBudget)}</Text>
          </View>
        </View>
      )}

      {/* ── MONTHLY VIEW ── */}
      {viewMode === "month" && (
        <>
          <Text className="text-base font-black text-slate-800 mb-4 tracking-tight">{t("weekSpending")}</Text>
          <View className="bg-white border border-slate-100 rounded-3xl p-4 shadow-md mb-6">
            <View style={{ borderWidth: 0.5, borderColor: "#e2e8f0", borderRadius: 6, overflow: "hidden" }}>
              {/* Weekday header */}
              <View style={{ flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" }}>
                {WEEKDAY_LABELS.map((l, i) => (
                  <View key={i} style={{ flex: 1, alignItems: "center", paddingVertical: 4, borderRightWidth: i < 6 ? 0.5 : 0, borderRightColor: "#e2e8f0" }}>
                    <Text style={{ fontSize: 8, fontWeight: "bold", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>{l}</Text>
                  </View>
                ))}
              </View>
              {/* Calendar grid */}
              {calendarWeeks.slice(0, 5).map((wk, wi) => (
                <View key={wi} style={{ flexDirection: "row", borderBottomWidth: wi < maxWeeks - 1 ? 0.5 : 0, borderBottomColor: "#e2e8f0" }}>
                  {wk.map((day, di) => {
                    const b = dailyCategoryBreakdown[day.dayStr] || {};
                    const tot = activeCats.reduce((s, c) => s + (b[c] || 0), 0);
                    const visCats = activeCats.filter((c) => (b[c] || 0) > 0);
                    const hasSpending = tot > 0 && visCats.length > 0;
                    return (
                      <View key={di} style={{ flex: 1, padding: 2, borderRightWidth: di < 6 ? 0.5 : 0, borderRightColor: "#e2e8f0", backgroundColor: day.isCurrentMonth ? "white" : "#f8fafc" }}>
                        {di === 0 && <Text style={{ fontSize: 6, fontWeight: "bold", color: "#6366f1", marginBottom: 1 }}>T{wi + 1}</Text>}
                        <Text style={{ fontSize: 9, fontWeight: "bold", textAlign: "center", marginBottom: 2, color: day.isCurrentMonth ? (hasSpending ? "#1e293b" : "#94a3b8") : "#cbd5e1" }}>{day.date.getDate()}</Text>
                        <View style={{ height: 50, justifyContent: "flex-end", alignItems: "center" }}>
                          {hasSpending && (
                            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 1 }}>
                              {visCats.map((cat) => {
                                const amt = b[cat] || 0;
                                const h = Math.max((amt / Math.max(maxCategoryAmount, 1)) * 42, 4);
                                return (
                                  <View key={cat} style={{ alignItems: "center" }}>
                                    <View style={{ height: h, width: 16, borderRadius: 1.5, backgroundColor: CATEGORY_HEX_COLORS[cat], justifyContent: "center", alignItems: "center" }}>
                                      <Text style={{ fontSize: 5, fontWeight: "bold", color: "white", textAlign: "center", lineHeight: 6 }}>
                                        {amt >= 1000000 ? `${(amt / 1000000).toFixed(1)}tr` : amt >= 1000 ? `${Math.round(amt / 1000)}k` : `${amt}`}
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

            {/* ── Clickable Legend (replaces standalone toggle panel) ── */}
            <View className="mt-4 pt-3 border-t border-slate-100">
              <Text className="text-[9px] font-bold text-slate-400 uppercase mb-2">{t("legendToggle")}</Text>
              <View className="flex-row flex-wrap gap-x-3 gap-y-2">
                {CATEGORY_ORDER.map((cat) => {
                  const active = visibleCategories[cat];
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => toggleCategory(cat)}
                      className="flex-row items-center gap-1.5 px-2 py-1 rounded-full active:opacity-60"
                      style={{
                        backgroundColor: active ? CATEGORY_HEX_COLORS[cat] + "18" : "#f1f5f9",
                        borderWidth: 1,
                        borderColor: active ? CATEGORY_HEX_COLORS[cat] + "60" : "#e2e8f0",
                      }}
                    >
                      <View
                        style={{
                          width: 10, height: 10, borderRadius: 2,
                          backgroundColor: active ? CATEGORY_HEX_COLORS[cat] : "#cbd5e1",
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 9, fontWeight: "700",
                          color: active ? CATEGORY_HEX_COLORS[cat] : "#94a3b8",
                          textDecorationLine: active ? "none" : "line-through",
                        }}
                      >
                        {categoryLabel(cat, t)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </>
      )}

      {/* ── YEARLY VIEW ── */}
      {viewMode === "year" && (
        <>
          {/* Line chart only — bar chart removed */}
          <Text className="text-base font-black text-slate-800 mb-4 tracking-tight">{t("yearlyTrend")}</Text>
          <View 
            className="bg-white border border-slate-100 rounded-3xl p-4 shadow-md mb-6"
            onLayout={(e) => setChartWidth(e.nativeEvent.layout.width - 32)}
          >
            {chartWidth > 0 && (
              <View style={{ width: "100%", height: LINE_H + 30, position: "relative", marginTop: 10, borderWidth: 0.5, borderColor: "#e2e8f0", borderRadius: 6, overflow: "hidden" }}>
                {/* Y-ticks */}
                {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
                  const val = yearlyChartData.maxCatValue * (1 - r);
                  return (
                    <View key={i} style={{ position: "absolute", left: 0, right: 0, top: r * (LINE_H - 12), height: 0.5, backgroundColor: "#e2e8f0" }}>
                      <Text style={{ position: "absolute", left: 2, top: -10, fontSize: 6, color: "#94a3b8" }}>
                        {formatMoneyVnd(val)}
                      </Text>
                    </View>
                  );
                })}
                {/* Lines and Markers */}
                {yearlyChartData.activeCats.map((cat) => {
                  const ci = yearlyChartData.activeCats.indexOf(cat);
                  const cd = yearlyChartData.monthCatData[ci];
                  const color = CATEGORY_HEX_COLORS[cat];
                  const pts = cd.map((amt, m) => ({ x: 20 + COL_W / 2 + m * COL_W, y: yearlyChartData.getY(amt, LINE_H - 12), amount: amt }));
                  return (
                    <View key={cat}>
                      {pts.map((p, i) => {
                        if (i === 0 || p.amount === 0 || pts[i - 1].amount === 0) return null;
                        const pr = pts[i - 1];
                        const dx = p.x - pr.x, dy = p.y - pr.y;
                        const len = Math.sqrt(dx * dx + dy * dy);
                        const ang = Math.atan2(dy, dx) * (180 / Math.PI);
                        return <View key={`l-${cat}-${i}`} style={{ position: "absolute", left: pr.x, top: pr.y, width: len, height: 1.5, backgroundColor: color, transform: [{ rotate: `${ang}deg` }], transformOrigin: "left center" }} />;
                      })}
                      {pts.map((p, i) =>
                        p.amount > 0 ? (
                          <Pressable
                            key={`marker-${i}`}
                            onPress={() => startTransition(() => setTooltip({ x: p.x, y: p.y, text: `${cat}: ${formatMoneyVnd(p.amount)}` }))}
                            style={{ position: "absolute", left: p.x - 4, top: p.y - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: color, borderWidth: 1, borderColor: "white", zIndex: 10 }}
                          />
                        ) : null
                      )}
                    </View>
                  );
                })}
                {/* X-axis labels */}
                {MONTH_LABELS.map((l, m) => (
                  <View key={m} style={{ position: "absolute", left: 20 + m * COL_W, top: LINE_H, width: COL_W, alignItems: "center" }}>
                    <Text style={{ fontSize: 7, fontWeight: "bold", color: "#94a3b8" }}>{l}</Text>
                  </View>
                ))}
                <Text style={{ position: "absolute", right: 4, top: LINE_H + 14, fontSize: 8, fontWeight: "bold", color: "#64748b" }}>
                  {t("monthAxis")}
                </Text>
                
                {/* Tooltip */}
                {tooltip && (
                  <View style={{ position: "absolute", left: Math.min(tooltip.x - 40, chartWidth - 80), top: Math.max(tooltip.y - 30, 0), backgroundColor: "#1e293b", paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6, zIndex: 50 }}>
                    <Text style={{ fontSize: 9, color: "white", fontWeight: "bold" }}>{tooltip.text}</Text>
                    <Pressable style={{ position: "absolute", top: -5, right: -5, backgroundColor: "#ef4444", borderRadius: 10, width: 14, height: 14, justifyContent: "center", alignItems: "center" }} onPress={() => setTooltip(null)}>
                      <Text style={{ fontSize: 8, color: "white", fontWeight: "bold" }}>✕</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            {/* ── Clickable Legend for year view ── */}
            <View className="mt-4 pt-3 border-t border-slate-100">
              <Text className="text-[9px] font-bold text-slate-400 uppercase mb-2">{t("legendToggle")}</Text>
              <View className="flex-row flex-wrap gap-x-3 gap-y-2">
                {CATEGORY_ORDER.map((cat) => {
                  const active = visibleCategories[cat];
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => toggleCategory(cat)}
                      className="flex-row items-center gap-1.5 px-2 py-1 rounded-full active:opacity-60"
                      style={{
                        backgroundColor: active ? CATEGORY_HEX_COLORS[cat] + "18" : "#f1f5f9",
                        borderWidth: 1,
                        borderColor: active ? CATEGORY_HEX_COLORS[cat] + "60" : "#e2e8f0",
                      }}
                    >
                      <View
                        style={{
                          width: 10, height: 10, borderRadius: 2,
                          backgroundColor: active ? CATEGORY_HEX_COLORS[cat] : "#cbd5e1",
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 9, fontWeight: "700",
                          color: active ? CATEGORY_HEX_COLORS[cat] : "#94a3b8",
                          textDecorationLine: active ? "none" : "line-through",
                        }}
                      >
                        {categoryLabel(cat, t)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </>
      )}

      {/* ── CATEGORY BREAKDOWN (both views) ── */}
      <Text className="text-base font-black text-slate-800 mb-4 tracking-tight">{t("categoryBreakdown")}</Text>
      {categorySummary.list.length === 0 ? (
        <View className="items-center py-12 px-6 bg-white border border-slate-100 rounded-3xl shadow-sm mb-6">
          <View className="w-16 h-16 rounded-full bg-slate-50 items-center justify-center mb-3">
            <Ionicons name="pie-chart-outline" size={28} color="#94a3b8" />
          </View>
          <Text className="text-sm font-black text-slate-800">{t("noData")}</Text>
          <Text className="text-xs text-slate-400 text-center mt-1">{t("noDataHint")}</Text>
        </View>
      ) : viewMode === "month" ? (
        <View className="bg-white border border-slate-100 rounded-3xl p-5 shadow-md mb-6">
          {(() => {
            const mx = Math.max(...categorySummary.list.map((c) => c.amount), 1);
            return categorySummary.list.map((c) => {
              const wb = weeklyCategoryTotals.map((wc) => wc[c.name] || 0);
              const ct = wb.reduce((s, v) => s + v, 0);
              const bw = Math.max((ct / mx) * 100, 5);
              const ch = CATEGORY_HEX_COLORS[c.name] || "#6366f1";
              const sc = generateShades(ch, 5);
              const segs = wb.map((a, i) => ({ week: i + 1, amount: a, pct: ct > 0 ? (a / ct) * 100 : 0, color: sc[i] })).filter((s) => s.amount > 0);
              return (
                <View key={c.name} className="mb-5 last:mb-0">
                  <View className="flex-row justify-between items-center mb-2">
                    <View className="flex-row items-center gap-2.5">
                      <View className={`w-9 h-9 rounded-xl items-center justify-center ${getCategoryBg(c.name)}`}><Text className="text-lg">{getCategoryEmoji(c.name)}</Text></View>
                      <View><Text className="text-xs font-black text-slate-800 uppercase tracking-wide">{categoryLabel(c.name, t)}</Text><Text className="text-[9px] text-slate-400">{c.percentage}% {t("spent")}</Text></View>
                    </View>
                    <Text className="text-xs font-black text-slate-800">{formatMoneyVnd(ct)}</Text>
                  </View>
                  <View className="w-full bg-slate-100 rounded-lg overflow-hidden" style={{ height: 32 }}>
                    <View style={{ width: `${bw}%`, height: "100%", flexDirection: "row", overflow: "hidden", borderRadius: 8 }}>
                      {segs.length > 0 ? segs.map((s) => (
                        <View key={s.week} style={{ width: `${s.pct}%`, height: "100%", backgroundColor: s.color, justifyContent: "center", alignItems: "center" }}>
                          {s.pct > 10 && <Text style={{ fontSize: 8, fontWeight: "bold", color: "white" }}>{formatMoneyVnd(s.amount)}</Text>}
                        </View>
                      )) : <View style={{ width: "100%", height: "100%", backgroundColor: ch, borderRadius: 8 }} />}
                    </View>
                  </View>
                  {segs.length > 0 && (
                    <View className="flex-row flex-wrap gap-x-4 gap-y-1.5 mt-1.5">
                      {segs.map((s) => (
                        <View key={s.week} className="flex-row items-center gap-1.5">
                          <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: s.color }} />
                          <Text style={{ fontSize: 9, fontWeight: "bold", color: "#475569" }}>{t("week")} {s.week}: {formatMoneyVnd(s.amount)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            });
          })()}
        </View>
      ) : (
        <View className="bg-white border border-slate-100 rounded-3xl p-5 shadow-md mb-6">
          <YearCategoryPie
            categories={categorySummary.list}
            total={categorySummary.total}
            totalLabel={t("totalYearSpending")}
            spentLabel={t("spent")}
            labelForCategory={(category) => categoryLabel(category, t)}
          />
          {false && (() => {
            const mx = Math.max(...categorySummary.list.map((c) => c.amount), 1);
            return categorySummary.list.map((c, i) => {
              const barColors = ["bg-indigo-500","bg-emerald-500","bg-amber-500","bg-violet-500","bg-rose-500","bg-sky-500","bg-slate-400"];
              const bw = Math.max((c.amount / mx) * 100, 5);
              return (
                <View key={c.name} className="mb-4 last:mb-0">
                  <View className="flex-row justify-between items-center mb-2">
                    <View className="flex-row items-center gap-2.5">
                      <View className={`w-9 h-9 rounded-xl items-center justify-center ${getCategoryBg(c.name)}`}><Text className="text-lg">{getCategoryEmoji(c.name)}</Text></View>
                      <View><Text className="text-xs font-black text-slate-800 uppercase tracking-wide">{c.name}</Text><Text className="text-[9px] text-slate-400">{c.percentage}% tổng chi tiêu năm {selectedYear}</Text></View>
                    </View>
                    <Text className="text-xs font-black text-slate-800">{formatMoneyVnd(c.amount)}</Text>
                  </View>
                  <View className="w-full h-7 bg-slate-100 rounded-lg overflow-hidden">
                    <View style={{ width: `${bw}%`, height: "100%" }} className={`rounded-lg ${barColors[i % barColors.length]}`} />
                  </View>
                </View>
              );
            });
          })()}
        </View>
      )}

      {/* ── SMART INSIGHTS ── */}
      <Text className="text-base font-black text-slate-800 mb-3 tracking-tight">{t("aiAdvice")}</Text>
      <View className="bg-slate-900 rounded-3xl p-5 shadow-xl relative overflow-hidden mb-12">
        <View className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-indigo-500/20 blur-xl" />
        <View className="flex-row items-start gap-3">
          <View className="w-8 h-8 rounded-full bg-white/10 items-center justify-center mt-0.5 border border-white/10">
            <Ionicons name="sparkles" size={14} color="#a78bfa" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-black text-white tracking-tight">{t("aiAssistantAdvice")}</Text>
            {mainExpenseCategory ? (
              <Text className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                {t("yearlyInsightPrefix")}{" "}
                <Text className="font-black text-indigo-300 uppercase">{categoryLabel(mainExpenseCategory.name, t)}</Text>{" "}
                {viewMode === "month"
                  ? language === "vi"
                    ? `trong tháng ${selectedMonth.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}`
                    : `in ${selectedMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`
                  : language === "vi"
                    ? `trong năm ${selectedYear}`
                    : `in ${selectedYear}`}
                , {t("yearlyInsightMiddle")}{" "}
                <Text className="font-black text-white">{formatMoneyVnd(mainExpenseCategory.amount)}</Text>{" "}
                ({mainExpenseCategory.percentage}% {t("spent")}).{" "}
                {viewMode === "year"
                  ? `${t("yearlyInsightAverage")} ${formatMoneyVnd(Math.round(mainExpenseCategory.amount / 12))}. `
                  : ""}
                {t("yearlyInsightSuffix")}
              </Text>
            ) : (
              <Text className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                {t("welcomeInsight")}
              </Text>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
