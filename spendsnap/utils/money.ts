export function parseMoneyToVnd(input: string): number {
  const cleaned = input.replace(/[^\d]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoneyVnd(amount: number) {
  try {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  } catch {
    return `${amount} ₫`;
  }
}

