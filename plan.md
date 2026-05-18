# 💸 SpendSnap — Expense Tracker App — Plan

> **Triết lý cốt lõi**: Ghi lại chi tiêu nhanh nhất có thể — dưới 5 giây mỗi lần.

---

## 1. Tech Stack

### Mobile App
| Layer | Công nghệ | Lý do chọn |
|---|---|---|
| Framework | **React Native + Expo** | Cross-platform iOS/Android, dev nhanh |
| Navigation | Expo Router (file-based) | Đơn giản, native feel |
| State | Zustand + React Query | Nhẹ, dễ quản lý |
| Local DB | SQLite (expo-sqlite) | Offline-first |
| Sync/Backend | Supabase | Auth + Postgres + Realtime |
| UI | NativeWind (Tailwind) + custom | Nhất quán, dễ style |

### AI / Intelligence Layer
| Tính năng | Model/API | Ghi chú |
|---|---|---|
| Voice → text | OpenAI Whisper (`whisper-1`) | Tốt nhất cho tiếng Việt |
| Text/Voice/SMS extract | OpenAI GPT-4o-mini | Nhanh, rẻ, đủ cho NLP đơn giản |
| OCR hóa đơn | OpenAI GPT-4o (vision) | Cần model mạnh hơn cho ảnh |
| SMS parsing | Regex → GPT-4o-mini fallback | On-device first |

> 🔄 **Abstraction layer:** Toàn bộ AI call đi qua `services/ai.ts` — sau này thay Claude/Gemini chỉ sửa 1 file.

---

## 2. Kiến trúc Tổng thể

```
┌─────────────────────────────────────────┐
│              Mobile App (RN)            │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │  Voice   │  │  Camera  │  │  SMS  │ │
│  │  Input   │  │  (OCR)   │  │  Hook │ │
│  └────┬─────┘  └────┬─────┘  └───┬───┘ │
│       │             │             │     │
│       └─────────────┼─────────────┘     │
│                     ▼                   │
│         ┌──────────────────────┐        │
│         │   AI Extraction      │        │
│         │  (OpenAI API)        │        │
│         │  → amount, category, │        │
│         │    merchant, date     │        │
│         └──────────┬───────────┘        │
│                    ▼                    │
│         ┌──────────────────────┐        │
│         │  Confirm/Edit UI     │        │  ← chỉ hiện khi cần sửa
│         └──────────┬───────────┘        │
│                    ▼                    │
│         ┌──────────────────────┐        │
│         │   SQLite (local)     │        │
│         │   + Supabase sync    │        │
│         └──────────────────────┘        │
└─────────────────────────────────────────┘
```

---

## 3. Tính năng Chi tiết

### 3.1 Quick Add — Màn hình chính (Home Screen)
- **Floating Action Button** luôn hiển thị
- Tap → bottom sheet hiện 4 input method:
  - 🎤 Voice
  - 📷 Camera (hóa đơn)
  - ⌨️ Text
  - 📱 SMS (auto-scan)

### 3.2 Voice Input
**Flow:**
```
User nói → Whisper STT → Raw text → GPT-4o-mini extract → Confirm card → Save
```
**Ví dụ:**
- Input: *"ăn phở hết 45 nghìn"*
- Output: `{ amount: 45000, category: "Ăn uống", merchant: "Phở", currency: "VND" }`

**UX:**
- Hold to record (push-to-talk)
- Waveform animation khi đang ghi
- Auto-submit sau 1.5s im lặng

### 3.3 Camera / OCR (Hóa đơn)
**Flow:**
```
Chụp/chọn ảnh → GPT-4o Vision API → Extract fields → Confirm → Save
```
**Extract fields:** total amount, items, merchant name, date, VAT

**UX:**
- Auto-crop hóa đơn (document detection)
- Highlight các vùng được nhận diện
- Cho phép sửa trước khi save

### 3.4 SMS / Bank Notification
**Flow:**
```
SMS đến → Đọc SMS (permission) → Parse với regex → GPT-4o-mini fallback → Auto-create entry
```
**Hỗ trợ:** Vietcombank, BIDV, Techcombank, MB, ACB, VPBank, VIB...

**Pattern SMS mẫu:**
```
"VCB: TK 1234 giam 500,000 VND luc 14:30 20/05. SD: 2,500,000 VND. ND: Thanh toan GRAB"
```
→ `{ amount: 500000, merchant: "Grab", category: "Di chuyển" }`

**Privacy:** Parse on-device trước, chỉ gửi lên GPT-4o-mini nếu regex fail.

### 3.5 Text Input (Manual)
- Free-text input: *"cf highlands 55k"*
- GPT-4o-mini hiểu natural language tiếng Việt + Anh
- Smart suggestion: gợi ý merchant/category từ lịch sử

### 3.6 AI Extraction Engine (OpenAI API)

**Model routing:**
- Text/Voice/SMS → `gpt-4o-mini` (nhanh, rẻ)
- Hóa đơn ảnh → `gpt-4o` (vision)

**System prompt:**
```
Bạn là assistant trích xuất thông tin chi tiêu từ text tiếng Việt/Anh.
Output JSON với fields: amount (number, VND), category, merchant, note, date.
Categories: Ăn uống, Di chuyển, Mua sắm, Giải trí, Sức khỏe, Hóa đơn, Khác.
Nếu không có thông tin, để null.
```

**Output schema:**
```typescript
{
  amount: number,          // required
  currency: "VND" | "USD",
  category: CategoryEnum,
  merchant: string | null,
  note: string | null,
  date: string | null,     // ISO date, null = today
  confidence: number       // 0-1, hiện confirm UI nếu < 0.8
}
```

