# Life Call Concierge - Design Document

Date: 2026-02-25
Status: Approved

## Overview

mascodex.comの12万ゆるキャラを「ローカルコンシェルジュ」に進化。キャラとチャットで困りごとを伝えると、AIが業者/施設に電話代行してくれるサービス。

**副題:** 面倒な電話、全部やります。

## Concept

- 各キャラクターページ（mascodex.com/c/{postalCode}）のチャットウィジェットが入口
- ユーザーが困りごとを伝える → AIがカテゴリ判定 → ヒアリング → 決済 → AI電話 → 結果報告
- 日本人 + 外国人の両方がターゲット

## User Flow

```
1. ユーザーがmascodex.com/c/{postalCode}にアクセス
2. ゆるキャラとチャット（既存機能）
3. 「水道壊れた」「病院予約したい」等の困りごとを伝える
4. AIが問題カテゴリを自動判定
5. キャラがフレンドリーにヒアリング（住所確認、希望日時、予算など）
6. 必要情報が揃ったら → Stripe決済画面をチャット内に表示
7. 決済完了 → Telnyx AIが業者/施設に電話
8. 結果をチャットで報告
```

## 20 Categories

### Tier 1: 500円（シンプル予約）

| # | Category ID | 名前 | ヒアリング項目 | AI電話の目的 |
|---|-------------|------|---------------|-------------|
| 1 | hospital_new | 病院初診予約 | 病院名(orエリア+科目), 希望日, 症状(任意) | 初診予約 |
| 2 | hospital_change | 再診予約変更 | 病院名, 患者名, 現在の予約日, 希望変更日 | 予約変更 |
| 3 | dentist | 歯医者予約 | 歯科名(orエリア), 希望日, 症状(任意) | 予約 |
| 4 | health_check | 健康診断予約 | 施設名(orエリア), 希望日, 検査種類 | 予約 |
| 5 | restaurant | レストラン予約 | 店名, 日時, 人数, 要望(個室等) | 予約 |
| 6 | karaoke | カラオケ予約 | 店名(orエリア), 日時, 人数 | 予約・料金確認 |
| 7 | izakaya_group | 居酒屋団体予約 | 店名, 日時, 人数, コース有無, 予算 | 予約・コース確認 |
| 8 | birthday | 誕生日サプライズ確認 | 店名, 日時, サプライズ内容 | ケーキ手配等確認 |

### Tier 2: 1,500円（比較・交渉あり）

| # | Category ID | 名前 | ヒアリング項目 | AI電話の目的 |
|---|-------------|------|---------------|-------------|
| 9 | moving | 引越し業者比較 | 現住所, 引越先, 希望日, 荷物量 | 3社に見積依頼 |
| 10 | internet | インターネット契約確認 | プロバイダ名, 契約番号(任意), 質問内容 | 契約確認・変更 |
| 11 | utility_start | 電気・ガス開栓予約 | 電力/ガス会社, 住所, 希望日 | 開栓予約 |
| 12 | move_out | 退去連絡 | 管理会社名, 物件名, 退去希望日 | 退去通知 |
| 13 | aircon_repair | エアコン修理 | メーカーor業者名(orエリア), 症状, 希望日 | 見積・修理予約 |
| 14 | junk_removal | 不用品回収見積 | エリア, 品目リスト, 希望日 | 2社に見積依頼 |
| 15 | return_exchange | 返品・交換連絡 | 店名, 商品名, 購入日, 理由 | 返品・交換手続き |

### Tier 3: 3,000円（緊急・複数社対応）

| # | Category ID | 名前 | ヒアリング項目 | AI電話の目的 |
|---|-------------|------|---------------|-------------|
| 16 | plumbing | トイレ水漏れ | 水止まってる?, 住所, 希望対応時間, 予算上限 | 最大3社に連絡 |
| 17 | locksmith | 鍵紛失 | 住所, 鍵の種類, 現在の状況 | 最大3社に連絡 |
| 18 | gym_cancel | ジム解約 | ジム名, 会員番号, 解約理由(任意) | 解約手続き |
| 19 | subscription_cancel | サブスク解約 | サービス名, 会員情報 | 解約手続き |
| 20 | newspaper_cancel | 新聞解約 | 新聞社名, 顧客番号(任意), 住所 | 解約手続き |

## Technical Architecture

### System Diagram

