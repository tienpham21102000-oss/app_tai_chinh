import { useEffect } from "react";

import { usePreferencesStore, type AppLanguage } from "../stores/preferences";

const dictionary = {
  vi: {
    addCategory: "Thêm danh mục",
    aiVoice: "AI Voice",
    all: "Tất cả",
    analytics: "Phân tích",
    bills: "Hóa đơn",
    cancel: "Hủy",
    categories: "Danh mục",
    category: "Danh mục",
    chooseCategory: "Chọn danh mục",
    chooseIcon: "Chọn icon",
    color: "Màu",
    custom: "Tùy chọn",
    dailyReminders: "Nhắc hằng ngày",
    dateAll: "Tất cả",
    drinks: "Đồ uống",
    english: "English",
    food: "Ăn uống",
    from: "Từ",
    fun: "Giải trí",
    history: "Lịch sử",
    home: "Home",
    language: "Ngôn ngữ",
    last30d: "30 ngày",
    monthlyBudget: "Ngân sách tháng",
    name: "Tên",
    noTransactions: "Không có giao dịch phù hợp",
    quickType: "Quick Type",
    resetCategories: "Khôi phục danh mục mặc định",
    resetDatabase: "Xóa dữ liệu cục bộ",
    saveExpense: "Lưu chi tiêu",
    scanBill: "Scan Bill",
    settings: "Cài đặt",
    shop: "Mua sắm",
    showing: "Đang hiển thị",
    sum: "Tổng",
    sync: "Đồng bộ Supabase",
    to: "Đến",
    travel: "Di chuyển",
    vietnamese: "Tiếng Việt",
    week: "Tuần này",
    yourCategories: "Danh mục của bạn",
  },
  en: {
    addCategory: "Add Category",
    aiVoice: "AI Voice",
    all: "All",
    analytics: "Analytics",
    bills: "Bills",
    cancel: "Cancel",
    categories: "Categories",
    category: "Category",
    chooseCategory: "Choose category",
    chooseIcon: "Choose icon",
    color: "Color",
    custom: "Custom",
    dailyReminders: "Daily Reminders",
    dateAll: "All",
    drinks: "Drinks",
    english: "English",
    food: "Food",
    from: "From",
    fun: "Fun",
    history: "History",
    home: "Home",
    language: "Language",
    last30d: "30d",
    monthlyBudget: "Monthly Budget",
    name: "Name",
    noTransactions: "No transactions match search",
    quickType: "Quick Type",
    resetCategories: "Restore default categories",
    resetDatabase: "Reset Local Database",
    saveExpense: "Save expense",
    scanBill: "Scan Bill",
    settings: "Settings",
    shop: "Shop",
    showing: "Showing",
    sum: "Sum",
    sync: "Supabase Cloud Sync",
    to: "To",
    travel: "Travel",
    vietnamese: "Tiếng Việt",
    week: "Week",
    yourCategories: "Your Categories",
  },
} satisfies Record<AppLanguage, Record<string, string>>;

export function translate(language: AppLanguage, key: keyof typeof dictionary.en) {
  return dictionary[language][key] ?? dictionary.en[key] ?? key;
}

export function useI18n() {
  const language = usePreferencesStore((s) => s.language);
  const loaded = usePreferencesStore((s) => s.loaded);
  const loadLanguage = usePreferencesStore((s) => s.loadLanguage);

  useEffect(() => {
    if (!loaded) void loadLanguage();
  }, [loadLanguage, loaded]);

  return {
    language,
    t: (key: keyof typeof dictionary.en) => translate(language, key),
  };
}
