# Life Call Concierge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform mascodex character chat into a local concierge that handles 20 life-problem categories via AI phone calls using Telnyx.

**Architecture:** New standalone Cloudflare Worker (`lifecall-worker`) handles sessions, Stripe payments, and Telnyx calls. Existing mascodex chat API (`functions/api/chat/[postalCode].js`) is extended to detect concierge requests and hand off to the worker. Frontend logic lives in an external `lifecall.js` so 120K pages don't need regeneration.

**Tech Stack:** Cloudflare Workers (Hono router), D1 (SQLite), Claude Haiku 4.5 (hearing), Telnyx AI Voice, Stripe Payment Intents, Google Places API

**Reference:** Design doc at `docs/plans/2026-02-25-lifecall-concierge-design.md`

---

## Phase 1: lifecall-worker Foundation

### Task 1: Scaffold lifecall-worker project

**Files:**
- Create: `goenchan/lifecall-worker/package.json`
- Create: `goenchan/lifecall-worker/wrangler.toml`
- Create: `goenchan/lifecall-worker/tsconfig.json`
- Create: `goenchan/lifecall-worker/src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "lifecall-worker",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "hono": "^4.0.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.0.0",
    "wrangler": "^3.0.0",
    "typescript": "^5.0.0"
  }
}
```

**Step 2: Create wrangler.toml**

```toml
name = "lifecall-worker"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[[d1_databases]]
binding = "DB"
database_name = "lifecall-db"
database_id = "TO_BE_CREATED"

[vars]
TELNYX_CONNECTION_ID = "2752342096672196603"
CORS_ORIGIN = "https://mascodex.com"
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

**Step 4: Create minimal router**

```typescript
// src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Env = {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  TELNYX_API_KEY: string;
  TELNYX_CONNECTION_ID: string;
  TELNYX_FROM_NUMBER: string;
  GOOGLE_PLACES_API_KEY: string;
  CORS_ORIGIN: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({ origin: '*' }));

app.get('/health', (c) => c.json({ ok: true, service: 'lifecall-worker' }));

export default app;
```

**Step 5: Install dependencies and verify**

Run: `cd goenchan/lifecall-worker && npm install`
Run: `npx wrangler dev --local` (should start without errors)

**Step 6: Commit**

```bash
git add goenchan/lifecall-worker/
git commit -m "feat(lifecall): scaffold worker project with Hono router"
```

---

### Task 2: Create D1 database and schema

**Files:**
- Create: `goenchan/lifecall-worker/d1/schema.sql`

**Step 1: Create schema.sql**

```sql
-- Life Call Concierge Schema

