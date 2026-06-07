import { useMemo } from "react";
import { Pressable, Text, View, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTransactionsStore } from "../../stores/transactions";
import { useAddIntentStore } from "../../stores/addIntent";
import { formatMoneyVnd } from "../../utils/money";
import { useI18n, type I18nKey } from "../../utils/i18n";
import { categoryEmoji, categoryLabel } from "../../utils/categories";

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

type IconName = keyof typeof Ionicons.glyphMap;

function getSourceIcon(source?: string | null): IconName {
  const s = source ?? "manual_text";
  if (s.includes("voice") || s.includes("stt")) return "mic-outline" satisfies IconName;
  if (s.includes("ocr") || s.includes("image")) return "camera-outline" satisfies IconName;
  return "create-outline" satisfies IconName;
}

function getSourceLabel(source: string | null | undefined, t: (key: I18nKey) => string): string {
  const s = source ?? "manual_text";
  if (s.includes("voice") || s.includes("stt")) return t("voiceInput");
  if (s.includes("ocr") || s.includes("image")) return t("receiptScan");
  return t("manualEntry");
}

function formatTxDateLocalized(dateStr: string | null | undefined, language: "vi" | "en", atText: string): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  try {
    const locale = language === "vi" ? "vi-VN" : "en-US";
    const datePart = d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
    const timePart = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    return `${datePart} ${atText} ${timePart}`;
  } catch {
    return dateStr;
  }
}

function formatTxDate(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    return dateStr; // fallback to raw string if invalid
  }
  try {
    const datePart = d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const timePart = d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${datePart} lúc ${timePart}`;
  } catch {
    return dateStr;
  }
}

export default function TransactionModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const deleteTx = useTransactionsStore((s) => s.deleteTransaction);
  const setAddIntent = useAddIntentStore((s) => s.setIntent);
  const tx = useTransactionsStore((s) => s.transactions.find((t) => t.id === id));
  const { t, language } = useI18n();

  const title = useMemo(() => tx?.merchant ?? t("transactionReceipt"), [tx, t]);

  const handleDelete = () => {
    if (!tx) return;
    Alert.alert(
      t("voidTransaction"),
      t("deleteTransactionConfirm"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            await deleteTx(tx.id);
            router.dismissTo("/");
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    if (!tx) return;
    setAddIntent({
      mode: "text",
      editTransaction: {
        id: tx.id,
        amount: tx.amount,
        category: tx.category,
        merchant: tx.merchant,
        date: tx.date,
        note: tx.note,
        raw_text: tx.raw_text,
        source: tx.source,
        created_at: tx.created_at,
      },
    });
    router.push("/add");
  };

  if (!tx) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f8fafc] px-6">
        <Ionicons name="alert-circle-outline" size={48} color="#94a3b8" />
        <Text className="text-slate-500 font-bold mt-2">{t("transactionNotFound")}</Text>
        <Pressable onPress={() => router.dismissTo("/")} className="mt-4 rounded-2xl bg-indigo-500 px-6 py-3 shadow-md">
          <Text className="text-white font-extrabold text-xs">{t("goBack")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#f8fafc] px-4 pt-10">
      {/* Header Close */}
      <View className="flex-row justify-between items-center mb-6">
        <Pressable onPress={() => router.dismissTo("/")} className="w-9 h-9 rounded-full bg-white border border-slate-100 items-center justify-center shadow-sm">
          <Ionicons name="chevron-back" size={18} color="#64748b" />
        </Pressable>
        <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t("transactionDetails")}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Modern Receipt Invoice Style Card */}
      <View className="bg-white border border-slate-100 rounded-3xl p-6 shadow-lg relative overflow-hidden mb-6">
        {/* Glow detail */}
        <View className="absolute -right-12 -top-12 w-28 h-28 rounded-full bg-indigo-500/10 blur-xl" />

        {/* Top category emoji block */}
        <View className="items-center mb-4">
          <View className="w-16 h-16 rounded-3xl bg-indigo-50 items-center justify-center mb-3">
            <Text className="text-4xl">{categoryEmoji(tx.category)}</Text>
          </View>
          <Text className="text-xl font-black text-slate-800 text-center">{title}</Text>
          <Text className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
            {tx.category ? categoryLabel(tx.category, language) : t("uncategorized")}
          </Text>
        </View>

        {/* Large Amount */}
        <View className="items-center py-4 bg-slate-50 border border-slate-100 rounded-2xl mb-6">
          <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t("spentAmount")}</Text>
          <Text className="text-3xl font-black text-slate-900">
            -{formatMoneyVnd(tx.amount)}
          </Text>
        </View>

        {/* Metadata grid */}
        <View className="gap-4">
          {/* Time & Date */}
          <View className="flex-row justify-between items-center border-b border-slate-50 pb-3">
            <Text className="text-xs font-semibold text-slate-400 uppercase">{t("loggedDate")}</Text>
            <Text className="text-xs font-bold text-slate-700">
              {formatTxDateLocalized(tx.date, language, t("atTime"))}
            </Text>
          </View>

          {/* Logging method */}
          <View className="flex-row justify-between items-center border-b border-slate-50 pb-3">
            <Text className="text-xs font-semibold text-slate-400 uppercase">{t("method")}</Text>
            <View className="flex-row items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-xl">
              <Ionicons name={getSourceIcon(tx.source)} size={12} color="#64748b" />
              <Text className="text-[10px] font-bold text-slate-600">
                {getSourceLabel(tx.source, t)}
              </Text>
            </View>
          </View>

          {/* Note / details */}
          {tx.note ? (
            <View className="border-b border-slate-50 pb-3">
              <Text className="text-xs font-semibold text-slate-400 uppercase mb-1">{t("invoiceNotes")}</Text>
              <Text className="text-xs font-bold text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-100">
                {tx.note}
              </Text>
            </View>
          ) : null}

          {/* Raw source representation if from Voice or OCR */}
          {tx.raw_text ? (
            <View className="pb-1">
              <Text className="text-xs font-semibold text-slate-400 uppercase mb-1">{t("aiContextText")}</Text>
              <Text className="text-[11px] font-bold text-slate-400 italic">
                "{tx.raw_text}"
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View className="flex-row gap-3 mb-6">
        <Pressable
          onPress={handleEdit}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 shadow-md active:scale-95"
        >
          <Ionicons name="create-outline" size={17} color="white" />
          <Text className="text-white font-extrabold text-sm">{t("edit")}</Text>
        </Pressable>
        <Pressable
          onPress={handleDelete}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-rose-50 border border-rose-100 py-3.5 active:scale-95"
        >
          <Ionicons name="trash-outline" size={17} color="#e11d48" />
          <Text className="text-rose-600 font-extrabold text-sm">{t("delete")}</Text>
        </Pressable>
      </View>

      {/* Done Button */}
      <Pressable
        onPress={() => router.dismissTo("/")}
        className="w-full flex-row items-center justify-center gap-1.5 rounded-2xl bg-slate-900 py-4 shadow-md active:scale-95 mb-10"
      >
        <Text className="text-white font-extrabold text-sm">{t("closeReceipt")}</Text>
      </Pressable>
    </View>
  );
}
