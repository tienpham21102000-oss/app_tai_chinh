import type { Transaction } from "../stores/transactions";

const CATEGORY_CONFIG = [
  {
    name: "Food",
    merchants: ["Highlands Coffee", "Phở 24", "Cơm Bình Dân", "Lotteria", "Bún Chả HN", "Cơm Tấm Tứ Hải"],
    notes: ["Cơm trưa", "Phở bò", "Bún chả", "Cơm gà xối mỡ", "Cơm sườn"],
    min: 35000,
    max: 120000,
    weight: 30,
  },
  {
    name: "Drinks",
    merchants: ["Starbucks", "The Coffee House", "Phúc Long", "Trà Sữa Gong Cha", "Cà phê Bệt"],
    notes: ["Cà phê đá", "Trà sữa", "Nước ép", "Sinh tố", "Matcha latte"],
    min: 25000,
    max: 90000,
    weight: 18,
  },
  {
    name: "Travel",
    merchants: ["Grab", "Be", "Vinasun", "Mai Linh", "Bến xe Miền Đông"],
    notes: ["Taxi & xe ôm", "Đi qua cầu", "Chuyến công việc", "Đón khách", "Di chuyển nội thành"],
    min: 15000,
    max: 120000,
    weight: 16,
  },
  {
    name: "Shopping",
    merchants: ["Shopee", "Lazada", "Tiki", "VinMart", "Big C", "AEON Mall"],
    notes: ["Mua quần áo", "Đồ gia dụng", "Order online", "Siêu thị", "Mua sắm gia đình"],
    min: 50000,
    max: 600000,
    weight: 16,
  },
  {
    name: "Entertainment",
    merchants: ["CGV", "Lotte Cinema", "Nhà sách Fahasa", "Quán game", "The Music Room"],
    notes: ["Xem phim", "Ra quán game", "Sách mới", "Nhạc sống", "Giải trí cuối tuần"],
    min: 20000,
    max: 350000,
    weight: 10,
  },
  {
    name: "Bills",
    merchants: ["EVN", "VNPT", "FPT Telecom", "Viettel", "Cấp nước TP"],
    notes: ["Thanh toán điện", "Tiền nước", "Internet tháng", "Cước mạng", "Hóa đơn dịch vụ"],
    min: 150000,
    max: 450000,
    weight: 10,
  },
  {
    name: "Others",
    merchants: ["Tiệm tạp hóa", "Hiệu thuốc", "Tiệm làm đẹp", "Bưu điện", "Gara"],
    notes: ["Mua linh kiện", "Thuốc men", "Dịch vụ nhỏ", "Gửi hàng", "Sửa xe"],
    min: 20000,
    max: 250000,
    weight: 10,
  },
];

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function pickCategory(rng: () => number): typeof CATEGORY_CONFIG[number] {
  const totalWeight = CATEGORY_CONFIG.reduce((sum, item) => sum + item.weight, 0);
  let target = rng() * totalWeight;
  for (const item of CATEGORY_CONFIG) {
    target -= item.weight;
    if (target <= 0) return item;
  }
  return CATEGORY_CONFIG[CATEGORY_CONFIG.length - 1];
}

export function generateFixedSpendingYears(): Transaction[] {
  const rng = createRng(20260601);
  const transactions: Transaction[] = [];

  for (let year = 2022; year <= 2026; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const entries = year === 2026 && month > 5 ? 0 : randomInt(rng, 12, 24);

      for (let i = 0; i < entries; i += 1) {
        const category = pickCategory(rng);
        const day = randomInt(rng, 1, daysInMonth);
        const date = new Date(year, month, day, randomInt(rng, 8, 22), randomInt(rng, 0, 59), randomInt(rng, 0, 59), 0);
        const amount = Math.max(0, Math.round(randomInt(rng, category.min, category.max) / 1000) * 1000);
        const merchant = pick(rng, category.merchants);
        const note = pick(rng, category.notes);
        const id = `demo-${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}-${String(i).padStart(2, "0")}`;

        transactions.push({
          id,
          amount,
          category: category.name,
          merchant,
          date: date.toISOString(),
          note,
          created_at: date.toISOString(),
          raw_text: `${merchant} - ${note}`,
          source: "demo",
          synced: 1,
        });
      }
    }
  }

  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return transactions;
}

export function generateYearOfSpending(): Transaction[] {
  return generateFixedSpendingYears().filter((item) => new Date(item.date).getFullYear() === 2026);
}
