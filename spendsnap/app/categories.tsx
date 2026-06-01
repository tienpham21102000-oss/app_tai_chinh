import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { ensureDbReady, listCategories, upsertCategory, deleteCategory, restoreDefaultCategories, type DbCategoryRow } from "../services/db";
import { useI18n } from "../utils/i18n";
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

const ICON_PRESETS = ["🍜", "☕", "🛵", "🛍️", "🎬", "🧾", "📌", "💊", "🏠", "🎁", "✈️", "📚"];

const styles = StyleSheet.create({
  colorButton: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  addButton: {
    alignItems: "center",
    backgroundColor: "#10b981",
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 16,
    width: "100%",
  },
  deleteButton: {
    alignItems: "center",
    backgroundColor: "#fff1f2",
    borderRadius: 16,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
});

export default function CategoriesModal() {
  const { t } = useI18n();
  const [items, setItems] = useState<DbCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🏷️");
  const [color, setColor] = useState(COLOR_PRESETS[0]);

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
        budget_monthly: 0,
      });
      setName("");
      setIcon("🏷️");
      setColor(COLOR_PRESETS[0]);
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

  function onRestoreDefaults() {
    Alert.alert(t("resetCategories"), "Replace current category list with the default labels?", [
      { text: t("cancel"), style: "cancel" },
      {
        text: "Restore",
        onPress: async () => {
          try {
            await ensureDbReady();
            await restoreDefaultCategories();
            await refresh();
          } catch (e) {
            Alert.alert("Restore failed", e instanceof Error ? e.message : "Unknown error");
          }
        },
      },
    ]);
  }

  return (
    <ScrollView className="flex-1 bg-[#f8fafc] px-4 pt-10" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>
      <View className="flex-row items-center justify-between mb-4">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-white border border-slate-100 shadow-sm items-center justify-center"
        >
          <Ionicons name="arrow-back" size={18} color="#64748b" />
        </Pressable>
        <Text className="text-sm font-black text-slate-700">{t("categories")}</Text>
        <View style={{ width: 36 }} />
      </View>

      <View className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm mb-5">
        <Text className="text-base font-extrabold text-slate-900 mb-4">{t("addCategory")}</Text>

        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t("name")}</Text>
        <View className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5 mb-3">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Coffee, Groceries..."
            placeholderTextColor="#94a3b8"
            className="text-sm font-bold text-slate-800"
          />
        </View>

        <View className="mb-3">
          <View>
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
            <View className="flex-row flex-wrap gap-2 mt-3">
              {ICON_PRESETS.map((item) => {
                const active = item === icon;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setIcon(item)}
                    className={`w-12 h-12 rounded-2xl items-center justify-center border ${active ? "bg-indigo-50 border-indigo-500" : "bg-slate-50 border-slate-100"}`}
                  >
                    <Text className="text-xl">{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Color</Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {COLOR_PRESETS.map((c) => {
            const active = c === color;
            return (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                style={[
                  styles.colorButton,
                  {
                    backgroundColor: c,
                    borderColor: active ? "#0f172a" : "#e2e8f0",
                  },
                ]}
              >
                {active ? <Ionicons name="checkmark" size={18} color="white" /> : null}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={onAdd}
          disabled={!canAdd}
          style={[
            styles.addButton,
            {
              opacity: !canAdd ? 0.4 : 1,
            },
          ]}
        >
          <Ionicons name="add-circle" size={18} color="white" />
          <Text className="text-white font-extrabold text-sm">{t("addCategory")}</Text>
        </Pressable>
      </View>

      <View className="flex-row items-center justify-between mb-3 px-1">
        <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t("yourCategories")}</Text>
        <Pressable onPress={onRestoreDefaults} className="px-3 py-2 rounded-2xl bg-indigo-50">
          <Text className="text-[10px] font-black text-indigo-600">{t("resetCategories")}</Text>
        </Pressable>
      </View>
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
                  <Text className="text-[10px] text-slate-400 font-medium">Tap trash to remove this label</Text>
                </View>
              </View>

              <Pressable
                onPress={() => onDelete(item.id)}
                style={styles.deleteButton}
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