CREATE TABLE IF NOT EXISTS lifecall_sessions (
  id TEXT PRIMARY KEY,
  postal_code TEXT NOT NULL,
  char_name TEXT,
  category TEXT,
  status TEXT DEFAULT 'chatting',
  hearing_data TEXT,
  price_tier INTEGER,
  locale TEXT DEFAULT 'ja',
  stripe_payment_intent_id TEXT,
  stripe_refund_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lifecall_calls (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  target_name TEXT NOT NULL,
  target_phone TEXT NOT NULL,
  target_address TEXT,
  call_order INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  outcome TEXT,
  ai_summary TEXT,
  price_quoted TEXT,
  telnyx_call_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lifecall_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_postal ON lifecall_sessions(postal_code);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON lifecall_sessions(status);
CREATE INDEX IF NOT EXISTS idx_calls_session ON lifecall_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_session ON lifecall_messages(session_id);
```

**Step 2: Create D1 database**

Run: `cd goenchan/lifecall-worker && npx wrangler d1 create lifecall-db`
Copy the `database_id` from the output and update `wrangler.toml`.

**Step 3: Apply schema**

Run: `npx wrangler d1 execute lifecall-db --file=d1/schema.sql --remote`

**Step 4: Commit**

```bash
git add goenchan/lifecall-worker/d1/ goenchan/lifecall-worker/wrangler.toml
git commit -m "feat(lifecall): add D1 schema for sessions, calls, messages"
```

---

### Task 3: Define 20 categories

**Files:**
- Create: `goenchan/lifecall-worker/src/categories.ts`

**Step 1: Create categories definition**

```typescript
// src/categories.ts

export interface CategoryField {
  key: string;
  label_ja: string;
  label_en: string;
  required: boolean;
  type: 'text' | 'date' | 'number' | 'select';
  options?: { value: string; label_ja: string; label_en: string }[];
}

export interface Category {
  id: string;
  name_ja: string;
  name_en: string;
  tier: 500 | 1500 | 3000;
  max_calls: number;
  fields: CategoryField[];
  call_purpose_ja: string;
  call_purpose_en: string;
  needs_search: boolean; // true = use Google Places to find target
}

export const CATEGORIES: Record<string, Category> = {
  // === Tier 1: 500 yen ===
  hospital_new: {
    id: 'hospital_new',
    name_ja: '病院初診予約',
    name_en: 'New patient hospital appointment',
    tier: 500,
    max_calls: 1,
    needs_search: true,
    call_purpose_ja: '初診の予約',
    call_purpose_en: 'Book a first-visit appointment',
    fields: [
      { key: 'hospital_name', label_ja: '病院名', label_en: 'Hospital name', required: false, type: 'text' },
      { key: 'department', label_ja: '科目', label_en: 'Department', required: true, type: 'text' },
      { key: 'preferred_date', label_ja: '希望日', label_en: 'Preferred date', required: true, type: 'date' },
      { key: 'symptoms', label_ja: '症状（任意）', label_en: 'Symptoms (optional)', required: false, type: 'text' },
    ],
  },
  hospital_change: {
    id: 'hospital_change',
    name_ja: '再診予約変更',
    name_en: 'Reschedule follow-up appointment',
    tier: 500,
    max_calls: 1,
    needs_search: false,
    call_purpose_ja: '再診予約の変更',
    call_purpose_en: 'Reschedule an existing appointment',
    fields: [
      { key: 'hospital_name', label_ja: '病院名', label_en: 'Hospital name', required: true, type: 'text' },
      { key: 'patient_name', label_ja: '患者名', label_en: 'Patient name', required: true, type: 'text' },
      { key: 'current_date', label_ja: '現在の予約日', label_en: 'Current appointment date', required: true, type: 'date' },
      { key: 'new_date', label_ja: '希望変更日', label_en: 'New preferred date', required: true, type: 'date' },
    ],
  },
  dentist: {
    id: 'dentist',
    name_ja: '歯医者予約',
    name_en: 'Dentist appointment',
    tier: 500,
    max_calls: 1,
    needs_search: true,
    call_purpose_ja: '歯科の予約',
    call_purpose_en: 'Book a dental appointment',
    fields: [
      { key: 'dentist_name', label_ja: '歯科名', label_en: 'Dentist name', required: false, type: 'text' },
      { key: 'preferred_date', label_ja: '希望日', label_en: 'Preferred date', required: true, type: 'date' },
      { key: 'symptoms', label_ja: '症状（任意）', label_en: 'Symptoms (optional)', required: false, type: 'text' },
    ],
  },
  health_check: {
    id: 'health_check',
    name_ja: '健康診断予約',
    name_en: 'Health check-up appointment',
    tier: 500,
    max_calls: 1,
    needs_search: true,
    call_purpose_ja: '健康診断の予約',
    call_purpose_en: 'Book a health check-up',
    fields: [
      { key: 'facility_name', label_ja: '施設名', label_en: 'Facility name', required: false, type: 'text' },
      { key: 'preferred_date', label_ja: '希望日', label_en: 'Preferred date', required: true, type: 'date' },
      { key: 'check_type', label_ja: '検査種類', label_en: 'Check-up type', required: true, type: 'text' },
    ],
  },
  restaurant: {
    id: 'restaurant',
    name_ja: 'レストラン予約',
    name_en: 'Restaurant reservation',
    tier: 500,
    max_calls: 1,
    needs_search: false,
    call_purpose_ja: 'レストランの予約',
    call_purpose_en: 'Make a restaurant reservation',
    fields: [
      { key: 'restaurant_name', label_ja: '店名', label_en: 'Restaurant name', required: true, type: 'text' },
      { key: 'date_time', label_ja: '日時', label_en: 'Date and time', required: true, type: 'text' },
      { key: 'party_size', label_ja: '人数', label_en: 'Party size', required: true, type: 'number' },
      { key: 'requests', label_ja: '要望（個室等）', label_en: 'Requests (private room, etc.)', required: false, type: 'text' },
    ],
  },
  karaoke: {
    id: 'karaoke',
    name_ja: 'カラオケ予約',
    name_en: 'Karaoke reservation',
    tier: 500,
    max_calls: 1,
    needs_search: true,
    call_purpose_ja: 'カラオケの予約',
    call_purpose_en: 'Book a karaoke room',
    fields: [
      { key: 'karaoke_name', label_ja: '店名', label_en: 'Karaoke name', required: false, type: 'text' },
      { key: 'date_time', label_ja: '日時', label_en: 'Date and time', required: true, type: 'text' },
      { key: 'party_size', label_ja: '人数', label_en: 'Party size', required: true, type: 'number' },
    ],
  },
  izakaya_group: {
    id: 'izakaya_group',
    name_ja: '居酒屋団体予約',
    name_en: 'Group izakaya reservation',
    tier: 500,
    max_calls: 1,
    needs_search: false,
    call_purpose_ja: '居酒屋の団体予約',
    call_purpose_en: 'Book a group reservation at izakaya',
    fields: [
      { key: 'izakaya_name', label_ja: '店名', label_en: 'Izakaya name', required: true, type: 'text' },
      { key: 'date_time', label_ja: '日時', label_en: 'Date and time', required: true, type: 'text' },
      { key: 'party_size', label_ja: '人数', label_en: 'Party size', required: true, type: 'number' },
      { key: 'course', label_ja: 'コース有無', label_en: 'Course meal?', required: false, type: 'text' },
      { key: 'budget', label_ja: '予算', label_en: 'Budget per person', required: false, type: 'text' },
    ],
  },
  birthday: {
    id: 'birthday',
    name_ja: '誕生日サプライズ確認',
    name_en: 'Birthday surprise confirmation',
    tier: 500,
    max_calls: 1,
    needs_search: false,
    call_purpose_ja: '誕生日サプライズの確認',
    call_purpose_en: 'Confirm birthday surprise arrangements',
    fields: [
      { key: 'restaurant_name', label_ja: '店名', label_en: 'Restaurant name', required: true, type: 'text' },
      { key: 'date_time', label_ja: '日時', label_en: 'Date and time', required: true, type: 'text' },
      { key: 'surprise_details', label_ja: 'サプライズ内容', label_en: 'Surprise details', required: true, type: 'text' },
    ],
  },

  // === Tier 2: 1500 yen ===
  moving: {
    id: 'moving',
    name_ja: '引越し業者比較',
    name_en: 'Moving company comparison',
    tier: 1500,
    max_calls: 3,
    needs_search: true,
    call_purpose_ja: '引越し見積もりの依頼',
    call_purpose_en: 'Request moving quotes',
    fields: [
      { key: 'current_address', label_ja: '現住所', label_en: 'Current address', required: true, type: 'text' },
      { key: 'new_address', label_ja: '引越先', label_en: 'New address', required: true, type: 'text' },
      { key: 'preferred_date', label_ja: '希望日', label_en: 'Preferred date', required: true, type: 'date' },
      { key: 'volume', label_ja: '荷物量', label_en: 'Volume (1-room, family, etc.)', required: true, type: 'text' },
    ],
  },
  internet: {
    id: 'internet',
    name_ja: 'インターネット契約確認',
    name_en: 'Internet contract inquiry',
    tier: 1500,
    max_calls: 1,
    needs_search: false,
    call_purpose_ja: 'インターネット契約の確認・変更',
    call_purpose_en: 'Check or change internet contract',
    fields: [
      { key: 'provider_name', label_ja: 'プロバイダ名', label_en: 'Provider name', required: true, type: 'text' },
      { key: 'contract_number', label_ja: '契約番号（任意）', label_en: 'Contract number (optional)', required: false, type: 'text' },
      { key: 'question', label_ja: '質問内容', label_en: 'What you want to ask', required: true, type: 'text' },
    ],
  },
  utility_start: {
    id: 'utility_start',
    name_ja: '電気・ガス開栓予約',
    name_en: 'Utility start-up booking',
    tier: 1500,
    max_calls: 1,
    needs_search: false,
    call_purpose_ja: '電気/ガスの開栓予約',
    call_purpose_en: 'Book utility start-up',
    fields: [
      { key: 'utility_company', label_ja: '電力/ガス会社', label_en: 'Utility company', required: true, type: 'text' },
      { key: 'address', label_ja: '住所', label_en: 'Address', required: true, type: 'text' },
      { key: 'preferred_date', label_ja: '希望日', label_en: 'Preferred date', required: true, type: 'date' },
    ],
  },
  move_out: {
    id: 'move_out',
    name_ja: '退去連絡',
    name_en: 'Move-out notification',
    tier: 1500,
    max_calls: 1,
    needs_search: false,
    call_purpose_ja: '退去の連絡',
    call_purpose_en: 'Notify move-out',
    fields: [
      { key: 'management_company', label_ja: '管理会社名', label_en: 'Management company', required: true, type: 'text' },
      { key: 'property_name', label_ja: '物件名', label_en: 'Property name', required: true, type: 'text' },
      { key: 'move_out_date', label_ja: '退去希望日', label_en: 'Move-out date', required: true, type: 'date' },
    ],
  },
  aircon_repair: {
    id: 'aircon_repair',
    name_ja: 'エアコン修理',
    name_en: 'Air conditioner repair',
    tier: 1500,
    max_calls: 2,
    needs_search: true,
    call_purpose_ja: 'エアコン修理の見積・予約',
    call_purpose_en: 'Get AC repair estimate and book',
    fields: [
      { key: 'vendor_name', label_ja: 'メーカーor業者名', label_en: 'Brand or repair company', required: false, type: 'text' },
      { key: 'symptoms', label_ja: '症状', label_en: 'Symptoms', required: true, type: 'text' },
      { key: 'preferred_date', label_ja: '希望日', label_en: 'Preferred date', required: true, type: 'date' },
    ],
  },
  junk_removal: {
    id: 'junk_removal',
    name_ja: '不用品回収見積',
    name_en: 'Junk removal estimate',
    tier: 1500,
    max_calls: 2,
    needs_search: true,
    call_purpose_ja: '不用品回収の見積もり',
    call_purpose_en: 'Get junk removal estimates',
    fields: [
      { key: 'items', label_ja: '品目リスト', label_en: 'List of items', required: true, type: 'text' },
      { key: 'preferred_date', label_ja: '希望日', label_en: 'Preferred date', required: true, type: 'date' },
    ],
  },
  return_exchange: {
    id: 'return_exchange',
    name_ja: '返品・交換連絡',
    name_en: 'Return/exchange request',
    tier: 1500,
    max_calls: 1,
    needs_search: false,
    call_purpose_ja: '返品・交換の連絡',
    call_purpose_en: 'Request return or exchange',
    fields: [
      { key: 'store_name', label_ja: '店名', label_en: 'Store name', required: true, type: 'text' },
      { key: 'product_name', label_ja: '商品名', label_en: 'Product name', required: true, type: 'text' },
      { key: 'purchase_date', label_ja: '購入日', label_en: 'Purchase date', required: true, type: 'date' },
      { key: 'reason', label_ja: '理由', label_en: 'Reason', required: true, type: 'text' },
    ],
  },

  // === Tier 3: 3000 yen ===
  plumbing: {
    id: 'plumbing',
    name_ja: 'トイレ水漏れ',
    name_en: 'Plumbing emergency',
    tier: 3000,
    max_calls: 3,
    needs_search: true,
    call_purpose_ja: '水漏れ修理業者への連絡',
    call_purpose_en: 'Contact plumber for leak repair',
    fields: [
      { key: 'water_stopped', label_ja: '水は止まっていますか？', label_en: 'Is the water stopped?', required: true, type: 'select', options: [
        { value: 'yes', label_ja: 'はい', label_en: 'Yes' },
        { value: 'no', label_ja: 'いいえ', label_en: 'No' },
      ]},
      { key: 'address', label_ja: '住所', label_en: 'Address', required: true, type: 'text' },
      { key: 'preferred_time', label_ja: '希望対応時間', label_en: 'Preferred time', required: true, type: 'text' },
      { key: 'budget_max', label_ja: '予算上限', label_en: 'Budget limit', required: false, type: 'text' },
    ],
  },
  locksmith: {
    id: 'locksmith',
    name_ja: '鍵紛失',
    name_en: 'Lost key / locksmith',
    tier: 3000,
    max_calls: 3,
    needs_search: true,
    call_purpose_ja: '鍵業者への連絡',
    call_purpose_en: 'Contact locksmith',
    fields: [
      { key: 'address', label_ja: '住所', label_en: 'Address', required: true, type: 'text' },
      { key: 'lock_type', label_ja: '鍵の種類', label_en: 'Lock type', required: true, type: 'text' },
      { key: 'situation', label_ja: '現在の状況', label_en: 'Current situation', required: true, type: 'text' },
    ],
  },
  gym_cancel: {
    id: 'gym_cancel',
    name_ja: 'ジム解約',
    name_en: 'Gym cancellation',
    tier: 3000,
    max_calls: 1,
    needs_search: false,
    call_purpose_ja: 'ジムの解約手続き',
    call_purpose_en: 'Cancel gym membership',
    fields: [
      { key: 'gym_name', label_ja: 'ジム名', label_en: 'Gym name', required: true, type: 'text' },
      { key: 'member_id', label_ja: '会員番号', label_en: 'Member ID', required: false, type: 'text' },
      { key: 'member_name', label_ja: '会員名', label_en: 'Member name', required: true, type: 'text' },
    ],
  },
  subscription_cancel: {
    id: 'subscription_cancel',
    name_ja: 'サブスク解約',
    name_en: 'Subscription cancellation',
    tier: 3000,
    max_calls: 1,
    needs_search: false,
    call_purpose_ja: 'サブスクリプションの解約',
    call_purpose_en: 'Cancel subscription',
    fields: [
      { key: 'service_name', label_ja: 'サービス名', label_en: 'Service name', required: true, type: 'text' },
      { key: 'member_info', label_ja: '会員情報', label_en: 'Member info', required: true, type: 'text' },
    ],
  },
  newspaper_cancel: {
    id: 'newspaper_cancel',
    name_ja: '新聞解約',
    name_en: 'Newspaper cancellation',
    tier: 3000,
    max_calls: 1,
    needs_search: false,
    call_purpose_ja: '新聞の解約',
    call_purpose_en: 'Cancel newspaper subscription',
    fields: [
      { key: 'newspaper_name', label_ja: '新聞社名', label_en: 'Newspaper name', required: true, type: 'text' },
      { key: 'customer_number', label_ja: '顧客番号（任意）', label_en: 'Customer number (optional)', required: false, type: 'text' },
      { key: 'address', label_ja: '住所', label_en: 'Address', required: true, type: 'text' },
    ],
  },
};

export const TIER_PRICES = {
  500: { ja: 500, en: 750 },
  1500: { ja: 1500, en: 2250 },
  3000: { ja: 3000, en: 4500 },
} as const;

export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES[id];
}

export function detectCategory(message: string): string | null {
  const keywords: Record<string, string[]> = {
    hospital_new: ['病院', '初診', 'hospital', 'doctor', '内科', '外科', '皮膚科', '眼科', '耳鼻科'],
    hospital_change: ['再診', '予約変更', 'reschedule', '予約を変えたい'],
    dentist: ['歯医者', '歯科', 'dentist', '歯が痛い', '虫歯'],
    health_check: ['健康診断', '人間ドック', 'health check', '健診'],
    restaurant: ['レストラン', 'restaurant', '食事', 'ディナー', 'ランチ'],
    karaoke: ['カラオケ', 'karaoke'],
    izakaya_group: ['居酒屋', '飲み会', '宴会', 'izakaya', '団体'],
    birthday: ['誕生日', 'バースデー', 'birthday', 'サプライズ'],
    moving: ['引越し', '引っ越し', 'moving', '引越'],
    internet: ['インターネット', 'ネット回線', 'WiFi', 'プロバイダ', 'internet'],
    utility_start: ['電気', 'ガス', '開栓', 'utility', '電力'],
    move_out: ['退去', '引き払い', 'move out', '退居'],
    aircon_repair: ['エアコン', '冷房', '暖房', 'air conditioner', 'AC修理'],
    junk_removal: ['不用品', '粗大ごみ', 'junk', '回収'],
    return_exchange: ['返品', '交換', 'return', 'exchange', '返却'],
    plumbing: ['水漏れ', '水道', 'トイレ', 'plumbing', '水が止まらない', '配管'],
    locksmith: ['鍵', 'ロック', 'locksmith', '鍵紛失', '閉め出し'],
    gym_cancel: ['ジム', 'gym', 'フィットネス', 'スポーツクラブ'],
    subscription_cancel: ['サブスク', 'subscription', '解約したい', '月額'],
    newspaper_cancel: ['新聞', 'newspaper', '朝刊', '読売', '朝日', '毎日'],
  };

  const lower = message.toLowerCase();
  for (const [catId, words] of Object.entries(keywords)) {
    for (const word of words) {
      if (lower.includes(word.toLowerCase())) return catId;
    }
  }
  return null;
}
```

**Step 2: Commit**

```bash
git add goenchan/lifecall-worker/src/categories.ts
git commit -m "feat(lifecall): define 20 service categories with hearing fields"
```

---

### Task 4: Session management API

**Files:**
- Create: `goenchan/lifecall-worker/src/session.ts`
- Modify: `goenchan/lifecall-worker/src/index.ts`

**Step 1: Create session.ts**

```typescript
// src/session.ts
import { Hono } from 'hono';
import { CATEGORIES, detectCategory, TIER_PRICES } from './categories';

type Env = {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
};

const sessions = new Hono<{ Bindings: Env }>();

// Create or resume a session
sessions.post('/start', async (c) => {
  const { postal_code, message, locale } = await c.req.json<{
    postal_code: string;
    message: string;
    locale?: string;
  }>();

  const lang = locale || 'ja';
  const categoryId = detectCategory(message);

  if (!categoryId) {
    return c.json({ action: 'not_concierge' });
  }

  const category = CATEGORIES[categoryId];
  if (!category) {
    return c.json({ action: 'not_concierge' });
  }

  const sessionId = crypto.randomUUID();
  const priceKey = lang === 'ja' ? 'ja' : 'en';
  const price = TIER_PRICES[category.tier][priceKey];

  await c.env.DB.prepare(
    `INSERT INTO lifecall_sessions (id, postal_code, category, status, price_tier, locale)
     VALUES (?, ?, ?, 'hearing', ?, ?)`
  ).bind(sessionId, postal_code, categoryId, price, lang).run();

  // Store initial message
  await c.env.DB.prepare(
    `INSERT INTO lifecall_messages (session_id, role, content) VALUES (?, 'user', ?)`
  ).bind(sessionId, message).run();

  return c.json({
    action: 'concierge_start',
    session_id: sessionId,
    category: categoryId,
    category_name: lang === 'ja' ? category.name_ja : category.name_en,
    price,
    fields: category.fields.map(f => ({
      key: f.key,
      label: lang === 'ja' ? f.label_ja : f.label_en,
      required: f.required,
      type: f.type,
      options: f.options?.map(o => ({
        value: o.value,
        label: lang === 'ja' ? o.label_ja : o.label_en,
      })),
    })),
    needs_search: category.needs_search,
  });
});

// Get session status
sessions.get('/:id', async (c) => {
  const id = c.req.param('id');
  const session = await c.env.DB.prepare(
    'SELECT * FROM lifecall_sessions WHERE id = ?'
  ).bind(id).first();

  if (!session) return c.json({ error: 'Session not found' }, 404);

  const calls = await c.env.DB.prepare(
    'SELECT * FROM lifecall_calls WHERE session_id = ? ORDER BY call_order'
  ).bind(id).all();

  return c.json({ session, calls: calls.results });
});

// Submit hearing data
sessions.post('/:id/hearing', async (c) => {
  const id = c.req.param('id');
  const hearingData = await c.req.json();

  await c.env.DB.prepare(
    `UPDATE lifecall_sessions SET hearing_data = ?, status = 'payment', updated_at = datetime('now')
     WHERE id = ?`
  ).bind(JSON.stringify(hearingData), id).run();

  const session = await c.env.DB.prepare(
    'SELECT * FROM lifecall_sessions WHERE id = ?'
  ).bind(id).first();

  return c.json({
    action: 'ready_for_payment',
    session_id: id,
    price: session?.price_tier,
  });
});

export { sessions };
```

**Step 2: Wire sessions into main router**

Add to `src/index.ts`:

```typescript
import { sessions } from './session';

// ... existing code ...

app.route('/api/sessions', sessions);
```

**Step 3: Commit**

```bash
git add goenchan/lifecall-worker/src/session.ts goenchan/lifecall-worker/src/index.ts
git commit -m "feat(lifecall): add session management API (create, hearing, status)"
```

---

## Phase 2: Payment & Calling

### Task 5: Stripe payment integration

**Files:**
- Create: `goenchan/lifecall-worker/src/payment.ts`
- Modify: `goenchan/lifecall-worker/src/index.ts`

**Step 1: Create payment.ts**

```typescript
// src/payment.ts
import { Hono } from 'hono';

type Env = {
  DB: D1Database;
  STRIPE_SECRET_KEY: string;
};

const payment = new Hono<{ Bindings: Env }>();

// Create Stripe PaymentIntent
payment.post('/create-intent', async (c) => {
  const { session_id } = await c.req.json<{ session_id: string }>();

  const session = await c.env.DB.prepare(
    'SELECT * FROM lifecall_sessions WHERE id = ?'
  ).bind(session_id).first();

  if (!session) return c.json({ error: 'Session not found' }, 404);
  if (session.status !== 'payment') return c.json({ error: 'Session not ready for payment' }, 400);

  const amount = (session.price_tier as number); // already in yen

  const res = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      amount: String(amount),
      currency: 'jpy',
      'metadata[session_id]': session_id,
      'metadata[category]': session.category as string,
      'metadata[postal_code]': session.postal_code as string,
    }),
  });

  const intent = await res.json() as { id: string; client_secret: string };

  await c.env.DB.prepare(
    `UPDATE lifecall_sessions SET stripe_payment_intent_id = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).bind(intent.id, session_id).run();

  return c.json({
    client_secret: intent.client_secret,
    amount,
  });
});

// Confirm payment completed (called after Stripe confirms on frontend)
payment.post('/confirm', async (c) => {
  const { session_id } = await c.req.json<{ session_id: string }>();

  const session = await c.env.DB.prepare(
    'SELECT * FROM lifecall_sessions WHERE id = ?'
  ).bind(session_id).first();

  if (!session || !session.stripe_payment_intent_id) {
    return c.json({ error: 'Invalid session' }, 400);
  }

  // Verify with Stripe
  const res = await fetch(
    `https://api.stripe.com/v1/payment_intents/${session.stripe_payment_intent_id}`,
    {
      headers: { 'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}` },
    }
  );
  const intent = await res.json() as { status: string };

  if (intent.status !== 'succeeded') {
    return c.json({ error: 'Payment not completed', stripe_status: intent.status }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE lifecall_sessions SET status = 'calling', updated_at = datetime('now')
     WHERE id = ?`
  ).bind(session_id).run();

  return c.json({ action: 'payment_confirmed', session_id });
});

// Refund
payment.post('/refund', async (c) => {
  const { session_id, reason } = await c.req.json<{ session_id: string; reason?: string }>();

  const session = await c.env.DB.prepare(
    'SELECT * FROM lifecall_sessions WHERE id = ?'
  ).bind(session_id).first();

  if (!session || !session.stripe_payment_intent_id) {
    return c.json({ error: 'No payment to refund' }, 400);
  }

  const res = await fetch('https://api.stripe.com/v1/refunds', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      payment_intent: session.stripe_payment_intent_id as string,
      ...(reason ? { reason: 'requested_by_customer' } : {}),
    }),
  });

  const refund = await res.json() as { id: string };

  await c.env.DB.prepare(
    `UPDATE lifecall_sessions SET status = 'refunded', stripe_refund_id = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).bind(refund.id, session_id).run();

  return c.json({ action: 'refunded', refund_id: refund.id });
});

