import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";

import { deleteCategory, ensureDbReady, listCategories, restoreDefaultCategories, upsertCategory, type DbCategoryRow } from "../services/db";
import { deleteCategoryFromSupabaseIfEnabled, replaceCategoriesInSupabaseIfEnabled, syncTransactionsToSupabaseIfEnabled } from "../services/sync";
import { categoryLabel } from "../utils/categories";
import { useI18n } from "../utils/i18n";
import { uuid } from "../utils/uuid";

const COLOR_PRESETS = ["#f97316", "#a855f7", "#0ea5e9", "#ec4899", "#22c55e", "#f59e0b", "#64748b", "#6366f1", "#ef4444"];
const ICON_PRESETS = [
  "\u{1f35c}",
  "\u{2615}",
  "\u{1f6f5}",
  "\u{1f6cd}\u{fe0f}",
  "\u{1f3ac}",
  "\u{1f9fe}",
  "\u{1f4cc}",
  "\u{1f48a}",
  "\u{1f3e0}",
  "\u{1f381}",
  "\u{2708}\u{fe0f}",
  "\u{1f4da}",
];
const TAG_ICON = "\u{1f3f7}\u{fe0f}";

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
  const { t, language } = useI18n();
  const [items, setItems] = useState<DbCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(TAG_ICON);
  const [color, setColor] = useState(COLOR_PRESETS[0]);

  const isVi = language === "vi";
  const canAdd = name.trim().length > 0 && icon.trim().length > 0;

  const copy = {
    loadFailed: isVi ? "Tải danh mục thất bại" : "Load failed",
    addFailed: isVi ? "Thêm danh mục thất bại" : "Add failed",
    deleteTitle: isVi ? "Xóa danh mục?" : "Delete category?",
    deleteBody: isVi
      ? "Danh mục sẽ bị xóa khỏi danh sách. Giao dịch cũ vẫn giữ nhãn đã ghi."
      : "This removes the category entry. Existing transactions keep their saved label.",
    deleteFailed: isVi ? "Xóa danh mục thất bại" : "Delete failed",
    restoreBody: isVi ? "Thay danh sách hiện tại bằng danh mục mặc định?" : "Replace the current category list with defaults?",
    restore: isVi ? "Khôi phục" : "Restore",
    restoreFailed: isVi ? "Khôi phục thất bại" : "Restore failed",
    namePlaceholder: isVi ? "Cà phê, đi chợ..." : "Coffee, groceries...",
    iconLabel: isVi ? "Biểu tượng" : "Icon",
    loading: isVi ? "Đang tải..." : "Loading...",
    empty: isVi ? "Chưa có danh mục. Bạn có thể thêm danh mục mới bên trên." : "No categories yet. Add one above.",
    deleteHint: isVi ? "Có thể xóa cả danh mục mặc định nếu bạn không cần." : "Default categories can be deleted if you do not need them.",
  };

  async function refresh() {
    await ensureDbReady();
    setItems(await listCategories());
  }

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      (async () => {
        try {
          await refresh();
        } catch (e) {
          if (active) Alert.alert(copy.loadFailed, e instanceof Error ? e.message : "Unknown error");
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [copy.loadFailed])
  );

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
      setIcon(TAG_ICON);
      setColor(COLOR_PRESETS[0]);
      await refresh();
      void syncTransactionsToSupabaseIfEnabled().catch((error) => {
        console.warn("Background category add sync failed:", error);
      });
    } catch (e) {
      Alert.alert(copy.addFailed, e instanceof Error ? e.message : "Unknown error");
    }
  }

  function onDelete(id: string) {
    Alert.alert(copy.deleteTitle, copy.deleteBody, [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await ensureDbReady();
            await deleteCategory(id);
            await refresh();
            void deleteCategoryFromSupabaseIfEnabled(id).catch((error) => {
              console.warn("Background category delete sync failed:", error);
            });
          } catch (e) {
            Alert.alert(copy.deleteFailed, e instanceof Error ? e.message : "Unknown error");
          }
        },
      },
    ]);
  }

  function onRestoreDefaults() {
    Alert.alert(t("resetCategories"), copy.restoreBody, [
      { text: t("cancel"), style: "cancel" },
      {
        text: copy.restore,
        onPress: async () => {
          try {
            await ensureDbReady();
            await restoreDefaultCategories();
            await refresh();
            void replaceCategoriesInSupabaseIfEnabled().catch((error) => {
              console.warn("Background category restore sync failed:", error);
            });
          } catch (e) {
            Alert.alert(copy.restoreFailed, e instanceof Error ? e.message : "Unknown error");
          }
        },
      },
    ]);
  }

  return (
    <ScrollView className="flex-1 bg-[#f8fafc] px-4 pt-10" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>
      <View className="flex-row items-center justify-between mb-4">
        <Pressable onPress={() => router.back()} className="w-9 h-9 rounded-full bg-white border border-slate-100 shadow-sm items-center justify-center">
          <Ionicons name="arrow-back" size={18} color="#64748b" />
        </Pressable>
        <Text className="text-sm font-black text-slate-700">{t("categories")}</Text>
        <View style={{ width: 36 }} />
      </View>

      <View className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm mb-5">
        <Text className="text-base font-extrabold text-slate-900 mb-4">{t("addCategory")}</Text>

        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t("name")}</Text>
        <View className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5 mb-3">
          <TextInput value={name} onChangeText={setName} placeholder={copy.namePlaceholder} placeholderTextColor="#94a3b8" className="text-sm font-bold text-slate-800" />
        </View>

        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{copy.iconLabel}</Text>
        <View className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5">
          <TextInput value={icon} onChangeText={setIcon} placeholder={TAG_ICON} placeholderTextColor="#94a3b8" className="text-sm font-bold text-slate-800" />
        </View>
        <View className="flex-row flex-wrap gap-2 mt-3 mb-3">
          {ICON_PRESETS.map((item) => {
            const active = item === icon;
            return (
              <Pressable key={item} onPress={() => setIcon(item)} className={`w-12 h-12 rounded-2xl items-center justify-center border ${active ? "bg-indigo-50 border-indigo-500" : "bg-slate-50 border-slate-100"}`}>
                <Text className="text-xl">{item}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{t("color")}</Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {COLOR_PRESETS.map((c) => (
            <Pressable key={c} onPress={() => setColor(c)} style={[styles.colorButton, { backgroundColor: c, borderColor: c === color ? "#0f172a" : "#e2e8f0" }]}>
              {c === color ? <Ionicons name="checkmark" size={18} color="white" /> : null}
            </Pressable>
          ))}
        </View>

        <Pressable onPress={onAdd} disabled={!canAdd} style={[styles.addButton, { opacity: !canAdd ? 0.4 : 1 }]}>
          <Ionicons name="add-circle" size={18} color="white" />
          <Text className="text-white font-extrabold text-sm">{t("addCategory")}</Text>
        </Pressable>
      </View>

      <View className="flex-row items-center justify-between mb-3 px-1">
        <View className="flex-1 pr-3">
          <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t("yourCategories")}</Text>
          <Text className="text-[10px] text-slate-400 mt-1">{copy.deleteHint}</Text>
        </View>
        <Pressable onPress={onRestoreDefaults} className="px-3 py-2 rounded-2xl bg-indigo-50">
          <Text className="text-[10px] font-black text-indigo-600">{t("resetCategories")}</Text>
        </Pressable>
      </View>

      <View className="bg-white border border-slate-100 rounded-3xl overflow-hidden mb-12 shadow-sm">
        {loading ? (
          <View className="px-5 py-6">
            <Text className="text-xs text-slate-400 font-semibold">{copy.loading}</Text>
          </View>
        ) : items.length === 0 ? (
          <View className="px-5 py-6">
            <Text className="text-xs text-slate-400 font-semibold">{copy.empty}</Text>
          </View>
        ) : (
          items.map((item, idx) => (
            <View key={item.id} className={`flex-row items-center justify-between px-5 py-4 ${idx === items.length - 1 ? "" : "border-b border-slate-50"}`}>
              <View className="flex-row items-center gap-3.5 flex-1">
                <View className="w-10 h-10 rounded-2xl items-center justify-center" style={{ backgroundColor: item.color ?? "#e2e8f0" }}>
                  <Text className="text-base">{item.icon ?? TAG_ICON}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-slate-800">{item.name ? categoryLabel(item.name, language) : "Unnamed"}</Text>
                  <Text className="text-[10px] text-slate-400 font-medium">{copy.deleteHint}</Text>
                </View>
              </View>
              <Pressable onPress={() => onDelete(item.id)} style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={18} color="#e11d48" />
              </Pressable>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
