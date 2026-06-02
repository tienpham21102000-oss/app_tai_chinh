import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTransactionsStore } from "../../stores/transactions";
import { useAddIntentStore } from "../../stores/addIntent";
import { ensureDbReady, getSetting, setSetting } from "../../services/db";
import { isSameLocalDay } from "../../utils/dates";
import { formatMoneyVnd } from "../../utils/money";
import { useI18n } from "../../utils/i18n";

const BUDGET_KEY = "monthly_budget_vnd";
const PET_LEVEL_KEY = "pet_level";
const PET_LAST_DATE_KEY = "pet_last_date";
const DEFAULT_BUDGET = 5_000_000;

// ─── Pet Evolution System ────────────────────────────────────────────────────
function getPetEvolution(level: number) {
  if (level <= 0)  return { emoji: "🥚", name: "Trứng",             desc: "Chưa được ấp", nextAt: 1,    stageIdx: 0 };
  if (level <= 2)  return { emoji: "🐣", name: "Nở trứng",          desc: `Lv.${level}`,   nextAt: 3,    stageIdx: 1 };
  if (level <= 5)  return { emoji: "🐤", name: "Chim non",           desc: `Lv.${level}`,   nextAt: 6,    stageIdx: 2 };
  if (level <= 10) return { emoji: "🐱", name: "Mèo con",            desc: `Lv.${level}`,   nextAt: 11,   stageIdx: 3 };
  if (level <= 18) return { emoji: "🦊", name: "Cáo thần",           desc: `Lv.${level}`,   nextAt: 19,   stageIdx: 4 };
  if (level <= 28) return { emoji: "🐲", name: "Rồng con",           desc: `Lv.${level}`,   nextAt: 29,   stageIdx: 5 };
  return           { emoji: "🐉", name: "Rồng huyền thoại", desc: `Lv.${level} ✨`, nextAt: null, stageIdx: 6 };
}