export { payment };
```

**Step 2: Wire into router**

Add to `src/index.ts`:
```typescript
import { payment } from './payment';
app.route('/api/payment', payment);
```

**Step 3: Commit**

```bash
git add goenchan/lifecall-worker/src/payment.ts goenchan/lifecall-worker/src/index.ts
git commit -m "feat(lifecall): add Stripe payment (create intent, confirm, refund)"
```

---

### Task 6: Telnyx AI call script and call initiation

**Files:**
- Create: `goenchan/lifecall-worker/src/callScript.ts`
- Create: `goenchan/lifecall-worker/src/calling.ts`
- Modify: `goenchan/lifecall-worker/src/index.ts`

**Step 1: Create callScript.ts**

Adapted from daydreamhub's `callScript.ts` for general-purpose calls:

```typescript
// src/callScript.ts
import { Category } from './categories';

export function buildCallScript(params: {
  category: Category;
  hearingData: Record<string, string>;
  targetName: string;
  locale: string;
}): string {
  const { category, hearingData, targetName, locale } = params;
  const isJa = locale === 'ja';

  const detailLines = Object.entries(hearingData)
    .filter(([_, v]) => v)
    .map(([k, v]) => {
      const field = category.fields.find(f => f.key === k);
      const label = field ? (isJa ? field.label_ja : field.label_en) : k;
      return `- ${label}: ${v}`;
    })
    .join('\n');

  return `You are a polite and professional phone assistant calling on behalf of a customer. You work for Mascodex Life Call, a phone concierge service.

YOUR TASK: ${isJa ? category.call_purpose_ja : category.call_purpose_en}

CALLING: ${targetName}

CUSTOMER REQUEST DETAILS:
${detailLines}

LANGUAGE: Speak in Japanese. Start with: "お忙しいところ恐れ入ります。マスコデックスライフコールと申します。お客様の代理でお電話しております。"

CONVERSATION FLOW:

1. GREETING
   - Use the greeting above
   - Briefly state your purpose: "${category.call_purpose_ja}"

2. DELIVER THE REQUEST
   - Clearly state the customer's requirements from the details above
   - Be concise and organized

3. IF SUCCESSFUL:
   - Confirm all details back (date, time, price if applicable)
   - Thank them
   - Your summary MUST include "confirmed" or "booked"

4. IF NOT POSSIBLE:
   - Thank them politely
   - Ask if there are alternatives
   - End the call politely
   - Your summary MUST include "unavailable" or "not possible"

5. IF VOICEMAIL / NO ANSWER:
   - Do NOT leave a message
   - Simply end the call
   - Your summary MUST include "voicemail" or "no answer"

IMPORTANT RULES:
- Be polite and concise
- Do NOT provide medical, legal, or financial advice
- Do NOT negotiate aggressively
- Keep the call under 3 minutes
- If you can't understand, politely ask them to repeat once

SUMMARY FORMAT:
After the call, provide a summary in English with one of these keywords:
- "confirmed" or "booked" (success, include details)
- "unavailable" or "not possible" (failed)
- "voicemail" (no person answered)
- "no answer" (phone not picked up)
- "over budget" (available but exceeds price limit)
- Always include any quoted prices`;
}
```

**Step 2: Create calling.ts**

```typescript
// src/calling.ts
import { Hono } from 'hono';
import { CATEGORIES } from './categories';
import { buildCallScript } from './callScript';

