import { getSetting } from "../services/db";

export const LEGACY_BUDGET_KEY = "monthly_budget_vnd";
export const DEFAULT_BUDGET = 5_000_000;

export function monthBudgetKey(date: Date) {
  return `monthly_budget_vnd_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(date: Date, language: "vi" | "en") {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return language === "vi" ? `Tháng ${month}/${year}` : `Month ${month}/${year}`;
}

export function isPastBudgetMonth(date: Date, now = new Date()) {
  const selected = date.getFullYear() * 12 + date.getMonth();
  const current = now.getFullYear() * 12 + now.getMonth();
  return selected < current;
}

export async function getBudgetForMonth(date: Date) {
  const monthValue = await getSetting(monthBudgetKey(date));
  const legacyValue = await getSetting(LEGACY_BUDGET_KEY);
  const parsed = Number(monthValue ?? legacyValue ?? DEFAULT_BUDGET);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BUDGET;
}
