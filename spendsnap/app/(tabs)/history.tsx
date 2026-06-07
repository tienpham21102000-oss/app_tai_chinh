import { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { useTransactionsStore } from "../../stores/transactions";
import { useI18n } from "../../utils/i18n";
import { formatMoneyVnd } from "../../utils/money";
import { categoryBgColor, categoryEmoji, categoryLabel } from "../../utils/categories";

function toSafeString(value: unknown): string {
  if (value == null) return "";
  try { return String(value); } catch { return ""; }
}

function getCategoryEmoji(category?: string | null): string {
  try {
    const c = toSafeString(category).toLowerCase();
    if (c.includes("phở") || c.includes("ăn") || c.includes("food") || c.includes("lunch") || c.includes("dinner")) return "🍔";
    if (c.includes("cf") || c.includes("coffee") || c.includes("cà phê") || c.includes("highlands") || c.includes("starbucks") || c.includes("trà sữa")) return "☕";
    if (c.includes("grab") || c.includes("taxi") || c.includes("xe") || c.includes("di chuyển") || c.includes("transport")) return "🚗";
    if (c.includes("mua") || c.includes("shop") || c.includes("lazada") || c.includes("shopee") || c.includes("quần áo")) return "🛍️";
    if (c.includes("phim") || c.includes("chơi") || c.includes("nhạc") || c.includes("entertainment") || c.includes("game")) return "🎬";
    if (c.includes("điện") || c.includes("nước") || c.includes("bill") || c.includes("internet")) return "⚡";
  } catch { /* ignore */ }
  return "📦";
}

function getCategoryBg(category?: string | null): string {
  try {
    const c = toSafeString(category).toLowerCase();
    if (c.includes("phở") || c.includes("ăn") || c.includes("food") || c.includes("lunch") || c.includes("dinner")) return "bg-orange-50";
    if (c.includes("cf") || c.includes("coffee") || c.includes("cà phê") || c.includes("highlands") || c.includes("starbucks") || c.includes("trà sữa")) return "bg-amber-50";
    if (c.includes("grab") || c.includes("taxi") || c.includes("xe") || c.includes("di chuyển") || c.includes("transport")) return "bg-sky-50";
    if (c.includes("mua") || c.includes("shop") || c.includes("lazada") || c.includes("shopee") || c.includes("quần áo")) return "bg-purple-50";
    if (c.includes("phim") || c.includes("chơi") || c.includes("nhạc") || c.includes("entertainment") || c.includes("game")) return "bg-rose-50";
    if (c.includes("điện") || c.includes("nước") || c.includes("bill") || c.includes("internet")) return "bg-emerald-50";
  } catch { /* ignore */ }
  return "bg-slate-100";
}

function getCategoryBgColor(category?: string | null): string {
  const c = toSafeString(category).toLowerCase();
  if (c.includes("food") || c.includes("lunch") || c.includes("dinner")) return "#fff7ed";
  if (c.includes("coffee") || c.includes("drink") || c.includes("highlands") || c.includes("starbucks")) return "#fffbeb";
  if (c.includes("grab") || c.includes("taxi") || c.includes("travel") || c.includes("transport")) return "#f0f9ff";
  if (c.includes("shop") || c.includes("lazada") || c.includes("shopee")) return "#faf5ff";
  if (c.includes("entertainment") || c.includes("game")) return "#fff1f2";
  if (c.includes("bill") || c.includes("internet")) return "#ecfdf5";
  return "#f1f5f9";
}

const CATEGORY_FILTERS = [
  { id: "all",           label: "All",    emoji: "✨" },
  { id: "food",          label: "Food",   emoji: "🍔" },
  { id: "coffee",        label: "Drinks", emoji: "☕" },
  { id: "transport",     label: "Travel", emoji: "🚗" },
  { id: "shopping",      label: "Shop",   emoji: "🛍️" },
  { id: "entertainment", label: "Fun",    emoji: "🎬" },
  { id: "bills",         label: "Bills",  emoji: "⚡" },
  { id: "other",         label: "Others", emoji: "📦" },
];

type DateFilterId = "all" | "week" | "30d" | "custom";
const DATE_FILTERS: Array<{ id: DateFilterId; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: "all",    label: "All",         icon: "calendar-outline" },
  { id: "week",   label: "Week",        icon: "today-outline" },
  { id: "30d",    label: "30d",         icon: "time-outline" },
  { id: "custom", label: "Custom",      icon: "options-outline" },
];

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    marginBottom: 6,
    marginRight: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  categoryChipActive: {
    backgroundColor: "#4f46e5",
    borderColor: "#4f46e5",
    elevation: 1,
  },
  categoryChipInactive: {
    backgroundColor: "#ffffff",
    borderColor: "#f1f5f9",
  },
  dateChipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
    elevation: 1,
  },
  dateChipInactive: {
    backgroundColor: "#ffffff",
    borderColor: "#f1f5f9",
  },
  excelButton: {
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 16,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  transactionButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#f1f5f9",
    borderRadius: 14,
    borderWidth: 1,
    elevation: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
    minHeight: 50,
    paddingHorizontal: 8,
    paddingVertical: 7,
    width: "100%",
  },
  iconBox: {
    alignItems: "center",
    borderRadius: 12,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  dateHeader: {
    alignSelf: "flex-start",
    backgroundColor: "#eef2ff",
    borderRadius: 999,
    marginBottom: 5,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dateButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#f1f5f9",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  dateButtonActive: {
    borderColor: "#4f46e5",
    backgroundColor: "#eef2ff",
  },
  calendarDay: {
    alignItems: "center",
    borderRadius: 12,
    height: 36,
    justifyContent: "center",
    width: "14.2857%",
  },
  calendarDaySelected: {
    backgroundColor: "#4f46e5",
  },
});

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date)   { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function startOfWeekMonday(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}
function parseIsoDateYmd(ymd: string): Date | null {
  const s = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

function formatYmdLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatShortDate(ymd: string, locale: string): string {
  const d = parseIsoDateYmd(ymd);
  return d ? d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" }) : "Select";
}

function formatHistoryDate(value: string): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return `Ngày ${date.toLocaleDateString("vi-VN")}`;
}
function htmlEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function matchesCategory(c: string, filterId: string): boolean {
  try {
    if (filterId === "food")          return c.includes("phở") || c.includes("ăn") || c.includes("food") || c.includes("lunch") || c.includes("dinner");
    if (filterId === "coffee")        return c.includes("cf") || c.includes("coffee") || c.includes("cà phê") || c.includes("highlands") || c.includes("starbucks") || c.includes("trà sữa");
    if (filterId === "transport")     return c.includes("grab") || c.includes("taxi") || c.includes("xe") || c.includes("di chuyển") || c.includes("transport");
    if (filterId === "shopping")      return c.includes("mua") || c.includes("shop") || c.includes("lazada") || c.includes("shopee") || c.includes("quần áo");
    if (filterId === "entertainment") return c.includes("phim") || c.includes("chơi") || c.includes("nhạc") || c.includes("entertainment") || c.includes("game");
    if (filterId === "bills")         return c.includes("điện") || c.includes("nước") || c.includes("bill") || c.includes("internet");
    if (filterId === "other") {
      const known = ["phở","ăn","food","lunch","dinner","cf","coffee","cà phê","highlands","starbucks","trà sữa","grab","taxi","xe","di chuyển","transport","mua","shop","lazada","shopee","quần áo","phim","chơi","nhạc","entertainment","game","điện","nước","bill","internet"];
      return !known.some((k) => c.includes(k));
    }
  } catch { /* ignore */ }
  return true;
}

export default function HistoryScreen() {
  const { t, language } = useI18n();
  const { transactions, refreshAll } = useTransactionsStore();
  const [query, setQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilterId>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [calendarTarget, setCalendarTarget] = useState<"from" | "to" | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfDay(new Date()));

  useFocusEffect(useCallback(() => { void refreshAll(); }, [refreshAll]));

  const filtered = useMemo(() => {
    try {
      let result = [...transactions];

      // Apply time filter
      if (dateFilter !== "all") {
        const now = new Date();
        let from: Date | null = null;
        let to: Date | null = null;

        if (dateFilter === "week") {
          from = startOfWeekMonday(now);
          to = endOfDay(now);
        } else if (dateFilter === "30d") {
          from = startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
          to = endOfDay(now);
        } else if (dateFilter === "custom") {
          const fromParsed = customFrom ? parseIsoDateYmd(customFrom) : null;
          const toParsed   = customTo   ? parseIsoDateYmd(customTo)   : null;
          from = fromParsed ? startOfDay(fromParsed) : null;
          to   = toParsed   ? endOfDay(toParsed)     : null;
        }

        result = result.filter((t) => {
          try {
            const d = new Date(toSafeString(t.date));
            if (isNaN(d.getTime())) return false;
            if (from && d < from) return false;
            if (to   && d > to)   return false;
            return true;
          } catch { return false; }
        });
      }

      // Apply text search
      const q = query.trim().toLowerCase();
      if (q) {
        result = result.filter((t) => {
          try {
            const haystack = `${toSafeString(t.merchant)} ${toSafeString(t.category)} ${toSafeString(t.note)}`.toLowerCase();
            return haystack.includes(q);
          } catch { return false; }
        });
      }

      // Apply category filter
      if (selectedFilter !== "all") {
        result = result.filter((t) => {
          try {
            const c = toSafeString(t.category).toLowerCase();
            return matchesCategory(c, selectedFilter);
          } catch { return false; }
        });
      }

      return result;
    } catch {
      return [];
    }
  }, [transactions, query, selectedFilter, dateFilter, customFrom, customTo]);

  const totalSum = useMemo(() => {
    try { return filtered.reduce((acc, t) => acc + Number(t.amount || 0), 0); }
    catch { return 0; }
  }, [filtered]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: startOffset }, () => null),
      ...Array.from({ length: daysInMonth }, (_, idx) => new Date(year, month, idx + 1)),
    ];
  }, [calendarMonth]);

  function openCalendar(target: "from" | "to") {
    setCalendarTarget(target);
    const current = parseIsoDateYmd(target === "from" ? customFrom : customTo);
    setCalendarMonth(current ?? new Date());
  }

  function selectCalendarDate(date: Date) {
    const value = formatYmdLocal(date);
    if (calendarTarget === "from") setCustomFrom(value);
    if (calendarTarget === "to") setCustomTo(value);
    setCalendarTarget(null);
  }

  const timelineEntries = useMemo(() => {
    const buckets = new Map<string, typeof filtered>();
    for (const item of filtered) {
      const dateKey = (toSafeString(item.date) || toSafeString(item.created_at) || "").slice(0, 10);
      const bucket = buckets.get(dateKey) ?? [];
      bucket.push(item);
      buckets.set(dateKey, bucket);
    }

    const entries: Array<
      | { type: "date"; key: string; label: string }
      | { type: "transaction"; key: string; item: (typeof filtered)[number] }
    > = [];

    [...buckets.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .forEach(([dateKey, items]) => {
        entries.push({ type: "date", key: `date-${dateKey}`, label: formatHistoryDate(dateKey) });
        items.forEach((item) => {
          entries.push({ type: "transaction", key: `tx-${item.id}`, item });
        });
      });

    return entries;
  }, [filtered]);

  async function onExportExcel() {
    try {
      const header = ["id", "amount_k", "category", "merchant", "date", "note", "source", "created_at"];
      const rows = filtered.map((tx) => [
        tx.id,
        Math.round(Number(tx.amount || 0) / 1000),
        tx.category ?? "",
        tx.merchant ?? "",
        tx.date,
        tx.note ?? "",
        tx.source ?? "",
        tx.created_at,
      ]);
      const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table border="1"><thead><tr>${header
        .map((h) => `<th>${htmlEscape(h)}</th>`)
        .join("")}</tr></thead><tbody>${rows
        .map((row) => `<tr>${row.map((cell) => `<td>${htmlEscape(cell)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table></body></html>`;
      const ymd = new Date().toISOString().slice(0, 10);
      const fileName = `spendsnap_transactions_${ymd}.xls`;

      if (Platform.OS === "web") {
        const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = fileName; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return;
      }

      const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!dir) throw new Error("No writable directory available.");
      const uri = `${dir}${fileName}`;
      await FileSystem.writeAsStringAsync(uri, html, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) { Alert.alert(t("exported"), `Saved to: ${uri}`); return; }
      await Sharing.shareAsync(uri, { mimeType: "application/vnd.ms-excel", dialogTitle: t("excel") });
    } catch (e) {
      Alert.alert(t("excelExportFailed"), e instanceof Error ? e.message : "Unknown error");
    }
  }

  function safeRenderItem(item: typeof transactions[number]) {
    try {
      const merchantText = toSafeString(item.merchant) || "Unspecified Merchant";
      const categoryText = toSafeString(item.category);
      const displayCategory = categoryText ? categoryLabel(categoryText, language) : t("uncategorized");
      const noteText     = toSafeString(item.note);
      const amountValue  = Number(item.amount || 0) || 0;
      const emoji        = categoryEmoji(categoryText);

      return (
        <Pressable
          onPress={() => {
            try { router.push(`/transaction/${item.id}`); } catch { /* ignore */ }
          }}
          style={({ pressed }) => [styles.transactionButton, pressed && { opacity: 0.75 }]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9, flex: 1, minWidth: 0 }}>
            <View style={[styles.iconBox, { backgroundColor: categoryBgColor(categoryText) }]}>
              <Text className="text-xl">{emoji}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <Text className="text-sm font-black text-slate-800" numberOfLines={1} style={{ flex: 1 }}>{merchantText}</Text>
                <Text className="text-sm font-black text-slate-900" numberOfLines={1}>-{formatMoneyVnd(amountValue)}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider" numberOfLines={1} style={{ flex: 1 }}>{displayCategory}</Text>
                <Text className="text-[9px] text-slate-400" numberOfLines={1} style={{ maxWidth: 140 }}>
                  {noteText ? (noteText.length > 24 ? `${noteText.slice(0, 24)}...` : noteText) : t("noNote")}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      );
    } catch {
      // Fallback render on unexpected error
      return (
        <View className="mb-3 flex-row items-center rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <Text className="text-xs text-slate-400">Transaction item</Text>
        </View>
      );
    }
  }

  const categoryLabelMap: Record<string, string> = {
    all: t("all"),
    food: t("food"),
    coffee: t("drinks"),
    transport: t("travel"),
    shopping: t("shop"),
    entertainment: t("fun"),
    bills: t("bills"),
    other: t("categories"),
  };
  const dateLabelMap: Record<DateFilterId, string> = {
    all: t("dateAll"),
    week: t("week"),
    "30d": t("last30d"),
    custom: t("custom"),
  };

  return (
    <View className="flex-1 bg-[#f8fafc] px-2 pt-14">
      {/* Title */}
      <Text className="text-2xl font-black text-slate-900 mb-4 tracking-tight">{t("history")}</Text>

      {/* Search */}
      <View className="flex-row items-center rounded-2xl bg-white border border-slate-100 px-3.5 py-3 shadow-sm mb-4">
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("historySearchPlaceholder")}
          placeholderTextColor="#94a3b8"
          className="flex-1 ml-2 text-xs font-semibold text-slate-800 outline-none text-left"
        />
        {query ? (
          <Pressable onPress={() => setQuery("")}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </Pressable>
        ) : null}
      </View>

      {/* Category Capsules */}
      <View className="mb-4">
        <View className="flex-row flex-wrap">
          {CATEGORY_FILTERS.map((f) => {
            const active = selectedFilter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => { try { setSelectedFilter(f.id); } catch { /* ignore */ } }}
                style={[
                  styles.chip,
                  active ? styles.categoryChipActive : styles.categoryChipInactive,
                ]}
              >
                <Text className="text-xs">{f.emoji}</Text>
                <Text className={active ? "text-xs font-extrabold text-white" : "text-xs font-extrabold text-slate-600"}>
                  {categoryLabelMap[f.id] ?? f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Time Filters */}
      <View className="mb-3">
        <View className="flex-row gap-2">
          {DATE_FILTERS.map((f) => {
            const active = dateFilter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => { try { setDateFilter(f.id); } catch { /* ignore */ } }}
                style={[
                  styles.chip,
                  active ? styles.dateChipActive : styles.dateChipInactive,
                ]}
              >
                <Ionicons name={f.icon} size={14} color={active ? "white" : "#64748b"} />
                <Text className={active ? "text-xs font-extrabold text-white" : "text-xs font-extrabold text-slate-600"}>{dateLabelMap[f.id]}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {dateFilter === "custom" ? (
        <View className="mb-4">
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => openCalendar("from")}
              style={[styles.dateButton, calendarTarget === "from" && styles.dateButtonActive]}
            >
            <Text className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1">{t("from")}</Text>
              <Text className="text-xs font-black text-slate-800">{formatShortDate(customFrom, language === "vi" ? "vi-VN" : "en-US")}</Text>
            </Pressable>
            <Pressable
              onPress={() => openCalendar("to")}
              style={[styles.dateButton, calendarTarget === "to" && styles.dateButtonActive]}
            >
              <Text className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1">{t("to")}</Text>
              <Text className="text-xs font-black text-slate-800">{formatShortDate(customTo, language === "vi" ? "vi-VN" : "en-US")}</Text>
            </Pressable>
          </View>

          {calendarTarget ? (
            <View className="bg-white border border-slate-100 rounded-3xl p-4 mt-3 shadow-sm">
              <View className="flex-row items-center justify-between mb-3">
                <Pressable
                  onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                  className="w-9 h-9 rounded-full bg-slate-50 items-center justify-center"
                >
                  <Ionicons name="chevron-back" size={18} color="#64748b" />
                </Pressable>
                <Text className="text-sm font-black text-slate-800">
                  {calendarMonth.toLocaleDateString(language === "vi" ? "vi-VN" : "en-US", { month: "long", year: "numeric" })}
                </Text>
                <Pressable
                  onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                  className="w-9 h-9 rounded-full bg-slate-50 items-center justify-center"
                >
                  <Ionicons name="chevron-forward" size={18} color="#64748b" />
                </Pressable>
              </View>
              <View className="flex-row mb-1">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, idx) => (
                  <Text key={`${d}-${idx}`} className="w-[14.2857%] text-center text-[10px] font-black text-slate-400">{d}</Text>
                ))}
              </View>
              <View className="flex-row flex-wrap">
                {calendarDays.map((day, idx) => {
                  const selectedValue = calendarTarget === "from" ? customFrom : customTo;
                  const selected = day ? formatYmdLocal(day) === selectedValue : false;
                  return day ? (
                    <Pressable
                      key={formatYmdLocal(day)}
                      onPress={() => selectCalendarDate(day)}
                      style={[styles.calendarDay, selected && styles.calendarDaySelected]}
                    >
                      <Text className={selected ? "text-xs font-black text-white" : "text-xs font-bold text-slate-700"}>
                        {day.getDate()}
                      </Text>
                    </Pressable>
                  ) : (
                    <View key={`blank-${idx}`} style={styles.calendarDay} />
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Stats bar */}
      <View className="flex-row justify-between items-center bg-white border border-slate-100 rounded-3xl px-4 py-3.5 mb-4 shadow-sm">
        <View>
          <Text className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
            {t("showing")} {filtered.length} {t("entries")}
          </Text>
          <Text className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-0.5">
            {t("sum")}: <Text className="text-indigo-600 font-black">{formatMoneyVnd(totalSum)}</Text>
          </Text>
        </View>
        <Pressable onPress={onExportExcel} style={styles.excelButton}>
          <Ionicons name="download-outline" size={16} color="white" />
          <Text className="text-[10px] font-black text-white uppercase tracking-wider">{t("excel")}</Text>
        </Pressable>
      </View>

      {/* Ledger list */}
      <FlatList
        data={timelineEntries}
        keyExtractor={(item) => item.key}
        showsVerticalScrollIndicator={false}
        extraData={selectedFilter}
        renderItem={({ item }) => {
          if (item.type === "date") {
            return (
              <View style={styles.dateHeader}>
                <Text className="text-xs font-black text-indigo-700 uppercase tracking-wider">
                  {item.label}
                </Text>
              </View>
            );
          }
          return safeRenderItem(item.item);
        }}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View className="mt-8 items-center py-12 px-6 bg-white border border-slate-100 rounded-3xl shadow-sm">
            <View className="w-16 h-16 rounded-full bg-slate-50 items-center justify-center mb-3">
              <Ionicons name="search-outline" size={28} color="#94a3b8" />
            </View>
            <Text className="text-sm font-black text-slate-800">{t("noTransactions")}</Text>
            <Text className="text-xs text-slate-400 text-center mt-1">
              {t("noTransactionsHint")}
            </Text>
          </View>
        }
      />
    </View>
  );
}
