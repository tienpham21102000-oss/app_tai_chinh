import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ensureDbReady, listCategories, upsertCategory, deleteCategory, type DbCategoryRow } from "../services/db";
import { formatMoneyVnd, parseMoneyToVnd } from "../utils/money";
import { uuid } from "../utils/uuid";

const COLOR_PRESETS = [
  "#f97316",
  "#a855f7",
  "#0ea5e9",
  "#ec4899",
  "#22c55e",
  "#f59e0b",
  "#64748b",
  "#6366f1",
  "#ef4444",
];

export default function CategoriesModal() {
  const [items, setItems] = useState<DbCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🏷️");
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [budgetRaw, setBudgetRaw] = useState("0");

  const budgetValue = useMemo(() => parseMoneyToVnd(budgetRaw), [budgetRaw]);
  const canAdd = name.trim().length > 0 && icon.trim().length > 0;

  async function refresh() {
    await ensureDbReady();
    const rows = await listCategories();
    setItems(rows);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await refresh();
      } catch (e) {
        if (mounted) Alert.alert("Load failed", e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function onAdd() {
    if (!canAdd) return;
    try {
      await ensureDbReady();
      await upsertCategory({
        id: uuid(),
        name: name.trim(),
        icon: icon.trim(),
        color,
        budget_monthly: budgetValue,
      });
      setName("");
      setIcon("🏷️");
      setColor(COLOR_PRESETS[0]);
      setBudgetRaw("0");
      await refresh();
    } catch (e) {
      Alert.alert("Add failed", e instanceof Error ? e.message : "Unknown error");
    }
  }

  async function onDelete(id: string) {
    Alert.alert("Delete category?", "This will remove the category entry (existing transactions keep their text label).", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await ensureDbReady();
            await deleteCategory(id);
            await refresh();
          } catch (e) {
            Alert.alert("Delete failed", e instanceof Error ? e.message : "Unknown error");
          }
        },
      },
    ]);
  }

  return (
    <ScrollView className="flex-1 bg-[#f8fafc] px-4 pt-10" showsVerticalScrollIndicator={false}>
      <View className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm mb-5">
        <Text className="text-base font-extrabold text-slate-900 mb-4">Add Category</Text>

        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Name</Text>
        <View className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5 mb-3">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Coffee, Groceries..."
            placeholderTextColor="#94a3b8"
            className="text-sm font-bold text-slate-800"
          />
        </View>

        <View className="flex-row gap-3 mb-3">
          <View className="flex-1">
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Icon (emoji)</Text>
            <View className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5">
              <TextInput
                value={icon}
                onChangeText={setIcon}
                placeholder="🍜"
                placeholderTextColor="#94a3b8"
                className="text-sm font-bold text-slate-800"
              />
            </View>
          </View>

          <View className="flex-1">
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Monthly budget</Text>
            <View className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5">
              <TextInput
                value={budgetRaw}
                onChangeText={setBudgetRaw}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#94a3b8"
                className="text-sm font-bold text-slate-800"
              />
            </View>
          </View>
        </View>
        <Text className="text-[10px] text-indigo-500 font-semibold mb-3 px-1">
          {formatMoneyVnd(budgetValue)}
        </Text>

        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Color</Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {COLOR_PRESETS.map((c) => {
            const active = c === color;
            return (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                className={`w-10 h-10 rounded-2xl items-center justify-center border ${active ? "border-slate-900" : "border-slate-200"}`}
                style={{ backgroundColor: c }}
              >
                {active ? <Ionicons name="checkmark" size={18} color="white" /> : null}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={onAdd}
          disabled={!canAdd}
          className="w-full flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 shadow-md active:scale-95 disabled:opacity-40"
        >
          <Ionicons name="add-circle" size={18} color="white" />
          <Text className="text-white font-extrabold text-sm">Add Category</Text>
        </Pressable>
      </View>

      <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Your Categories</Text>
      <View className="bg-white border border-slate-100 rounded-3xl overflow-hidden mb-12 shadow-sm">
        {loading ? (
          <View className="px-5 py-6">
            <Text className="text-xs text-slate-400 font-semibold">Loading...</Text>
          </View>
        ) : items.length === 0 ? (
          <View className="px-5 py-6">
            <Text className="text-xs text-slate-400 font-semibold">No categories yet.</Text>
          </View>
        ) : (
          items.map((item, idx) => (
            <View
              key={item.id}
              className={`flex-row items-center justify-between px-5 py-4 ${idx === items.length - 1 ? "" : "border-b border-slate-50"}`}
            >
              <View className="flex-row items-center gap-3.5 flex-1">
                <View
                  className="w-10 h-10 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: item.color ?? "#e2e8f0" }}
                >
                  <Text className="text-base">{item.icon ?? "🏷️"}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-slate-800">{item.name ?? "Unnamed"}</Text>
                  <Text className="text-[10px] text-slate-400 font-medium">
                    Budget: {formatMoneyVnd(Number(item.budget_monthly ?? 0))}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => onDelete(item.id)}
                className="w-10 h-10 rounded-2xl bg-rose-50 items-center justify-center active:scale-95"
              >
                <Ionicons name="trash-outline" size={18} color="#e11d48" />
              </Pressable>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