### 3.7 Confirm UI
- Chỉ hiện khi `confidence < 0.8` hoặc user tap edit
- Card nhỏ gọn với các fields có thể edit inline
- "Save" / "Edit" button

---

## 4. Data Model

```sql
-- Transactions
CREATE TABLE transactions (
  id          TEXT PRIMARY KEY,
  amount      INTEGER NOT NULL,     -- in VND (smallest unit)
  currency    TEXT DEFAULT 'VND',
  category_id TEXT NOT NULL,
  merchant    TEXT,
  note        TEXT,
  input_type  TEXT,                 -- voice|camera|sms|manual
  raw_input   TEXT,                 -- lưu lại để debug/retrain
  date        DATE NOT NULL,
  created_at  DATETIME DEFAULT NOW(),
  synced      BOOLEAN DEFAULT FALSE
);

-- Categories
CREATE TABLE categories (
  id    TEXT PRIMARY KEY,
  name  TEXT,
  icon  TEXT,
  color TEXT,
  budget_monthly INTEGER
);

-- Budgets (optional v2)
CREATE TABLE budgets (
  category_id TEXT,
  month       TEXT,   -- YYYY-MM
  amount      INTEGER
);
```

---

## 5. Screens & Navigation

```
(tabs)
├── / (Home)         → Quick add + today's transactions
├── /history         → Lịch sử, filter, search
├── /analytics       → Charts, báo cáo
└── /settings        → Danh mục, budget, ngân hàng, export

(modals)
├── /add             → Bottom sheet: chọn input method
├── /transaction/[id]→ Chi tiết + edit
└── /onboarding      → Setup lần đầu
```

---

## 6. Roadmap — Phases

### Phase 1 — MVP (4–6 tuần)
**Goal:** App hoạt động được, dùng hàng ngày

- [ ] Setup Expo project, navigation, Supabase
- [ ] Manual text input + GPT-4o-mini extraction
- [ ] Voice input (Whisper + GPT-4o-mini)
- [ ] Local SQLite storage + sync
- [ ] Home screen: today list + quick add
- [ ] Basic categories (hardcoded)

### Phase 2 — Core Features (3–4 tuần)
**Goal:** Đủ dùng thay app khác

- [ ] Camera OCR (GPT-4o Vision)
- [ ] SMS/bank notification parser
- [ ] History screen + search/filter
- [ ] Analytics screen (charts cơ bản)
- [ ] Custom categories + budget

### Phase 3 — Polish (2–3 tuần)
**Goal:** Trải nghiệm mượt mà

- [ ] Widget (iOS/Android) — quick add từ home screen
- [ ] Recurring transaction
- [ ] Export CSV/Excel
- [ ] Notification reminders
- [ ] Multi-currency

### Phase 4 — Advanced (tương lai)
- [ ] Bank API integration (Open Banking)
- [ ] AI insights: "Tháng này bạn tiêu nhiều hơn 20% ở Grab"
- [ ] Shared expenses (nhóm)
- [ ] Tax report export

---

## 7. API Cost Estimate

| Feature | Model | Cost/call | Calls/ngày (est.) | Monthly |
|---|---|---|---|---|
| Voice STT | Whisper `whisper-1` | ~$0.006/phút | 5 | ~$0.9 |
| Text extract | GPT-4o-mini | ~$0.0002 | 10 | ~$0.06 |
| OCR receipt | GPT-4o (vision) | ~$0.003 | 2 | ~$0.18 |
| **Total** | | | | **~$1.1/user/tháng** |

> ✅ $5 OpenAI key đủ dùng **vài tháng dev + test**. GPT-4o-mini rẻ hơn ~5x so với Claude Haiku cho text tasks.

---

## 8. Cấu trúc Thư mục

```
spendsnap/
├── app/                    # Expo Router screens
│   ├── (tabs)/
│   │   ├── index.tsx       # Home
│   │   ├── history.tsx
│   │   └── analytics.tsx
│   └── _layout.tsx
├── components/
│   ├── QuickAdd/           # Bottom sheet + input methods
│   ├── TransactionCard/
│   └── Charts/
├── services/
│   ├── ai.ts               # OpenAI API calls (abstraction layer)
│   ├── stt.ts              # Whisper
│   ├── sms.ts              # SMS parser
│   └── db.ts               # SQLite operations
├── stores/
│   └── transactions.ts     # Zustand store
├── hooks/
│   └── useSmsListener.ts
└── supabase/
    └── migrations/
```

---

## 9. Rủi ro & Giải pháp

| Rủi ro | Giải pháp |
|---|---|
| SMS permission bị từ chối (iOS) | Fallback: manual copy-paste, share sheet |
| OpenAI API chậm | Cache + optimistic UI, hiện skeleton |
| OCR accuracy thấp | Cho phép user edit dễ dàng, lưu raw image để retry |
| Privacy người dùng | On-device processing first, không lưu ảnh/audio sau khi extract |
| Chi phí API tăng | Rate limit, cache similar queries, dùng GPT-4o-mini cho text đơn giản |
| Muốn đổi AI provider | Abstraction layer `services/ai.ts` — swap model không ảnh hưởng app logic |

---

## 10. Next Step — Bắt đầu ngay

1. `npx create-expo-app spendsnap --template blank-typescript`
2. Setup Supabase project + schema
3. Build `QuickAdd` bottom sheet + manual text flow trước
4. Integrate OpenAI API (`gpt-4o-mini`) cho text extraction
5. Test với real data → iterate UX

---

*Plan version 1.1 — AI layer dùng OpenAI (Whisper + GPT-4o-mini + GPT-4o). Có thể swap sang Claude/Gemini sau qua `services/ai.ts`.*
