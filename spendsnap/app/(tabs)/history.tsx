import { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { useTransactionsStore } from "../../stores/transactions";
import { formatMoneyVnd } from "../../utils/money";

function toSafeString(value: unknown): string {
  return value == null ? "" : String(value);
}

function getCategoryEmoji(category?: string | null): string {
  const c = toSafeString(category).toLowerCase();
  if (c.includes("phở") || c.includes("ăn") || c.includes("food") || c.includes("lunch") || c.includes("dinner")) return "🍔";
  if (c.includes("cf") || c.includes("coffee") || c.includes("cà phê") || c.includes("highlands") || c.includes("starbucks") || c.includes("trà sữa")) return "☕";
  if (c.includes("grab") || c.includes("taxi") || c.includes("xe") || c.includes("di chuyển") || c.includes("transport")) return "🚗";
  if (c.includes("mua") || c.includes("shop") || c.includes("lazada") || c.includes("shopee") || c.includes("quần áo")) return "🛍️";
  if (c.includes("phim") || c.includes("chơi") || c.includes("nhạc") || c.includes("entertainment") || c.includes("game")) return "🎬";
  if (c.includes("điện") || c.includes("nước") || c.includes("bill") || c.includes("internet")) return "⚡";
  return "📦";
}

function getCategoryBg(category?: string | null): string {
  const c = toSafeString(category).toLowerCase();
  if (c.includes("phở") || c.includes("ăn") || c.includes("food") || c.includes("lunch") || c.includes("dinner")) return "bg-orange-50";
  if (c.includes("cf") || c.includes("coffee") || c.includes("cà phê") || c.includes("highlands") || c.includes("starbucks") || c.includes("trà sữa")) return "bg-amber-50";
  if (c.includes("grab") || c.includes("taxi") || c.includes("xe") || c.includes("di chuyển") || c.includes("transport")) return "bg-sky-50";
  if (c.includes("mua") || c.includes("shop") || c.includes("lazada") || c.includes("shopee") || c.includes("quần áo")) return "bg-purple-50";
  if (c.includes("phim") || c.includes("chơi") || c.includes("nhạc") || c.includes("entertainment") || c.includes("game")) return "bg-rose-50";
  if (c.includes("điện") || c.includes("nước") || c.includes("bill") || c.includes("internet")) return "bg-emerald-50";
  return "bg-slate-100";
}

const CATEGORY_FILTERS = [
  { id: "all", label: "All", emoji: "✨" },
  { id: "food", label: "Food", emoji: "🍔" },
  { id: "coffee", label: "Drinks", emoji: "☕" },
  { id: "transport", label: "Travel", emoji: "🚗" },
  { id: "shopping", label: "Shop", emoji: "🛍️" },
  { id: "entertainment", label: "Fun", emoji: "🎬" },
  { id: "bills", label: "Bills", emoji: "⚡" },
  { id: "other", label: "Others", emoji: "📦" },
];

type DateFilterId = "all" | "week" | "30d" | "custom";
const DATE_FILTERS: Array<{ id: DateFilterId; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: "all", label: "All time", icon: "calendar-outline" },
  { id: "week", label: "This week", icon: "today-outline" },
  { id: "30d", label: "Last 30d", icon: "time-outline" },
  { id: "custom", label: "Custom", icon: "options-outline" },
];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfWeekMonday(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0=Sun..6=Sat
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

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function HistoryScreen() {
  const { transactions, refreshAll } = useTransactionsStore();
  const [query, setQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilterId>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const filtered = useMemo(() => {
    let result = transactions;

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
        const toParsed = customTo ? parseIsoDateYmd(customTo) : null;
        from = fromParsed ? startOfDay(fromParsed) : null;
        to = toParsed ? endOfDay(toParsed) : null;
      }

      result = result.filter((t) => {
        const d = new Date(t.date);
        if (isNaN(d.getTime())) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      });
    }

    // Apply text search query
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((t) => {
        const haystack = `${toSafeString(t.merchant)} ${toSafeString(t.category)} ${toSafeString(t.note)}`.toLowerCase();
        return haystack.includes(q);
      });
    }

    // Apply category capsule filter
    if (selectedFilter !== "all") {
      result = result.filter((t) => {
        const c = toSafeString(t.category).toLowerCase();
        if (selectedFilter === "food") {
          return c.includes("phở") || c.includes("ăn") || c.includes("food") || c.includes("lunch") || c.includes("dinner");
        }
        if (selectedFilter === "coffee") {
          return c.includes("cf") || c.includes("coffee") || c.includes("cà phê") || c.includes("highlands") || c.includes("starbucks") || c.includes("trà sữa");
        }
        if (selectedFilter === "transport") {
          return c.includes("grab") || c.includes("taxi") || c.includes("xe") || c.includes("di chuyển") || c.includes("transport");
        }
        if (selectedFilter === "shopping") {
          return c.includes("mua") || c.includes("shop") || c.includes("lazada") || c.includes("shopee") || c.includes("quần áo");
        }
        if (selectedFilter === "entertainment") {
          return c.includes("phim") || c.includes("chơi") || c.includes("nhạc") || c.includes("entertainment") || c.includes("game");
        }
        if (selectedFilter === "bills") {
          return c.includes("điện") || c.includes("nước") || c.includes("bill") || c.includes("internet");
        }
        if (selectedFilter === "other") {
          // Exclude all specific categories
          const known = ["phở", "ăn", "food", "lunch", "dinner", "cf", "coffee", "cà phê", "highlands", "starbucks", "trà sữa", "grab", "taxi", "xe", "di chuyển", "transport", "mua", "shop", "lazada", "shopee", "quần áo", "phim", "chơi", "nhạc", "entertainment", "game", "điện", "nước", "bill", "internet"];
          return !known.some((k) => c.includes(k));
        }
        return true;
      });
    }

    return result;
  }, [transactions, query, selectedFilter, dateFilter, customFrom, customTo]);

  const totalSum = useMemo(() => {
    return filtered.reduce((acc, t) => acc + Number(t.amount || 0), 0);
  }, [filtered]);

  async function onExportCsv() {
    try {
      const header = [
        "id",
        "amount_vnd",
        "category",
        "merchant",
        "date",
        "note",
        "source",
        "created_at",
      ];
      const lines = [
        header.join(","),
        ...filtered.map((t) =>
          [
            csvEscape(t.id),
            csvEscape(t.amount),
            csvEscape(t.category ?? ""),
            csvEscape(t.merchant ?? ""),
            csvEscape(t.date),
            csvEscape(t.note ?? ""),
            csvEscape(t.source ?? ""),
            csvEscape(t.created_at),
          ].join(",")
        ),
      ];
      const csv = `\ufeff${lines.join("\n")}`; // BOM for Excel

      const ymd = new Date().toISOString().slice(0, 10);
      const fileName = `spendsnap_transactions_${ymd}.csv`;

      if (Platform.OS === "web") {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return;
      }

      const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!dir) throw new Error("No writable directory available.");
      const uri = `${dir}${fileName}`;
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Exported", `Saved to: ${uri}`);
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "text/csv",
        dialogTitle: "Export CSV",
        UTI: "public.comma-separated-values-text",
      });
    } catch (e) {
      Alert.alert("Export failed", e instanceof Error ? e.message : "Unknown error");
    }
  }

  return (
    <View className="flex-1 bg-[#f8fafc] px-4 pt-14">
      {/* Title */}
      <Text className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Transaction Ledger</Text>

      {/* Advanced Search Input */}
      <View className="flex-row items-center rounded-2xl bg-white border border-slate-100 px-3.5 py-3 shadow-sm mb-4">
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm cửa hàng, danh mục, ghi chú..."
          placeholderTextColor="#94a3b8"
          className="flex-1 ml-2 text-xs font-semibold text-slate-800 outline-none text-left"
        />
        {query ? (
          <Pressable onPress={() => setQuery("")}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </Pressable>
        ) : null}
      </View>

      {/* Horizontal Category Capsules */}
      <View className="mb-4">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 10 }}
        >
          {CATEGORY_FILTERS.map((f) => {
            const active = selectedFilter === f.id;
            const containerClass = active
              ? "flex-row items-center gap-1 rounded-full px-4 py-2 border bg-indigo-600 border-indigo-600 shadow-sm"
              : "flex-row items-center gap-1 rounded-full px-4 py-2 border bg-white border-slate-100";
            const textClass = active
              ? "text-xs font-extrabold text-white"
              : "text-xs font-extrabold text-slate-600";

            return (
              <Pressable
                key={f.id}
                onPress={() => setSelectedFilter(f.id)}
                className={`${containerClass} mr-2`}
              >
                <Text className="text-xs">{f.emoji}</Text>
                <Text className={textClass}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Time Filters */}
      <View className="mb-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 10 }}
        >
          {DATE_FILTERS.map((f) => {
            const active = dateFilter === f.id;
            const containerClass = active
              ? "flex-row items-center gap-1 rounded-full px-4 py-2 border bg-slate-900 border-slate-900 shadow-sm"
              : "flex-row items-center gap-1 rounded-full px-4 py-2 border bg-white border-slate-100";
            const textClass = active ? "text-xs font-extrabold text-white" : "text-xs font-extrabold text-slate-600";

            return (
              <Pressable key={f.id} onPress={() => setDateFilter(f.id)} className={`${containerClass} mr-2`}>
                <Ionicons name={f.icon} size={14} color={active ? "white" : "#64748b"} />
                <Text className={textClass}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {dateFilter === "custom" ? (
        <View className="flex-row gap-2 mb-4">
          <View className="flex-1 bg-white border border-slate-100 rounded-2xl px-3.5 py-3 shadow-sm">
            <Text className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1">From</Text>
            <TextInput
              value={customFrom}
              onChangeText={setCustomFrom}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              className="text-xs font-semibold text-slate-800"
            />
          </View>
          <View className="flex-1 bg-white border border-slate-100 rounded-2xl px-3.5 py-3 shadow-sm">
            <Text className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1">To</Text>
            <TextInput
              value={customTo}
              onChangeText={setCustomTo}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              className="text-xs font-semibold text-slate-800"
            />
          </View>
        </View>
      ) : null}

      {/* Statistics Header of Results */}
      <View className="flex-row justify-between items-center bg-white border border-slate-100 rounded-3xl px-4 py-3.5 mb-4 shadow-sm">
        <View>
          <Text className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
            Showing {filtered.length} entries
          </Text>
          <Text className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-0.5">
            Sum: <Text className="text-indigo-600 font-black">{formatMoneyVnd(totalSum)}</Text>
          </Text>
        </View>

        <Pressable
          onPress={onExportCsv}
          className="flex-row items-center gap-1 rounded-2xl bg-slate-900 px-3 py-2 active:scale-95"
        >
          <Ionicons name="download-outline" size={16} color="white" />
          <Text className="text-[10px] font-black text-white uppercase tracking-wider">CSV</Text>
        </Pressable>
      </View>

      {/* Ledger Entries List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const merchantText = toSafeString(item.merchant) || "Unspecified Merchant";
          const categoryText = toSafeString(item.category) || "Uncategorized";
          const noteText = toSafeString(item.note);
          const amountValue = Number(item.amount || 0) || 0;
          return (
            <Pressable
              onPress={() => router.push(`/transaction/${item.id}`)}
              className="mb-3 flex-row items-center justify-between rounded-3xl border border-slate-100 bg-white p-4 shadow-sm active:opacity-75"
            >
              <View className="flex-row items-center gap-3.5 flex-1">
                <View className={`w-12 h-12 rounded-2xl items-center justify-center ${getCategoryBg(categoryText)}`}>
                  <Text className="text-2xl">{getCategoryEmoji(categoryText)}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-black text-slate-800" numberOfLines={1}>
                    {merchantText}
                  </Text>
                  <Text className="text-[10px] text-slate-400 mt-0.5 font-bold uppercase tracking-wider">
                    {categoryText}
                  </Text>
                </View>
              </View>
              <View className="items-end ml-4">
                <Text className="text-sm font-black text-slate-900">
                  -{formatMoneyVnd(amountValue)}
                </Text>
                <Text className="text-[9px] text-slate-400 mt-0.5">
                  {noteText ? (noteText.length > 15 ? `${noteText.slice(0, 15)}...` : noteText) : "No note"}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View className="mt-8 items-center py-12 px-6 bg-white border border-slate-100 rounded-3xl shadow-sm">
            <View className="w-16 h-16 rounded-full bg-slate-50 items-center justify-center mb-3">
              <Ionicons name="search-outline" size={28} color="#94a3b8" />
            </View>
            <Text className="text-sm font-black text-slate-800">No transactions match search</Text>
            <Text className="text-xs text-slate-400 text-center mt-1">
              Try searching with another keyword or clear the search query.
            </Text>
          </View>
        }
      />
    </View>
  );
}