type Env = {
  DB: D1Database;
  TELNYX_API_KEY: string;
  TELNYX_CONNECTION_ID: string;
  TELNYX_FROM_NUMBER: string;
};

const calling = new Hono<{ Bindings: Env }>();

// Initiate calls for a session
calling.post('/initiate', async (c) => {
  const { session_id } = await c.req.json<{ session_id: string }>();

  const session = await c.env.DB.prepare(
    'SELECT * FROM lifecall_sessions WHERE id = ? AND status = ?'
  ).bind(session_id, 'calling').first();

  if (!session) return c.json({ error: 'Session not ready for calling' }, 400);

  // Get pending calls
  const calls = await c.env.DB.prepare(
    `SELECT * FROM lifecall_calls WHERE session_id = ? AND status = 'pending' ORDER BY call_order LIMIT 1`
  ).bind(session_id).all();

  if (!calls.results?.length) {
    return c.json({ error: 'No pending calls' }, 400);
  }

  const call = calls.results[0];
  const category = CATEGORIES[session.category as string];
  const hearingData = JSON.parse(session.hearing_data as string || '{}');

  const script = buildCallScript({
    category,
    hearingData,
    targetName: call.target_name as string,
    locale: session.locale as string,
  });

  // Encode client state
  const clientState = btoa(JSON.stringify({
    call_id: call.id,
    session_id: session_id,
    type: 'lifecall',
  }));

  // Initiate Telnyx AI call
  const telnyxRes = await fetch(
    `https://api.telnyx.com/v2/calls`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connection_id: c.env.TELNYX_CONNECTION_ID,
        to: call.target_phone,
        from: c.env.TELNYX_FROM_NUMBER,
        client_state: clientState,
        answering_machine_detection: 'detect',
      }),
    }
  );

  const telnyxData = await telnyxRes.json() as { data?: { call_control_id: string } };

  if (telnyxData.data?.call_control_id) {
    await c.env.DB.prepare(
      `UPDATE lifecall_calls SET status = 'calling', telnyx_call_id = ? WHERE id = ?`
    ).bind(telnyxData.data.call_control_id, call.id).run();
  }

  return c.json({
    action: 'call_initiated',
    call_id: call.id,
    target: call.target_name,
  });
});

