import { uuid } from "./uuid";
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

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomDateWithinYear(): Date {
  const now = new Date();
  const daysAgo = randomInt(0, 364);
  const date = new Date(now);
  date.setDate(now.getDate() - daysAgo);
  date.setHours(randomInt(8, 22), randomInt(0, 59), randomInt(0, 59), 0);
  return date;
}

function pickCategory(): typeof CATEGORY_CONFIG[number] {
  const totalWeight = CATEGORY_CONFIG.reduce((sum, item) => sum + item.weight, 0);
  let target = Math.random() * totalWeight;
  for (const item of CATEGORY_CONFIG) {
    target -= item.weight;
    if (target <= 0) return item;
  }
  return CATEGORY_CONFIG[CATEGORY_CONFIG.length - 1];
}

export function generateYearOfSpending(): Transaction[] {
  const count = 260;
  const transactions: Transaction[] = [];

  for (let i = 0; i < count; i += 1) {
    const category = pickCategory();
    const date = randomDateWithinYear();
    const amount = Math.max(0, Math.round(randomInt(category.min, category.max) / 1000) * 1000);
    const merchant = pick(category.merchants);
    const note = pick(category.notes);

    transactions.push({
      id: uuid(),
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

  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return transactions;
}
