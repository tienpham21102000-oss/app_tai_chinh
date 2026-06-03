import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTransactionsStore } from "../../stores/transactions";
import { useAddIntentStore } from "../../stores/addIntent";
import { ensureDbReady, getSetting, setSetting } from "../../services/db";
import { isSameLocalDay } from "../../utils/dates";
import { formatMoneyVnd } from "../../utils/money";
import { useI18n, type I18nKey } from "../../utils/i18n";
import { DEFAULT_BUDGET, getBudgetForMonth } from "../../utils/budget";

const PET_LEVEL_KEY = "pet_level";
const PET_LAST_DATE_KEY = "pet_last_date";

// ─── Pet Evolution System ────────────────────────────────────────────────────
function getPetEvolution(level: number, t: (key: I18nKey) => string) {
  if (level <= 0)  return { emoji: "🥚", name: t("petEgg"),     desc: t("petEggDesc"), nextAt: 1,    stageIdx: 0 };
  if (level <= 2)  return { emoji: "🐣", name: t("petHatched"), desc: `Lv.${level}`,   nextAt: 3,    stageIdx: 1 };
  if (level <= 5)  return { emoji: "🐤", name: t("petBird"),    desc: `Lv.${level}`,   nextAt: 6,    stageIdx: 2 };
  if (level <= 10) return { emoji: "🐱", name: t("petCat"),     desc: `Lv.${level}`,   nextAt: 11,   stageIdx: 3 };
  if (level <= 18) return { emoji: "🦊", name: t("petFox"),     desc: `Lv.${level}`,   nextAt: 19,   stageIdx: 4 };
  if (level <= 28) return { emoji: "🦄", name: t("petDragon"),  desc: `Lv.${level}`,   nextAt: 29,   stageIdx: 5 };
  return           { emoji: "🦖", name: t("petLegend"),  desc: `Lv.${level} ✨`, nextAt: null, stageIdx: 6 };
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
  const { transactions, refreshToday } = useTransactionsStore();
  const setAddIntent = useAddIntentStore((s) => s.setIntent);
  const { t } = useI18n();
  const [now] = useState(() => new Date());
  const [monthlyBudget, setMonthlyBudget] = useState<number>(DEFAULT_BUDGET);

  // Pet state
  const [petLevel, setPetLevel] = useState(0);
  const [petLastDate, setPetLastDate] = useState("");
  const [petLoaded, setPetLoaded] = useState(false);
  const [txLoaded, setTxLoaded] = useState(false);
  const [petGuideOpen, setPetGuideOpen] = useState(false);
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
          const [budgetValue, levelStr, lastDate] = await Promise.all([
            getBudgetForMonth(new Date()),
            getSetting(PET_LEVEL_KEY),
            getSetting(PET_LAST_DATE_KEY),
          ]);
          if (!active) return;
          setMonthlyBudget(budgetValue);
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
      return { label: t("healthy"), key: "healthy" as const, color: "#10b981", badge: "bg-emerald-500", textColor: "text-emerald-400", desc: t("controlledSpending") };
    }
    const allowedToToday = now.getDate() * dailyLimit;
    if (monthlyTotal > monthlyBudget) {
      return { label: t("overBudgetStatus"), key: "overbudget" as const, color: "#ef4444", badge: "bg-rose-500", textColor: "text-rose-400", desc: t("overspentMonth") };
    }
    if (monthlyTotal > allowedToToday * 1.2) {
      return { label: t("critical"), key: "critical" as const, color: "#f97316", badge: "bg-orange-500", textColor: "text-orange-400", desc: t("tooHighSpending") };
    }
    if (monthlyTotal > allowedToToday) {
      return { label: t("warning"), key: "warning" as const, color: "#f59e0b", badge: "bg-amber-500", textColor: "text-amber-400", desc: t("slightlyOverPlan") };
    }
    return { label: t("healthy"), key: "healthy" as const, color: "#10b981", badge: "bg-emerald-500", textColor: "text-emerald-400", desc: t("controlledSpending") };
  }, [monthlyTotal, monthlyBudget, dailyLimit, now, t]);

  const limitProgressPercent = useMemo(() => {
    if (dailyLimit <= 0) return 0;
    return Math.round((todayTotal / dailyLimit) * 100);
  }, [todayTotal, dailyLimit]);

  const latestTransactions = useMemo(() => [...transactions].slice(0, 5), [transactions]);

  const greeting = useMemo(() => {
    const hours = now.getHours();
    if (hours < 12) return `${t("goodMorning")} ☀️`;
    if (hours < 18) return `${t("goodAfternoon")} 🌤️`;
    return `${t("goodEvening")} 🌙`;
  }, [now, t]);

  const pet = useMemo(() => getPetEvolution(petLevel, t), [petLevel, t]);
  const petStages = useMemo(() => [
    { emoji: "🥚", name: t("petEgg"), range: "Lv.0", color: "#fef3c7", border: "#fde68a", min: 0 },
    { emoji: "🐣", name: t("petHatched"), range: "Lv.1-2", color: "#fff7ed", border: "#fed7aa", min: 1 },
    { emoji: "🐤", name: t("petBird"), range: "Lv.3-5", color: "#fefce8", border: "#fde047", min: 3 },
    { emoji: "🐱", name: t("petCat"), range: "Lv.6-10", color: "#fdf2f8", border: "#fbcfe8", min: 6 },
    { emoji: "🦊", name: t("petFox"), range: "Lv.11-18", color: "#fff1f2", border: "#fecdd3", min: 11 },
    { emoji: "🦄", name: t("petDragon"), range: "Lv.19-28", color: "#ecfeff", border: "#a5f3fc", min: 19 },
    { emoji: "🦖", name: t("petLegend"), range: "Lv.29+", color: "#eef2ff", border: "#c7d2fe", min: 29 },
  ], [t]);

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
      <View className="bg-indigo-600 rounded-3xl p-4 mb-3 shadow-xl relative overflow-hidden">
        <View className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-pink-500/30 blur-3xl" />
        <View className="absolute -left-16 -bottom-16 w-48 h-48 rounded-full bg-indigo-400/20 blur-3xl" />

        <View className="flex-row justify-between items-start">
          <View className="flex-1 pr-3">
            <Text className="text-[13px] font-black text-white tracking-tight">
              {t("dailyBudget")}: <Text className="text-2xl">{formatMoneyVnd(dailyLimit)}</Text>
            </Text>
            <Text className="text-[12px] font-semibold text-indigo-100 mt-1">
              {t("spentToday")}: {formatMoneyVnd(todayTotal)}
            </Text>
          </View>
        </View>

        {/* Daily limit progress */}
        <View className="mt-3.5">
          <View className="flex-row justify-between items-center mb-1.5">
            <Text className="text-indigo-200 text-[9px] font-bold uppercase tracking-wider">{t("dailyUsage")}</Text>
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

        <View className="w-full h-[1px] bg-white/10 my-3" />

        <View className="flex-row items-center">
          <Text className="text-indigo-200 text-[9px] uppercase font-extrabold tracking-wider mr-3">{t("thisMonth")}</Text>
          <Text className="text-base font-black text-white">
              {formatMoneyVnd(monthlyTotal)} / {formatMoneyVnd(monthlyBudget)} ({monthlySpentPercent}%)
          </Text>
        </View>
      </View>

      <Text className="text-[11px] font-semibold text-slate-500 mb-4 px-2 text-center">
        {monthlyTotal > monthlyBudget ? (
          <Text className="font-black text-rose-600">{t("overBudgetMessage")}</Text>
        ) : (
          <>
            {t("budgetAdvice")}{" "}
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
            <Pressable
              onPress={() => setPetGuideOpen(true)}
              className="active:scale-95"
            >
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
            </Pressable>

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
                    {t("nextEvolution")} Lv.{pet.nextAt} • {t("healthyDaily")}
                  </Text>
                )}
                {pet.nextAt === null && (
                  <Text className="text-[8px] text-slate-500 font-semibold mt-0.5">
                    {t("maxPetLevel")} ✨
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

      <Modal
        visible={petGuideOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPetGuideOpen(false)}
      >
        <View className="flex-1 bg-black/40 items-center justify-center px-5">
          <View className="w-full max-w-[420px] bg-white rounded-3xl p-5 border border-slate-100 shadow-xl">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-black text-slate-900">{t("petGuideTitle")}</Text>
              <Pressable onPress={() => setPetGuideOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center">
                <Ionicons name="close" size={16} color="#64748b" />
              </Pressable>
            </View>
            <Text className="text-xs font-semibold text-slate-500 leading-relaxed mb-4">
              {t("petGuideIntro")}
            </Text>
            <Text className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">{t("petGuideStages")}</Text>
            <View className="mb-4">
              {petStages.map((stage, idx) => {
                const reached = petLevel >= stage.min;
                return (
                  <View key={stage.name} className="flex-row items-center mb-2">
                    <View className="items-center mr-3">
                      <View
                        className="w-11 h-11 rounded-full items-center justify-center border"
                        style={{
                          backgroundColor: stage.color,
                          borderColor: reached ? monthlyStatus.color : stage.border,
                          borderWidth: reached ? 2 : 1,
                        }}
                      >
                        <Text className="text-2xl">{stage.emoji}</Text>
                      </View>
                      {idx < petStages.length - 1 ? (
                        <View
                          style={{
                            width: 2,
                            height: 18,
                            backgroundColor: reached ? monthlyStatus.color : "#e2e8f0",
                            marginTop: 3,
                          }}
                        />
                      ) : null}
                    </View>
                    <View
                      className="flex-1 rounded-2xl px-3 py-2 border"
                      style={{
                        backgroundColor: reached ? stage.color : "#f8fafc",
                        borderColor: reached ? monthlyStatus.color + "55" : "#e2e8f0",
                      }}
                    >
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-black text-slate-800">{stage.name}</Text>
                        <Text className="text-[10px] font-black text-indigo-600">{stage.range}</Text>
                      </View>
                      <Text className="text-[9px] font-bold mt-0.5" style={{ color: reached ? monthlyStatus.color : "#94a3b8" }}>
                        {reached ? t("petReached") : t("petLocked")}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
            <View className="hidden">
              {petStages.map((stage) => (
                <View
                  key={stage.name}
                  className="items-center rounded-2xl px-3 py-3 border"
                  style={{
                    width: "31%",
                    backgroundColor: stage.color,
                    borderColor: petLevel >= stage.min ? monthlyStatus.color : stage.border,
                    borderWidth: petLevel >= stage.min ? 2 : 1,
                  }}
                >
                  <View className="w-10 h-10 rounded-full bg-white/70 items-center justify-center mb-1.5">
                    <Text className="text-2xl">{stage.emoji}</Text>
                  </View>
                  <Text className="text-[10px] font-black text-slate-800 text-center" numberOfLines={1}>{stage.name}</Text>
                  <Text className="text-[9px] font-black text-indigo-600 mt-0.5">{stage.range}</Text>
                  {petLevel >= stage.min ? (
                    <View className="mt-1 px-1.5 py-0.5 rounded-full bg-white/70">
                      <Text className="text-[8px] font-black" style={{ color: monthlyStatus.color }}>✓</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
            <Text className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{t("petGuideHow")}</Text>
            <Text className="text-xs font-semibold text-slate-600 leading-relaxed">
              {t("petGuideHowText")}
            </Text>
          </View>
        </View>
      </Modal>

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
            <Text className="text-sm font-black text-slate-800">{t("noRecentTransactions")}</Text>
            <Text className="text-xs text-slate-400 text-center mt-1">
              {t("noRecentTransactionsHint")}
            </Text>
          </View>
        }
      />
    </View>
    </KeyboardAvoidingView>
  );
}