export { calling };
```

**Step 3: Wire into router**

```typescript
import { calling } from './calling';
app.route('/api/calls', calling);
```

**Step 4: Commit**

```bash
git add goenchan/lifecall-worker/src/callScript.ts goenchan/lifecall-worker/src/calling.ts goenchan/lifecall-worker/src/index.ts
git commit -m "feat(lifecall): add Telnyx call script generation and call initiation"
```

---

### Task 7: Telnyx voice webhook handler

**Files:**
- Create: `goenchan/lifecall-worker/src/webhooks/telnyx.ts`
- Modify: `goenchan/lifecall-worker/src/index.ts`

**Step 1: Create webhook handler**

```typescript
// src/webhooks/telnyx.ts
import { Hono } from 'hono';

type Env = {
  DB: D1Database;
};

const telnyxWebhook = new Hono<{ Bindings: Env }>();

function decodeClientState(encoded: string): { call_id: string; session_id: string; type: string } | null {
  try {
    return JSON.parse(atob(encoded));
  } catch {
    return null;
  }
}

telnyxWebhook.post('/', async (c) => {
  const body = await c.req.json();
  const event = body?.data;
  if (!event) return c.json({ ok: true });

  const eventType = event.event_type;
  const payload = event.payload;
  if (!payload) return c.json({ ok: true });

  const clientState = payload.client_state ? decodeClientState(payload.client_state) : null;
  if (!clientState || clientState.type !== 'lifecall') return c.json({ ok: true });

  const { call_id, session_id } = clientState;

  switch (eventType) {
    case 'call.initiated':
      await c.env.DB.prepare(
        `UPDATE lifecall_calls SET status = 'calling', telnyx_call_id = ? WHERE id = ?`
      ).bind(payload.call_control_id || '', call_id).run();
      break;

    case 'call.answered':
      // Call connected - AI will handle conversation
      break;

    case 'call.hangup': {
      // Parse AI summary from call
      const summary = payload.ai_summary || payload.sip_hangup_cause || '';
      const outcome = detectOutcome(summary);

      await c.env.DB.prepare(
        `UPDATE lifecall_calls SET status = 'completed', outcome = ?, ai_summary = ? WHERE id = ?`
      ).bind(outcome, summary, call_id).run();

      // Check if we need to initiate next call or finalize session
      await handleCallCompletion(c.env.DB, session_id, call_id, outcome);
      break;
    }

    case 'call.machine.detection.ended':
      if (payload.result === 'machine') {
        // Voicemail detected - hang up
        await c.env.DB.prepare(
          `UPDATE lifecall_calls SET status = 'completed', outcome = 'voicemail' WHERE id = ?`
        ).bind(call_id).run();
        await handleCallCompletion(c.env.DB, session_id, call_id, 'voicemail');
      }
      break;
  }

  return c.json({ ok: true });
});

function detectOutcome(summary: string): string {
  const lower = summary.toLowerCase();
  if (lower.includes('confirmed') || lower.includes('booked')) return 'booked';
  if (lower.includes('over budget')) return 'over_budget';
  if (lower.includes('available')) return 'available';
  if (lower.includes('unavailable') || lower.includes('not possible') || lower.includes('full') || lower.includes('sold out')) return 'unavailable';
  if (lower.includes('voicemail')) return 'voicemail';
  if (lower.includes('no answer')) return 'no_answer';
  return 'unknown';
}

async function handleCallCompletion(db: D1Database, sessionId: string, completedCallId: string, outcome: string) {
  // If booked, mark session as completed
  if (outcome === 'booked') {
    await db.prepare(
      `UPDATE lifecall_sessions SET status = 'completed', updated_at = datetime('now') WHERE id = ?`
    ).bind(sessionId).run();
    return;
  }

  // Check for more pending calls
  const nextCall = await db.prepare(
    `SELECT id FROM lifecall_calls WHERE session_id = ? AND status = 'pending' ORDER BY call_order LIMIT 1`
  ).bind(sessionId).first();

  if (!nextCall) {
    // All calls exhausted without booking
    const anySuccess = await db.prepare(
      `SELECT id FROM lifecall_calls WHERE session_id = ? AND outcome = 'booked'`
    ).bind(sessionId).first();

    if (!anySuccess) {
      // Mark for refund
      await db.prepare(
        `UPDATE lifecall_sessions SET status = 'failed', updated_at = datetime('now') WHERE id = ?`
      ).bind(sessionId).run();
    }
  }
  // Note: next call initiation is triggered by polling from frontend
}

