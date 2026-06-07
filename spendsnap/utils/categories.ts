import type { AppLanguage } from "../stores/preferences";

export const CANONICAL_CATEGORIES = ["Food", "Drinks", "Travel", "Shopping", "Entertainment", "Bills", "Others"] as const;

export type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number];

const VI_LABELS: Record<CanonicalCategory, string> = {
  Food: "Ăn uống",
  Drinks: "Đồ uống",
  Travel: "Di chuyển",
  Shopping: "Mua sắm",
  Entertainment: "Giải trí",
  Bills: "Hóa đơn",
  Others: "Khác",
};

const EN_LABELS: Record<CanonicalCategory, string> = {
  Food: "Food",
  Drinks: "Drinks",
  Travel: "Travel",
  Shopping: "Shopping",
  Entertainment: "Entertainment",
  Bills: "Bills",
  Others: "Others",
};

export function normalizeCategoryName(value?: string | null): CanonicalCategory {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "Others";

  if (raw === "food" || raw.includes("ăn") || raw.includes("an uong") || raw.includes("phở") || raw.includes("pho")) return "Food";
  if (
    raw === "drinks" ||
    raw.includes("đồ uống") ||
    raw.includes("do uong") ||
    raw.includes("coffee") ||
    raw.includes("cà phê") ||
    raw.includes("cafe") ||
    raw.includes("tra sua") ||
    raw.includes("trà sữa")
  ) {
    return "Drinks";
  }
  if (raw === "travel" || raw === "transport" || raw.includes("di chuyển") || raw.includes("di chuyen") || raw.includes("grab") || raw.includes("taxi")) return "Travel";
  if (raw === "shopping" || raw.includes("mua sắm") || raw.includes("mua sam") || raw.includes("shop") || raw.includes("shopee") || raw.includes("lazada")) return "Shopping";
  if (raw === "entertainment" || raw.includes("giải trí") || raw.includes("giai tri") || raw.includes("movie") || raw.includes("phim") || raw.includes("game")) return "Entertainment";
  if (raw === "bills" || raw.includes("hóa đơn") || raw.includes("hoa don") || raw.includes("bill") || raw.includes("điện") || raw.includes("internet")) return "Bills";

  return "Others";
}

export function categoryLabel(value: string | null | undefined, language: AppLanguage) {
  const category = normalizeCategoryName(value);
  return language === "vi" ? VI_LABELS[category] : EN_LABELS[category];
}

export function categoryEmoji(value?: string | null) {
  const category = normalizeCategoryName(value);
  if (category === "Food") return "\u{1f35c}";
  if (category === "Drinks") return "\u{2615}";
  if (category === "Travel") return "\u{1f697}";
  if (category === "Shopping") return "\u{1f6cd}\u{fe0f}";
  if (category === "Entertainment") return "\u{1f3ac}";
  if (category === "Bills") return "\u{26a1}";
  return "\u{1f4e6}";
}

export function categoryBgClass(value?: string | null) {
  const category = normalizeCategoryName(value);
  if (category === "Food") return "bg-orange-50";
  if (category === "Drinks") return "bg-amber-50";
  if (category === "Travel") return "bg-sky-50";
  if (category === "Shopping") return "bg-purple-50";
  if (category === "Entertainment") return "bg-rose-50";
  if (category === "Bills") return "bg-emerald-50";
  return "bg-slate-100";
}

export function categoryBgColor(value?: string | null) {
  const category = normalizeCategoryName(value);
  if (category === "Food") return "#fff7ed";
  if (category === "Drinks") return "#fffbeb";
  if (category === "Travel") return "#f0f9ff";
  if (category === "Shopping") return "#faf5ff";
  if (category === "Entertainment") return "#fff1f2";
  if (category === "Bills") return "#ecfdf5";
  return "#f1f5f9";
}
