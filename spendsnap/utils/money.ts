export function parseMoneyToVnd(input: string): number {
  const normalized = input.toLowerCase().replace(/,/g, "");
  let multiplier = 1000;
  if (normalized.includes("m") || normalized.includes("tr")) {
    multiplier = 1000000;
  } else if (normalized.includes("k") || /\d/.test(normalized)) {
    multiplier = 1000;
  }
  const cleaned = normalized.replace(/[^\d.]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned) * multiplier;
  return Number.isFinite(n) ? n : 0;
}

export function formatMoneyVnd(amount: number) {
  try {
    if (amount === 0) return "0 k";
    const kValue = Math.round(amount / 1000);
    return `${kValue} k`;
  } catch {
    return `${amount} k`;
  }
}