export { telnyxWebhook };
```

**Step 2: Wire into router**

```typescript
import { telnyxWebhook } from './webhooks/telnyx';
app.route('/webhooks/telnyx-voice', telnyxWebhook);
```

**Step 3: Commit**

```bash
git add goenchan/lifecall-worker/src/webhooks/ goenchan/lifecall-worker/src/index.ts
git commit -m "feat(lifecall): add Telnyx voice webhook handler with outcome detection"
```

---

### Task 8: Google Places search for vendors

**Files:**
- Create: `goenchan/lifecall-worker/src/search.ts`
- Modify: `goenchan/lifecall-worker/src/index.ts`

**Step 1: Create search.ts**

```typescript
// src/search.ts
import { Hono } from 'hono';

type Env = {
  DB: D1Database;
  GOOGLE_PLACES_API_KEY: string;
};

const search = new Hono<{ Bindings: Env }>();

const CATEGORY_SEARCH_TYPES: Record<string, string[]> = {
  hospital_new: ['hospital', 'doctor'],
  dentist: ['dentist'],
  health_check: ['hospital', 'health'],
  karaoke: ['karaoke'],
  moving: ['moving_company'],
  aircon_repair: ['electrician', 'home_goods_store'],
  junk_removal: ['moving_company'],
  plumbing: ['plumber'],
  locksmith: ['locksmith'],
};

search.post('/find', async (c) => {
  const { category_id, postal_code, query } = await c.req.json<{
    category_id: string;
    postal_code: string;
    query?: string;
  }>();

  const searchTypes = CATEGORY_SEARCH_TYPES[category_id] || [];
  const searchQuery = query || searchTypes[0] || category_id;

  // Use postal code to get approximate location
  const textQuery = `${searchQuery} 〒${postal_code}`;

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': c.env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.rating,places.userRatingCount,places.types',
    },
    body: JSON.stringify({
      textQuery,
      languageCode: 'ja',
      maxResultCount: 5,
    }),
  });

  const data = await res.json() as {
    places?: Array<{
      displayName: { text: string };
      formattedAddress: string;
      nationalPhoneNumber?: string;
      internationalPhoneNumber?: string;
      rating?: number;
      userRatingCount?: number;
      types?: string[];
    }>;
  };

  const results = (data.places || [])
    .filter(p => p.nationalPhoneNumber || p.internationalPhoneNumber)
    .map(p => ({
      name: p.displayName.text,
      address: p.formattedAddress,
      phone: p.nationalPhoneNumber || p.internationalPhoneNumber || '',
      rating: p.rating || 0,
      review_count: p.userRatingCount || 0,
    }))
    .sort((a, b) => b.rating - a.rating);

  return c.json({ results });
});