```
mascodex.com/c/{postalCode}
    └── チャットウィジェット（既存を拡張）
         │
         ▼
    /api/chat/{postalCode}  ← 既存Claude Haiku API（拡張）
         │
         ├─ 通常会話 → そのまま返答（現行通り）
         │
         └─ コンシェルジュ要求検出
              │
              ▼
         lifecall-worker API  ← 新規Cloudflare Worker
              │
              ├─ ヒアリング（Claude API）
              ├─ 業者検索（Google Places API）
              ├─ Stripe決済
              └─ Telnyx AI通話 → 結果報告
```

### New Project: goenchan/lifecall-worker/

```
goenchan/lifecall-worker/
├── wrangler.toml
├── package.json
├── src/
│   ├── index.ts              # Router
│   ├── categories.ts         # 20カテゴリ定義
│   ├── concierge/
│   │   ├── session.ts        # セッション管理（D1）
│   │   ├── hearing.ts        # ヒアリングロジック
│   │   ├── callScript.ts     # Telnyx台本生成
│   │   └── search.ts         # Google Places業者検索
│   ├── payment/
│   │   └── stripe.ts         # Stripe決済
│   └── webhooks/
│       ├── telnyx-voice.ts   # 通話結果受信
│       └── stripe.ts         # 決済Webhook
├── d1/
│   └── schema.sql
```

### Database Schema (D1)

```sql
CREATE TABLE lifecall_sessions (
  id TEXT PRIMARY KEY,
  postal_code TEXT NOT NULL,
  category TEXT,
  status TEXT DEFAULT 'hearing',  -- hearing, payment, calling, completed, failed, refunded
  hearing_data TEXT,              -- JSON
  price_tier INTEGER,             -- 500, 1500, 3000
  locale TEXT DEFAULT 'ja',
  stripe_payment_intent_id TEXT,
  stripe_refund_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE lifecall_calls (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES lifecall_sessions(id),
  target_name TEXT NOT NULL,
  target_phone TEXT NOT NULL,
  call_order INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',  -- pending, calling, completed, failed
  outcome TEXT,                   -- booked, available, unavailable, no_answer, voicemail, over_budget
  ai_summary TEXT,
  price_quoted TEXT,
  telnyx_call_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE lifecall_chat_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES lifecall_sessions(id),
  role TEXT NOT NULL,             -- user, assistant, system
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### Frontend: External JS Approach

チャットロジックを外部JSファイルに分離し、12万ページの再生成を回避。

```html
<!-- template.jsに1回だけ追加 -->
<script src="https://js.stripe.com/v3/"></script>
<script src="https://mascodex.com/js/lifecall.js"></script>
```

`lifecall.js`の内容:
- コンシェルジュモード検出
- Stripe Payment Element表示
- 通話ステータスポーリング
- 結果カード表示

### Chat UI Extensions

1. **Stripe決済インライン** - チャット内にPayment Element表示
2. **通話ステータス** - リアルタイム進行状況
3. **結果カード** - 予約内容、業者情報、見積もり

### AI Call Script Framework

```
1. 丁寧な挨拶（「お忙しいところ恐れ入ります」）
2. 代行であることを明示（「お客様の代理でお電話しております」）
3. 用件を簡潔に伝える
4. 必要情報のやり取り
5. 結果確認・復唱
6. お礼と終話
```

## Pricing

### Japanese Users
- 500円: シンプル予約（病院、レストラン、カラオケ等）
- 1,500円: 比較・交渉あり（引越し見積、不用品回収等）
- 3,000円: 緊急・複数社対応（水漏れ、鍵紛失等）

### Foreign Users (1.5x)
- 750円: Simple booking
- 2,250円: Comparison/negotiation
- 4,500円: Emergency/multi-vendor

## Multilingual Support

- Chat UI: Japanese/English (auto-detect from browser)
- Character responses: Match user's language (Claude auto-switch)
- AI phone calls: Always in Japanese (calling Japanese businesses)

## Error Handling & Refund Policy

| Situation | Action |
|-----------|--------|
| All calls fail (no answer/unavailable) | Full automatic refund |
| No vendors found | Full refund + alternatives |
| Over budget | User confirmation (approve/reject) |
| Telnyx call error | 1 retry, then refund |
| Cancel within 24h of payment | Full refund |

## Safety & Legal

- NO medical advice (booking only)
- NO legal advice
- NO sales calls
- Disclaimer shown at chat start and before payment:
  「本サービスは法的・医療的助言を行いません。連絡代行のみです。」

## Business Targets

- Initial: 500 calls/month
- Average price: ¥1,200
- Monthly revenue target: ¥600,000
- Future: vendor referral fees, B2B partnerships