// Stage count for progress bar
const STAGE_MAX_LEVELS = [0, 2, 5, 10, 18, 28, Infinity];

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
  const { transactions, refreshToday, deleteTransaction } = useTransactionsStore();
  const setAddIntent = useAddIntentStore((s) => s.setIntent);
  const { t } = useI18n();
  const [now] = useState(() => new Date());
  const [monthlyBudget, setMonthlyBudget] = useState<number>(DEFAULT_BUDGET);

  // Pet state
  const [petLevel, setPetLevel] = useState(0);
  const [petLastDate, setPetLastDate] = useState("");
  const [petLoaded, setPetLoaded] = useState(false);
  const [txLoaded, setTxLoaded] = useState(false);
  const showQuickType = false;
  const quickTypeText = "";
  const setQuickTypeText = (_value: string) => {};

  function handleQuickTypeSubmit() {}

  // ─── Animation refs ──────────────────────────────────────────────────────
  const petAnimY = useRef(new Animated.Value(0)).current;
  const petAnimX = useRef(new Animated.Value(0)).current;
  const petScale = useRef(new Animated.Value(1)).current;
  const animLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // ─── Load data ────────────────────────────────────────────────────────────
  useEffect(() => {
    void refreshToday().then(() => setTxLoaded(true));
  }, [refreshToday]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          await ensureDbReady();
          const [budgetStr, levelStr, lastDate] = await Promise.all([
            getSetting(BUDGET_KEY),
            getSetting(PET_LEVEL_KEY),
            getSetting(PET_LAST_DATE_KEY),
          ]);
          if (!active) return;
          setMonthlyBudget(budgetStr ? (Number.isFinite(Number(budgetStr)) ? Number(budgetStr) : DEFAULT_BUDGET) : DEFAULT_BUDGET);
          setPetLevel(levelStr ? Math.max(0, parseInt(levelStr, 10) || 0) : 0);
          setPetLastDate(lastDate || "");
          setPetLoaded(true);
        } catch {
          // ignore
        }
      })();
      return () => { active = false; };
    }, [])
  );

  // ─── Computed values ──────────────────────────────────────────────────────
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

  const daysInMonth = useMemo(() => new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), [now]);
  const remainingDays = useMemo(() => daysInMonth - now.getDate() + 1, [daysInMonth, now]);
  const dailyLimit = useMemo(() => Math.round(monthlyBudget / daysInMonth), [monthlyBudget, daysInMonth]);
  const recommendedDailyLimit = useMemo(() => {
    const remainingBudget = monthlyBudget - monthlyTotal;
    return remainingBudget > 0 ? Math.round(remainingBudget / remainingDays) : 0;
  }, [monthlyBudget, monthlyTotal, remainingDays]);

  const monthlySpentPercent = useMemo(() => {
    if (!monthlyBudget || monthlyBudget <= 0) return 0;
    return Math.round((monthlyTotal / monthlyBudget) * 100);
  }, [monthlyTotal, monthlyBudget]);

  const monthlyStatus = useMemo(() => {
    if (!monthlyBudget || monthlyBudget <= 0) {
      return { label: "Healthy", key: "healthy" as const, color: "#10b981", badge: "bg-emerald-500", textColor: "text-emerald-400", desc: "Chi tiêu trong kiểm soát 🌟" };
    }
    const allowedToToday = now.getDate() * dailyLimit;
    if (monthlyTotal > monthlyBudget) {
      return { label: "Over Budget", key: "overbudget" as const, color: "#ef4444", badge: "bg-rose-500", textColor: "text-rose-400", desc: "Đã vượt ngân sách tháng! 😱" };
    }
    if (monthlyTotal > allowedToToday * 1.2) {
      return { label: "Critical", key: "critical" as const, color: "#f97316", badge: "bg-orange-500", textColor: "text-orange-400", desc: "Chi tiêu quá mức cho phép 😰" };
    }
    if (monthlyTotal > allowedToToday) {
      return { label: "Warning", key: "warning" as const, color: "#f59e0b", badge: "bg-amber-500", textColor: "text-amber-400", desc: "Hơi vượt kế hoạch 😅" };
    }
    return { label: "Healthy", key: "healthy" as const, color: "#10b981", badge: "bg-emerald-500", textColor: "text-emerald-400", desc: "Chi tiêu trong kiểm soát 🌟" };
  }, [monthlyTotal, monthlyBudget, dailyLimit, now]);

  const limitProgressPercent = useMemo(() => {
    if (dailyLimit <= 0) return 0;
    return Math.round((todayTotal / dailyLimit) * 100);
  }, [todayTotal, dailyLimit]);

  const latestTransactions = useMemo(() => [...transactions].slice(0, 5), [transactions]);

  const greeting = useMemo(() => {
    const hours = now.getHours();
    if (hours < 12) return "Good morning ☀️";
    if (hours < 18) return "Good afternoon 🌤️";
    return "Good evening 🌙";
  }, [now]);

  const pet = useMemo(() => getPetEvolution(petLevel), [petLevel]);

  // Pet level progress within current stage
  const petStageProgress = useMemo(() => {
    if (pet.stageIdx >= 6) return 1; // max stage
    const stageMin = pet.stageIdx === 0 ? 0 : STAGE_MAX_LEVELS[pet.stageIdx - 1] + 1;
    const stageMax = STAGE_MAX_LEVELS[pet.stageIdx];
    const range = stageMax - stageMin + 1;
    const inStage = petLevel - stageMin;
    return Math.min(1, Math.max(0, inStage / range));
  }, [petLevel, pet.stageIdx]);

  // ─── Pet level update (once per day) ──────────────────────────────────────
  useEffect(() => {
    if (!petLoaded || !txLoaded) return;
    const todayStr = new Date().toISOString().split("T")[0];
    if (petLastDate === todayStr) return; // Already evaluated today

    const isHealthy = monthlyStatus.key === "healthy";
    const newLevel = Math.max(0, petLevel + (isHealthy ? 1 : -1));

    setPetLevel(newLevel);
    setPetLastDate(todayStr);

    void (async () => {
      try {
        await ensureDbReady();
        await setSetting(PET_LEVEL_KEY, String(newLevel));
        await setSetting(PET_LAST_DATE_KEY, todayStr);
      } catch { /* ignore */ }
    })();
  // Only run when loaded flags and date change — not on every status change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petLoaded, txLoaded, petLastDate]);

  // ─── Pet animations ───────────────────────────────────────────────────────
  useEffect(() => {
    if (animLoopRef.current) {
      animLoopRef.current.stop();
    }
    petAnimY.setValue(0);
    petAnimX.setValue(0);
    petScale.setValue(1);

    let anim: Animated.CompositeAnimation;

    switch (monthlyStatus.key) {
      case "healthy":
        anim = Animated.loop(
          Animated.sequence([
            Animated.timing(petAnimY, { toValue: -10, duration: 380, useNativeDriver: true }),
            Animated.timing(petAnimY, { toValue: 0,   duration: 380, useNativeDriver: true }),
            Animated.delay(500),
          ])
        );
        break;
      case "warning":
        anim = Animated.loop(
          Animated.sequence([
            Animated.timing(petAnimX, { toValue: -5, duration: 220, useNativeDriver: true }),
            Animated.timing(petAnimX, { toValue:  5, duration: 220, useNativeDriver: true }),
            Animated.timing(petAnimX, { toValue: -5, duration: 220, useNativeDriver: true }),
            Animated.timing(petAnimX, { toValue:  0, duration: 220, useNativeDriver: true }),
            Animated.delay(900),
          ])
        );
        break;
      case "critical":
        anim = Animated.loop(
          Animated.sequence([
            Animated.timing(petAnimX, { toValue: -7, duration: 70, useNativeDriver: true }),
            Animated.timing(petAnimX, { toValue:  7, duration: 70, useNativeDriver: true }),
            Animated.timing(petAnimX, { toValue: -7, duration: 70, useNativeDriver: true }),
            Animated.timing(petAnimX, { toValue:  7, duration: 70, useNativeDriver: true }),
            Animated.timing(petAnimX, { toValue:  0, duration: 70, useNativeDriver: true }),
            Animated.delay(550),
          ])
        );
        break;
      default: // overbudget
        anim = Animated.loop(
          Animated.sequence([
            Animated.timing(petScale, { toValue: 1.3,  duration: 220, useNativeDriver: true }),
            Animated.timing(petScale, { toValue: 0.85, duration: 220, useNativeDriver: true }),
          ])
        );
    }

    animLoopRef.current = anim;
    anim.start();

    return () => { anim.stop(); };
  }, [monthlyStatus.key, petAnimX, petAnimY, petScale]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#f8fafc]"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
    >
    <View className="flex-1 px-4 pt-14">
      {/* Premium Header */}
      <View className="flex-row items-center justify-between mb-5">
        <View>
          <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{greeting}</Text>
          <Text className="text-2xl font-black text-slate-900 tracking-tight">SpendSnap</Text>
        </View>
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.push("/settings")}
            className="w-10 h-10 items-center justify-center rounded-full bg-white border border-slate-100 shadow-sm active:scale-95"
          >
            <Ionicons name="settings-outline" size={20} color="#64748b" />
          </Pressable>
          <View className="w-10 h-10 items-center justify-center rounded-full bg-indigo-600 shadow-md">
            <Text className="text-white font-black text-sm">S</Text>
          </View>
        </View>
      </View>

      {/* Main Budget Card */}
      <View className="bg-indigo-600 rounded-3xl p-6 mb-4 shadow-xl relative overflow-hidden">
        <View className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-pink-500/30 blur-3xl" />
        <View className="absolute -left-16 -bottom-16 w-48 h-48 rounded-full bg-indigo-400/20 blur-3xl" />

        <View className="flex-row justify-between items-start">
          <View className="flex-1 pr-3">
            <Text className="text-indigo-200 text-[10px] font-extrabold tracking-widest uppercase">Today's Total Spent</Text>
            <Text className="text-[13px] font-black text-white mt-1 tracking-tight">
              Ngân sách ngày: <Text className="text-2xl">{formatMoneyVnd(dailyLimit)}</Text>
            </Text>
            <Text className="text-[12px] font-semibold text-indigo-100 mt-1">
              Đã chi hôm nay: {formatMoneyVnd(todayTotal)}
            </Text>
          </View>
        </View>

        {/* Daily limit progress */}
        <View className="mt-5">
          <View className="flex-row justify-between items-center mb-1.5">
            <Text className="text-indigo-200 text-[9px] font-bold uppercase tracking-wider">Mức tiêu thụ ngày</Text>
            <Text className="text-[9px] font-black text-white">
              {limitProgressPercent}%
            </Text>
          </View>
          <View className="w-full h-2.5 bg-indigo-900/30 rounded-full overflow-hidden">
            <View
              style={{ width: `${Math.min(limitProgressPercent, 100)}%` }}
              className={`h-full rounded-full ${limitProgressPercent > 100 ? "bg-rose-400" : limitProgressPercent >= 80 ? "bg-amber-400" : "bg-emerald-400"}`}
            />
          </View>
        </View>

        <View className="w-full h-[1px] bg-white/10 my-4" />

        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-indigo-200 text-[9px] uppercase font-extrabold tracking-wider">Tháng này</Text>
            <Text className="text-base font-black text-white mt-0.5">
              {formatMoneyVnd(monthlyTotal)} / {formatMoneyVnd(monthlyBudget)} ({monthlySpentPercent}%)
            </Text>
          </View>
        </View>
      </View>

      <Text className="text-[11px] font-semibold text-slate-500 mb-4 px-2 text-center">
        {monthlyTotal > monthlyBudget ? (
          <Text className="font-black text-rose-600">{t("overBudgetMessage")}</Text>
        ) : (
          <>
            Để không bị over budget, trung bình mỗi ngày còn lại trong tháng bạn chỉ nên chi tiêu dưới{" "}
            <Text className="font-black text-indigo-600">{formatMoneyVnd(recommendedDailyLimit)}</Text>.
          </>
        )}
      </Text>

      {/* ── Pet & Health Status Card ── */}
      <View
        className="rounded-3xl p-4 mb-4 shadow-md border overflow-hidden"
        style={{
          backgroundColor:
            monthlyStatus.key === "healthy"    ? "#f0fdf4" :
            monthlyStatus.key === "warning"    ? "#fffbeb" :
            monthlyStatus.key === "critical"   ? "#fff7ed" :
                                                  "#fef2f2",
          borderColor:
            monthlyStatus.key === "healthy"    ? "#bbf7d0" :
            monthlyStatus.key === "warning"    ? "#fde68a" :
            monthlyStatus.key === "critical"   ? "#fed7aa" :
                                                  "#fecaca",
        }}
      >
        <View className="flex-row items-center justify-between">
          {/* Left: Pet display */}
          <View className="flex-row items-center gap-3 flex-1">
            {/* Animated pet */}
            <Animated.View
              style={{
                transform: [
                  { translateY: petAnimY },
                  { translateX: petAnimX },
                  { scale: petScale },
                ],
              }}
            >
              <View
                className="w-16 h-16 rounded-2xl items-center justify-center shadow-sm"
                style={{
                  backgroundColor:
                    monthlyStatus.key === "healthy"  ? "#dcfce7" :
                    monthlyStatus.key === "warning"  ? "#fef3c7" :
                    monthlyStatus.key === "critical" ? "#ffedd5" :
                                                       "#fee2e2",
                }}
              >
                <Text style={{ fontSize: 34 }}>{pet.emoji}</Text>
              </View>
            </Animated.View>

            {/* Pet info */}
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5 mb-0.5">
                <Text className="text-xs font-black text-slate-800">{pet.name}</Text>
                <View
                  className="px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: monthlyStatus.color + "22" }}
                >
                  <Text style={{ color: monthlyStatus.color }} className="text-[8px] font-black uppercase">
                    {pet.desc}
                  </Text>
                </View>
              </View>

              {/* Stage progress bar */}
              <View className="mb-1">
                <View className="w-full h-2 bg-white/70 rounded-full overflow-hidden">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(petStageProgress * 100)}%`,
                      backgroundColor: monthlyStatus.color,
                    }}
                  />
                </View>
                {pet.nextAt !== null && (
                  <Text className="text-[8px] text-slate-500 font-semibold mt-0.5">
                    Tiến hóa tiếp theo tại Lv.{pet.nextAt} • +1/ngày Healthy
                  </Text>
                )}
                {pet.nextAt === null && (
                  <Text className="text-[8px] text-slate-500 font-semibold mt-0.5">
                    Đã đạt cấp bậc tối đa! ✨
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Right: Status badge */}
          <View className="items-center ml-2">
            <View
              className="px-3 py-1.5 rounded-2xl mb-1"
              style={{ backgroundColor: monthlyStatus.color + "22" }}
            >
              <Text style={{ color: monthlyStatus.color }} className="text-[11px] font-black uppercase tracking-wide">
                {monthlyStatus.label}
              </Text>
            </View>
            <Text className="text-[9px] text-slate-500 text-center font-medium" style={{ maxWidth: 90 }}>
              {monthlyStatus.desc}
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Action Shortcuts */}
      <View className="flex-row gap-3 mb-4">
        {/* AI Voice */}
        <Pressable
          onPress={() => {
            setAddIntent({ mode: "voice" });
            router.push("/add");
          }}
          className="flex-1 items-center justify-center gap-1.5 rounded-3xl bg-indigo-50 border border-indigo-100 py-4 shadow-sm active:scale-95"
        >
          <Ionicons name="mic" size={24} color="#4f46e5" />
          <Text className="text-[#4f46e5] text-sm font-black">{t("aiVoice")}</Text>
        </Pressable>

        {/* Scan Bill */}
        <Pressable
          onPress={() => {
            setAddIntent({ mode: "camera" });
            router.push("/add");
          }}
          className="flex-1 items-center justify-center gap-1.5 rounded-3xl bg-emerald-50 border border-emerald-100 py-4 shadow-sm active:scale-95"
        >
          <Ionicons name="camera" size={24} color="#059669" />
          <Text className="text-[#059669] text-sm font-black">{t("scanBill")}</Text>
        </Pressable>

        {/* Quick Type */}
        <Pressable
          onPress={() => {
            setAddIntent({ mode: "text" });
            router.push("/add");
          }}
          className="flex-1 items-center justify-center gap-1.5 rounded-3xl py-4 shadow-sm active:scale-95 border bg-white border-slate-100"
        >
          <Ionicons name="create" size={24} color="#64748b" />
          <Text className="text-sm font-black text-slate-600">
            {t("quickType")}
          </Text>
        </Pressable>
      </View>

      {/* Inline Quick Type Input */}
      {showQuickType && (
        <View className="bg-white border border-slate-200 rounded-3xl p-4 mb-4 shadow-md">
          <Text className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">
            Nhập mô tả chi tiêu (AI sẽ tự phân tích)
          </Text>
          <View className="flex-row items-center gap-2">
            <TextInput
              value={quickTypeText}
              onChangeText={setQuickTypeText}
              placeholder="Grab 85k, Highlands 45k, ăn phở 50k..."
              placeholderTextColor="#94a3b8"
              autoFocus
              returnKeyType="send"
              onSubmitEditing={handleQuickTypeSubmit}
              className="flex-1 text-sm font-semibold text-slate-800"
              style={{ minHeight: 44 }}
            />
            <Pressable
              onPress={handleQuickTypeSubmit}
              disabled={!quickTypeText.trim()}
              className="bg-indigo-600 rounded-2xl px-3 py-2 active:scale-95 disabled:opacity-40"
            >
              <Ionicons name="arrow-forward" size={16} color="white" />
            </Pressable>
          </View>
        </View>
      )}

      {/* Latest Transactions Header */}
      <View className="flex-row items-center justify-between mb-4 mt-2">
        <View>
          <Text className="text-base font-black text-slate-800 tracking-tight">{t("latestTransaction")}</Text>
          <Text className="text-[10px] text-slate-400 font-semibold mt-0.5">{t("latestTransactionHint")}</Text>
        </View>
      </View>

      {/* Latest Transactions FlatList */}
      <FlatList
        data={latestTransactions}
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
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-black text-slate-900">
                  -{formatMoneyVnd(item.amount)}
                </Text>
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    void deleteTransaction(item.id);
                  }}
                  className="w-7 h-7 rounded-full bg-rose-50 items-center justify-center active:scale-95"
                >
                  <Ionicons name="remove" size={14} color="#e11d48" />
                </Pressable>
              </View>
              <Text className="text-[9px] text-slate-400 mt-0.5">
                {item.note ? (item.note.length > 15 ? `${item.note.slice(0, 15)}...` : item.note) : t("noNote")}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="mt-6 items-center py-10 px-6 bg-white border border-slate-100 rounded-3xl shadow-sm">
            <View className="w-16 h-16 rounded-full bg-slate-50 items-center justify-center mb-3">
              <Ionicons name="receipt-outline" size={28} color="#94a3b8" />
            </View>
            <Text className="text-sm font-black text-slate-800">No recent transactions</Text>
            <Text className="text-xs text-slate-400 text-center mt-1">
              Thêm giao dịch mới bằng Voice, Scan bill hoặc Quick Type để thấy ở đây.
            </Text>
          </View>
        }
      />
    </View>
    </KeyboardAvoidingView>
  );
}