// Create call records from search results
search.post('/select', async (c) => {
  const { session_id, targets } = await c.req.json<{
    session_id: string;
    targets: Array<{ name: string; phone: string; address?: string }>;
  }>();

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    await c.env.DB.prepare(
      `INSERT INTO lifecall_calls (id, session_id, target_name, target_phone, target_address, call_order)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), session_id, t.name, t.phone, t.address || '', i + 1).run();
  }

  return c.json({ action: 'targets_set', count: targets.length });
});

export { search };
```

**Step 2: Wire into router**

```typescript
import { search } from './search';
app.route('/api/search', search);
```

**Step 3: Commit**

```bash
git add goenchan/lifecall-worker/src/search.ts goenchan/lifecall-worker/src/index.ts
git commit -m "feat(lifecall): add Google Places vendor search and target selection"
```

---

## Phase 3: Chat Integration & Frontend

### Task 9: Extend chat API for concierge handoff

**Files:**
- Modify: `functions/api/chat/[postalCode].js`

**Step 1: Add concierge detection to system prompt**

Update `buildSystemPrompt()` in `functions/api/chat/[postalCode].js` to add concierge awareness:

```javascript
function buildSystemPrompt(postalCode, profile) {
  const { name, area, intro, story } = profile;
  const formatted = postalCode.slice(0, 3) + '-' + postalCode.slice(3);

  return `あなたは「${name}」という${area}の非公式ゆるキャラです。

【プロフィール】
${intro}

【ストーリー】
${story}

【地域情報】
- 所在地: ${area}
- 郵便番号: 〒${formatted}

あなたはこの地域を愛し、地元の魅力を知り尽くしています。
訪問者に地元の名所、グルメ、文化、季節の行事について楽しく教えてください。

キャラクターの性格を反映した口調で話してください。
返答は2-3文の短い文章で答えてください。
一人称や語尾にキャラクターらしさを出してください。

【コンシェルジュ機能】
ユーザーが以下のような生活の困りごとを相談した場合は、返答の最後に必ず [CONCIERGE:カテゴリID] タグを付けてください。
カテゴリ:
- hospital_new: 病院初診予約
- hospital_change: 再診予約変更
- dentist: 歯医者予約
- health_check: 健康診断予約
- restaurant: レストラン予約
- karaoke: カラオケ予約
- izakaya_group: 居酒屋団体予約
- birthday: 誕生日サプライズ確認
- moving: 引越し業者比較
- internet: インターネット契約確認
- utility_start: 電気・ガス開栓予約
- move_out: 退去連絡
- aircon_repair: エアコン修理
- junk_removal: 不用品回収見積
- return_exchange: 返品・交換連絡
- plumbing: トイレ水漏れ
- locksmith: 鍵紛失
- gym_cancel: ジム解約
- subscription_cancel: サブスク解約
- newspaper_cancel: 新聞解約

例: ユーザー「水道壊れた」
返答: 「えぇ！大変だね！${name}が業者さんに電話してあげるよ！まかせて！ [CONCIERGE:plumbing]」

例: ユーザー「歯が痛い」
返答: 「痛いの辛いよね...${name}が歯医者さん予約してあげるよ！ [CONCIERGE:dentist]」

コンシェルジュタグは必ず返答テキストの最後に付け、会話の自然さを保ってください。
通常の会話（天気、観光、雑談など）にはタグを付けないでください。`;
}
```

**Step 2: Parse concierge tag from response**

Update the response handling in the same file:

```javascript
    // Extract text from Claude response content blocks
    const responseText =
      claudeData.content
        ?.filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('') || '';

    // Check for concierge tag
    const conciergeMatch = responseText.match(/\[CONCIERGE:(\w+)\]/);
    const cleanResponse = responseText.replace(/\s*\[CONCIERGE:\w+\]/, '').trim();

    const result = { success: true, response: cleanResponse };
    if (conciergeMatch) {
      result.concierge = {
        category: conciergeMatch[1],
        action: 'start_concierge',
      };
    }

    return jsonResponse(result);
```

**Step 3: Commit**

```bash
git add functions/api/chat/[postalCode].js
git commit -m "feat(lifecall): add concierge detection to character chat API"
```

---

### Task 10: Create lifecall.js frontend module

**Files:**
- Create: `js/lifecall.js`

**Step 1: Create the external JS file**

This file handles concierge mode in the existing chat widget. It's loaded by `<script src>` so 120K pages don't need regeneration.

```javascript
// lifecall.js - Concierge mode for mascodex character chat
// Loaded externally so character pages don't need regeneration

(function() {
  'use strict';

  var LIFECALL_API = 'https://lifecall-worker.taiichifox.workers.dev';
  var STRIPE_PK = ''; // Set after deployment
  var stripe = null;
  var currentSession = null;
  var locale = (navigator.language || 'ja').startsWith('ja') ? 'ja' : 'en';

  // Override the existing sendChat function to add concierge detection
  var originalSendChat = window.sendChat;

  window.sendChat = async function() {
    var input = document.getElementById('chatInput');
    var msg = input.value.trim();
    if (!msg) return;
    input.value = '';

    var msgs = document.getElementById('chatMessages');

    // Show user message
    var userEl = document.createElement('div');
    userEl.className = 'chat-msg user';
    userEl.textContent = msg;
    msgs.appendChild(userEl);

    // Show typing
    var typingEl = document.createElement('div');
    typingEl.className = 'chat-msg bot typing';
    typingEl.textContent = CHAR_NAME + (locale === 'ja' ? 'が考え中...' : ' is thinking...');
    msgs.appendChild(typingEl);
    msgs.scrollTop = msgs.scrollHeight;

    chatHistory.push({ role: 'user', content: msg });
    if (chatHistory.length > 10) chatHistory = chatHistory.slice(-10);

    var btn = document.getElementById('chatSend');
    btn.disabled = true;

    try {
      // If in concierge hearing mode, handle differently
      if (currentSession && currentSession.status === 'hearing') {
        await handleHearingResponse(msg, msgs, typingEl);
        btn.disabled = false;
        return;
      }

      var res = await fetch(API + '/' + POSTAL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: chatHistory })
      });
      var data = await res.json();
      typingEl.remove();

      var botEl = document.createElement('div');
      botEl.className = 'chat-msg bot';
      botEl.textContent = data.response || (locale === 'ja' ? 'ごめんね、うまく答えられなかったよ。' : 'Sorry, I couldn\'t respond properly.');
      msgs.appendChild(botEl);
      chatHistory.push({ role: 'assistant', content: data.response || '' });

      // Check if concierge mode triggered
      if (data.concierge && data.concierge.action === 'start_concierge') {
        await startConciergeMode(data.concierge.category, msg, msgs);
      }
    } catch (e) {
      typingEl.remove();
      var errEl = document.createElement('div');
      errEl.className = 'chat-msg bot';
      errEl.textContent = locale === 'ja'
        ? 'ごめんなさい、今お話しできないみたい。また後で話しかけてね！'
        : 'Sorry, I can\'t talk right now. Please try again later!';
      msgs.appendChild(errEl);
    }
    msgs.scrollTop = msgs.scrollHeight;
    btn.disabled = false;
  };

  async function startConciergeMode(categoryId, originalMessage, msgs) {
    try {
      var res = await fetch(LIFECALL_API + '/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postal_code: POSTAL,
          message: originalMessage,
          locale: locale,
        })
      });
      var data = await res.json();

      if (data.action !== 'concierge_start') return;

      currentSession = {
        id: data.session_id,
        category: data.category,
        price: data.price,
        fields: data.fields,
        collected: {},
        currentFieldIndex: 0,
        status: 'hearing',
      };

      // Show price info
      var priceText = locale === 'ja'
        ? '料金は' + data.price + '円だよ。'
        : 'The fee is ¥' + data.price + '.';
      var infoEl = document.createElement('div');
      infoEl.className = 'chat-msg bot';
      infoEl.innerHTML = '<strong>' + data.category_name + '</strong><br>' + priceText +
        '<br><small>' + (locale === 'ja' ? '本サービスは法的・医療的助言を行いません。連絡代行のみです。' : 'This service provides call assistance only, not medical or legal advice.') + '</small>';
      msgs.appendChild(infoEl);

      // Ask first field
      askNextField(msgs);
    } catch (e) {
      console.error('Concierge start error:', e);
    }
  }

  function askNextField(msgs) {
    if (!currentSession) return;
    var fields = currentSession.fields;
    var idx = currentSession.currentFieldIndex;

    // Skip non-required fields that we might already have
    while (idx < fields.length && !fields[idx].required && currentSession.collected[fields[idx].key]) {
      idx++;
    }

    if (idx >= fields.length) {
      // All fields collected - proceed to payment
      submitHearing(msgs);
      return;
    }

    currentSession.currentFieldIndex = idx;
    var field = fields[idx];

    var questionEl = document.createElement('div');
    questionEl.className = 'chat-msg bot';
    questionEl.textContent = CHAR_NAME + ': ' + field.label + (field.required ? '' : (locale === 'ja' ? '（スキップ可）' : ' (optional)'));
    msgs.appendChild(questionEl);
    msgs.scrollTop = msgs.scrollHeight;
  }

  async function handleHearingResponse(msg, msgs, typingEl) {
    typingEl.remove();

    if (!currentSession) return;
    var field = currentSession.fields[currentSession.currentFieldIndex];

    if (msg.toLowerCase() === 'skip' || msg === 'スキップ') {
      if (!field.required) {
        currentSession.currentFieldIndex++;
        askNextField(msgs);
        return;
      }
    }

    // Store the response
    currentSession.collected[field.key] = msg;
    currentSession.currentFieldIndex++;

    var ackEl = document.createElement('div');
    ackEl.className = 'chat-msg bot';
    ackEl.textContent = locale === 'ja' ? 'わかった！' : 'Got it!';
    msgs.appendChild(ackEl);

    askNextField(msgs);
  }

  async function submitHearing(msgs) {
    var infoEl = document.createElement('div');
    infoEl.className = 'chat-msg bot';
    infoEl.textContent = locale === 'ja'
      ? CHAR_NAME + ': 情報ありがとう！電話の準備ができたよ。お支払いをお願いね！'
      : CHAR_NAME + ': Thanks for the info! Ready to make the call. Please complete the payment!';
    msgs.appendChild(infoEl);

    // Submit hearing data to API
    await fetch(LIFECALL_API + '/api/sessions/' + currentSession.id + '/hearing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentSession.collected),
    });

    currentSession.status = 'payment';
    showPaymentUI(msgs);
  }

  function showPaymentUI(msgs) {
    var payDiv = document.createElement('div');
    payDiv.className = 'chat-msg bot';
    payDiv.id = 'lifecall-payment';
    payDiv.innerHTML = '<div style="background:rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin:4px 0;">' +
      '<div style="font-weight:700;margin-bottom:8px;">💳 ' + (locale === 'ja' ? 'お支払い' : 'Payment') + ' (¥' + currentSession.price + ')</div>' +
      '<div id="stripe-element" style="margin-bottom:12px;"></div>' +
      '<button id="pay-btn" style="width:100%;padding:10px;background:linear-gradient(135deg,#667eea,#764ba2);border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">' +
      (locale === 'ja' ? 'お支払い' : 'Pay Now') + '</button>' +
      '<button id="cancel-btn" style="width:100%;padding:8px;background:none;border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:rgba(255,255,255,0.6);margin-top:8px;cursor:pointer;">' +
      (locale === 'ja' ? 'キャンセル' : 'Cancel') + '</button>' +
      '</div>';
    msgs.appendChild(payDiv);
    msgs.scrollTop = msgs.scrollHeight;

    initStripePayment();
  }

  async function initStripePayment() {
    if (!stripe && STRIPE_PK) {
      stripe = Stripe(STRIPE_PK);
    }

    var res = await fetch(LIFECALL_API + '/api/payment/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: currentSession.id }),
    });
    var data = await res.json();

    if (!stripe || !data.client_secret) {
      document.getElementById('stripe-element').textContent =
        locale === 'ja' ? '決済の準備中にエラーが発生しました' : 'Payment setup error';
      return;
    }

    var elements = stripe.elements({ clientSecret: data.client_secret });
    var paymentElement = elements.create('payment');
    paymentElement.mount('#stripe-element');

    document.getElementById('pay-btn').addEventListener('click', async function() {
      this.disabled = true;
      this.textContent = locale === 'ja' ? '処理中...' : 'Processing...';

      var result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      });

      if (result.error) {
        this.disabled = false;
        this.textContent = locale === 'ja' ? 'お支払い' : 'Pay Now';
        alert(result.error.message);
      } else {
        await onPaymentSuccess();
      }
    });

    document.getElementById('cancel-btn').addEventListener('click', function() {
      currentSession = null;
      document.getElementById('lifecall-payment').remove();
      var cancelEl = document.createElement('div');
      cancelEl.className = 'chat-msg bot';
      cancelEl.textContent = CHAR_NAME + (locale === 'ja' ? ': キャンセルしたよ！また何かあったら言ってね。' : ': Cancelled! Let me know if you need anything else.');
      document.getElementById('chatMessages').appendChild(cancelEl);
    });
  }

  async function onPaymentSuccess() {
    var msgs = document.getElementById('chatMessages');

    // Remove payment UI
    var payEl = document.getElementById('lifecall-payment');
    if (payEl) payEl.remove();

    // Confirm payment
    await fetch(LIFECALL_API + '/api/payment/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: currentSession.id }),
    });

    var callingEl = document.createElement('div');
    callingEl.className = 'chat-msg bot';
    callingEl.textContent = CHAR_NAME + (locale === 'ja' ? ': お支払い完了！今から電話するね！📞' : ': Payment complete! Making the call now! 📞');
    msgs.appendChild(callingEl);

    currentSession.status = 'calling';

    // Initiate calls
    await fetch(LIFECALL_API + '/api/calls/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: currentSession.id }),
    });

    // Start polling for results
    pollCallStatus(msgs);
  }

  async function pollCallStatus(msgs) {
    var statusEl = document.createElement('div');
    statusEl.className = 'chat-msg bot';
    statusEl.id = 'call-status';
    statusEl.textContent = locale === 'ja' ? '📞 電話中...' : '📞 Calling...';
    msgs.appendChild(statusEl);

    var interval = setInterval(async function() {
      try {
        var res = await fetch(LIFECALL_API + '/api/sessions/' + currentSession.id);
        var data = await res.json();
        var session = data.session;
        var calls = data.calls || [];

        // Update status display
        var statusLines = calls.map(function(call) {
          var icon = call.status === 'completed'
            ? (call.outcome === 'booked' ? '✅' : '❌')
            : call.status === 'calling' ? '📞' : '⏳';
          return icon + ' ' + call.target_name + ' - ' + (call.outcome || call.status);
        });
        statusEl.innerHTML = statusLines.join('<br>');

        if (session.status === 'completed' || session.status === 'failed') {
          clearInterval(interval);
          showResult(msgs, session, calls);
        }
      } catch (e) {
        // Keep polling
      }
    }, 3000);
  }

  function showResult(msgs, session, calls) {
    var resultEl = document.createElement('div');
    resultEl.className = 'chat-msg bot';

    var bookedCall = calls.find(function(c) { return c.outcome === 'booked'; });

    if (bookedCall) {
      resultEl.innerHTML = '<div style="background:rgba(102,234,126,0.15);border:1px solid rgba(102,234,126,0.3);border-radius:12px;padding:12px;">' +
        '<strong>✅ ' + (locale === 'ja' ? '完了！' : 'Done!') + '</strong><br>' +
        '<strong>' + bookedCall.target_name + '</strong><br>' +
        (bookedCall.ai_summary || '') +
        (bookedCall.price_quoted ? '<br>💰 ' + bookedCall.price_quoted : '') +
        '</div>';
    } else {
      resultEl.innerHTML = '<div style="background:rgba(234,102,102,0.15);border:1px solid rgba(234,102,102,0.3);border-radius:12px;padding:12px;">' +
        '<strong>' + (locale === 'ja' ? '残念、予約できなかったよ...' : 'Sorry, couldn\'t book...') + '</strong><br>' +
        (locale === 'ja' ? '全額返金するね！' : 'You\'ll receive a full refund!') +
        '</div>';
    }

    msgs.appendChild(resultEl);
    msgs.scrollTop = msgs.scrollHeight;
    currentSession = null;
  }

})();
```

**Step 2: Deploy lifecall.js to mascodex.com**

Copy `js/lifecall.js` to the deploy directory and add to Pages static assets.

**Step 3: Commit**

```bash
git add js/lifecall.js
git commit -m "feat(lifecall): add frontend JS module for concierge chat integration"
```

---

### Task 11: Update template.js to load external scripts

**Files:**
- Modify: `scripts/generate-character-pages/template.js`

**Step 1: Add script tags before closing `</body>`**

Add these lines in `template.js` before the existing `<script>` block:

```html
  <script src="https://js.stripe.com/v3/"></script>
  <script src="https://mascodex.com/js/lifecall.js" defer></script>
```

**Important:** This is the LAST time we need to regenerate 120K pages. After this, all chat logic changes go through `lifecall.js`.

**Step 2: Regenerate pages, upload to R2, deploy**

Run:
```bash
cd scripts/generate-character-pages
rm -rf output && node generate.js
CF_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=yuruchara node upload.js
```

Deploy:
```bash
cp js/lifecall.js /tmp/mascodex-deploy/js/
cp functions/api/chat/\[postalCode\].js /tmp/mascodex-deploy/functions/api/chat/
wrangler pages deploy /tmp/mascodex-deploy --project-name=mascodex
```

**Step 3: Commit**

```bash
git add scripts/generate-character-pages/template.js
git commit -m "feat(lifecall): add Stripe and lifecall.js script tags to template"
```

---

## Phase 4: Deploy & Test

### Task 12: Deploy lifecall-worker

**Step 1: Set secrets**

```bash
cd goenchan/lifecall-worker
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put TELNYX_API_KEY
npx wrangler secret put TELNYX_FROM_NUMBER
npx wrangler secret put GOOGLE_PLACES_API_KEY
```

**Step 2: Deploy worker**

```bash
npx wrangler deploy
```

**Step 3: Update lifecall.js with actual URLs**

Update `LIFECALL_API` and `STRIPE_PK` in `js/lifecall.js` with the deployed worker URL and Stripe publishable key.

**Step 4: Configure Telnyx webhook**

Set the webhook URL in Telnyx dashboard to:
`https://lifecall-worker.taiichifox.workers.dev/webhooks/telnyx-voice`

---

### Task 13: End-to-end test

**Step 1: Test chat → concierge detection**

Visit `https://mascodex.com/c/2940045`, type "水道壊れた" in chat.
Expected: Character responds with concierge trigger, hearing mode starts.

**Step 2: Test hearing flow**

Answer each field question.
Expected: Payment UI appears after all fields collected.

**Step 3: Test Stripe payment (test mode)**

Use test card `4242 4242 4242 4242`.
Expected: Payment succeeds, call initiation starts.

**Step 4: Test Telnyx call**

Expected: Telnyx AI calls the target number, webhook updates status.

**Step 5: Verify result display**

Expected: Chat shows call result (booked/failed) and auto-refund if needed.

---

## Summary of Files

| File | Action | Purpose |
|------|--------|---------|
| `goenchan/lifecall-worker/package.json` | Create | Worker dependencies |
| `goenchan/lifecall-worker/wrangler.toml` | Create | Worker config + D1 binding |
| `goenchan/lifecall-worker/tsconfig.json` | Create | TypeScript config |
| `goenchan/lifecall-worker/src/index.ts` | Create | Hono router |
| `goenchan/lifecall-worker/src/categories.ts` | Create | 20 categories definition |
| `goenchan/lifecall-worker/src/session.ts` | Create | Session CRUD |
| `goenchan/lifecall-worker/src/payment.ts` | Create | Stripe integration |
| `goenchan/lifecall-worker/src/callScript.ts` | Create | Telnyx call scripts |
| `goenchan/lifecall-worker/src/calling.ts` | Create | Call initiation |
| `goenchan/lifecall-worker/src/webhooks/telnyx.ts` | Create | Voice webhook |
| `goenchan/lifecall-worker/src/search.ts` | Create | Google Places search |
| `goenchan/lifecall-worker/d1/schema.sql` | Create | Database schema |
| `functions/api/chat/[postalCode].js` | Modify | Add concierge detection |
| `js/lifecall.js` | Create | Frontend concierge module |
| `scripts/generate-character-pages/template.js` | Modify | Add script tags (1-time) |
