import type { AppLanguage } from "../stores/preferences";

export const CANONICAL_CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Housing",
  "Health",
  "Education",
  "Entertainment",
  "Family",
  "Work",
  "Investment",
  "Others",
] as const;

export type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number];

const VI_LABELS: Record<CanonicalCategory, string> = {
  Food: "Ăn uống",
  Transport: "Di chuyển",
  Shopping: "Mua sắm",
  Housing: "Nhà ở",
  Health: "Sức khỏe",
  Education: "Giáo dục",
  Entertainment: "Giải trí",
  Family: "Gia đình",
  Work: "Công việc",
  Investment: "Đầu tư",
  Others: "Khác",
};

const EN_LABELS: Record<CanonicalCategory, string> = {
  Food: "Food",
  Transport: "Transport",
  Shopping: "Shopping",
  Housing: "Housing",
  Health: "Health",
  Education: "Education",
  Entertainment: "Entertainment",
  Family: "Family",
  Work: "Work",
  Investment: "Investment",
  Others: "Others",
};

export function normalizeCategoryName(value?: string | null): CanonicalCategory {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "Others";

  if (
    raw === "food" ||
    raw === "drinks" ||
    raw.includes("ăn") ||
    raw.includes("an uong") ||
    raw.includes("phở") ||
    raw.includes("pho") ||
    raw.includes("coffee") ||
    raw.includes("cà phê") ||
    raw.includes("cafe") ||
    raw.includes("trà sữa") ||
    raw.includes("tra sua") ||
    raw.includes("restaurant") ||
    raw.includes("drink")
  ) {
    return "Food";
  }
  if (raw === "transport" || raw === "travel" || raw.includes("di chuyển") || raw.includes("di chuyen") || raw.includes("grab") || raw.includes("taxi") || raw.includes("bus") || raw.includes("train")) return "Transport";
  if (raw === "shopping" || raw.includes("mua sắm") || raw.includes("mua sam") || raw.includes("shop") || raw.includes("shopee") || raw.includes("lazada") || raw.includes("tiki")) return "Shopping";
  if (raw === "housing" || raw === "bills" || raw.includes("nhà") || raw.includes("nha o") || raw.includes("thuê nhà") || raw.includes("rent") || raw.includes("điện") || raw.includes("nước") || raw.includes("internet") || raw.includes("bill")) return "Housing";
  if (raw === "health" || raw.includes("sức khỏe") || raw.includes("suc khoe") || raw.includes("thuốc") || raw.includes("benh vien") || raw.includes("bệnh viện") || raw.includes("doctor") || raw.includes("medicine")) return "Health";
  if (raw === "education" || raw.includes("giáo dục") || raw.includes("giao duc") || raw.includes("học") || raw.includes("school") || raw.includes("book") || raw.includes("course")) return "Education";
  if (raw === "entertainment" || raw.includes("giải trí") || raw.includes("giai tri") || raw.includes("movie") || raw.includes("phim") || raw.includes("game") || raw.includes("music")) return "Entertainment";
  if (raw === "family" || raw.includes("gia đình") || raw.includes("gia dinh") || raw.includes("con cái") || raw.includes("child") || raw.includes("kids") || raw.includes("baby")) return "Family";
  if (raw === "work" || raw.includes("công việc") || raw.includes("cong viec") || raw.includes("office") || raw.includes("business") || raw.includes("cowork")) return "Work";
  if (raw === "investment" || raw.includes("đầu tư") || raw.includes("dau tu") || raw.includes("stock") || raw.includes("crypto") || raw.includes("fund") || raw.includes("saving")) return "Investment";

  return "Others";
}

export function categoryLabel(value: string | null | undefined, language: AppLanguage) {
  const category = normalizeCategoryName(value);
  return language === "vi" ? VI_LABELS[category] : EN_LABELS[category];
}

export function categoryEmoji(value?: string | null) {
  const category = normalizeCategoryName(value);
  if (category === "Food") return "\u{1f35c}";
  if (category === "Transport") return "\u{1f6f5}";
  if (category === "Shopping") return "\u{1f6cd}\u{fe0f}";
  if (category === "Housing") return "\u{1f3e0}";
  if (category === "Health") return "\u{1f48a}";
  if (category === "Education") return "\u{1f4da}";
  if (category === "Entertainment") return "\u{1f3ac}";
  if (category === "Family") return "\u{1f46a}";
  if (category === "Work") return "\u{1f4bc}";
  if (category === "Investment") return "\u{1f4c8}";
  return "\u{1f4cc}";
}

export function categoryBgClass(value?: string | null) {
  const category = normalizeCategoryName(value);
  if (category === "Food") return "bg-orange-50";
  if (category === "Transport") return "bg-sky-50";
  if (category === "Shopping") return "bg-purple-50";
  if (category === "Housing") return "bg-emerald-50";
  if (category === "Health") return "bg-rose-50";
  if (category === "Education") return "bg-blue-50";
  if (category === "Entertainment") return "bg-pink-50";
  if (category === "Family") return "bg-amber-50";
  if (category === "Work") return "bg-indigo-50";
  if (category === "Investment") return "bg-lime-50";
  return "bg-slate-100";
}

export function categoryBgColor(value?: string | null) {
  const category = normalizeCategoryName(value);
  if (category === "Food") return "#fff7ed";
  if (category === "Transport") return "#f0f9ff";
  if (category === "Shopping") return "#faf5ff";
  if (category === "Housing") return "#ecfdf5";
  if (category === "Health") return "#fff1f2";
  if (category === "Education") return "#eff6ff";
  if (category === "Entertainment") return "#fdf2f8";
  if (category === "Family") return "#fffbeb";
  if (category === "Work") return "#eef2ff";
  if (category === "Investment") return "#f7fee7";
  return "#f1f5f9";
}
