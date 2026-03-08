# Mascodex: 新しい国追加パイプライン設計書

> 対象例: UK（イギリス）〜約3,000 postcode areas
> 作成日: 2026-03-05
> 既存参照: JP(120K), US(31K), IN(19K), AU(240)

---

## アーキテクチャ概要

```
[1. 郵便番号収集] → [2. プロフィール生成] → [3. Wikipedia情報取得]
       ↓                    ↓                       ↓
[4. 個性生成(統合)]  ← ← ← ← ← ← ← ← ← ← ← ← ← ←
       ↓
[5. 画像生成] → [6. R2アップロード(画像)]
       ↓
[7. ページ生成] → [8. R2アップロード(ページ)]
       ↓
[9. クイズ生成] → [10. KVアップロード]
       ↓
[11. モックアップ生成]
       ↓
[12. CF Functions追加] → [13. Mastodon登録] → [14. トップページ追加]
       ↓
[15. デプロイ・サイトマップ]
```

---

## Step 0: 事前準備（Cloudflare リソース作成）

### 必要な作業
```bash
# R2バケット作成
wrangler r2 bucket create mascodex-uk

# KV namespace作成
wrangler kv namespace create UK_KV
# → ID をメモして wrangler.toml に追記
```

### wrangler.toml に追加
```toml
# === UK Mascot additions ===
[[r2_buckets]]
binding = "UK_CHAR_R2"
bucket_name = "mascodex-uk"

[[kv_namespaces]]
binding = "UK_KV"
id = "<作成時のID>"
```

| 項目 | 値 |
|------|-----|
| 既存スクリプト | なし（新規作成） |
| 所要時間 | 10分 |
| 自動化 | 手動（1回のみ） |

---

## Step 1: 郵便番号収集

### UK郵便番号の特徴
- 形式: アルファベット+数字の組み合わせ（例: SW1A 1AA, M1 1AE）
- Postcode Area: 約120（例: SW, EC, M, B）
- Postcode District: 約3,000（例: SW1A, EC1A, M1）
- Postcode Sector/Full: 約170万件 → **District単位(3,000件)が最適**

### データソース
- **推奨**: [ONS Postcode Directory](https://geoportal.statistics.gov.uk/) (Office for National Statistics)
- **代替**: [Wikipedia UK postcode areas](https://en.wikipedia.org/wiki/List_of_postcode_districts_in_the_United_Kingdom)
- **フリーCSV**: [postcodes.io](https://postcodes.io/) API or dump

### 作成するスクリプト
```
goenchan/uk-mascot-pipeline/
  src/
    gen-postcodes.js         ← NEW: postcodes.io APIまたはCSVからデータ収集
  data/
    postcodes.json           ← 出力: [{postcode, city, county, country, region}]
```

### postcodes.json の形式
```json
[
  {
    "postcode": "SW1A",
    "city": "Westminster",
    "county": "Greater London",
    "region": "London",
    "country": "England",
    "lat": 51.501,
    "lon": -0.141
  }
]
```

### バリデーション
- UK postcode district: `/^[A-Z]{1,2}\d[A-Z\d]?$/i`
- 重複除去
- 最低限の city/region マッピング

| 項目 | 値 |
|------|-----|
| 既存スクリプト | `goenchan/au-mascot-pipeline/src/gen-postcodes.js` を参考 |
| 新規作成 | `goenchan/uk-mascot-pipeline/src/gen-postcodes.js` |
| 推定所要時間 | 30分（スクリプト作成）+ 5分（実行） |
| 依存関係 | Step 0 完了後 |
| 自動化 | 完全自動 |

---

## Step 2: プロフィール生成

### 2つの方式（選択可能）

#### 方式A: Cloudflare Workers AI（無料、AU方式）
- Worker: `au-profile-gen.taiichifox.workers.dev` を複製
- モデル: `@cf/meta/llama-3.1-8b-instruct`
- コスト: 無料
- 品質: やや低い（JSON解析失敗あり）

#### 方式B: Claude API（有料、US/IN方式）
- `goenchan/us-mascot-pipeline/src/batch-profile-gen.js` を参考
- モデル: claude-haiku-4-5（安価）
- コスト: 約$5-10（3,000件）
- 品質: 高い

### 推奨: 方式B（Claude API）
品質と信頼性を考慮して Claude Haiku 推奨。

### 作成するスクリプト
```
goenchan/uk-mascot-pipeline/src/batch-profile-gen.js   ← NEW
```

### プロフィール JSON 形式
```json
{
  "postcode": "SW1A",
  "city": "Westminster",
  "region": "London",
  "country": "England",
  "name": "Sir Westie",
  "personality": "Regal, witty, loves tea",
  "catchphrase": "Quite right, old chap!",
  "appearance": "A distinguished fox in a bowler hat",
  "backstory": "Born in the shadow of Big Ben...",
  "fact": "SW1A contains Buckingham Palace and 10 Downing Street",
  "emoji": "🇬🇧",
  "colorPalette": ["#c8102e", "#012169", "#ffdd57"],
  "dialect": "Received Pronunciation",
  "localSlang": ["brilliant", "cheeky", "blimey"]
}
```

### UK固有のプロンプト要素
- **方言**: Cockney (London), Geordie (Newcastle), Scouse (Liverpool), Brummie (Birmingham), Yorkshire, Scottish
- **口癖**: 地域ごとのスラング（"proper", "mint", "brill", "class"）
- **文化**: 各地域の名物料理、スポーツチーム、歴史的建造物

| 項目 | 値 |
|------|-----|
| 参考スクリプト | `goenchan/us-mascot-pipeline/src/batch-profile-gen.js` |
| 新規作成 | `goenchan/uk-mascot-pipeline/src/batch-profile-gen.js` |
| 推定所要時間 | 1時間（スクリプト）+ 2-3時間（3,000件生成） |
| 依存関係 | Step 1 完了後 |
| 自動化 | 完全自動（レジューム可能） |
| コスト | 約$5-10（Claude Haiku） |

---

## Step 3: Wikipedia 情報取得

### 概要
各 city/town の Wikipedia ページからサマリーを取得し、local_notes として保存。

### データ取得方法
```
Wikipedia REST API:
GET https://en.wikipedia.org/api/rest_v1/page/summary/{city_name}
```

### 作成するスクリプト
```
goenchan/uk-mascot-pipeline/src/wiki-collect.js   ← NEW
```

### ロジック
1. postcodes.json から一意の city 名を抽出（~2,000都市）
2. 各都市の Wikipedia API を叩く（rate limit: 1 req/sec）
3. `data/wiki/{city_name}.json` にキャッシュ
4. summary, coordinates, thumbnail を保存

| 項目 | 値 |
|------|-----|
| 参考スクリプト | `goenchan/us-mascot-pipeline/src/quiz-pipeline.js` のwiki収集部分 |
| 新規作成 | `goenchan/uk-mascot-pipeline/src/wiki-collect.js` |
| 推定所要時間 | 30分（スクリプト）+ 40分（2,000件 @ 1req/sec） |
| 依存関係 | Step 1 完了後（Step 2 と並行可能） |
| 自動化 | 完全自動（キャッシュあり） |

---

## Step 4: 個性生成（方言・口癖等）

### 概要
Step 2 のプロフィールに方言・口癖・ローカル知識を追加。
**Step 2 のプロンプトに統合するのが最も効率的**。

### UK 地域別の方言マッピング
```javascript
const UK_DIALECTS = {
  'London': { dialect: 'Cockney/Estuary English', slang: ['blimey', 'innit', 'well proper'] },
  'Manchester': { dialect: 'Mancunian', slang: ['mint', 'our kid', 'dead good'] },
  'Liverpool': { dialect: 'Scouse', slang: ['boss', 'la', 'sound'] },
  'Birmingham': { dialect: 'Brummie', slang: ['bab', 'bostin', 'ta-ra'] },
  'Newcastle': { dialect: 'Geordie', slang: ['howay', 'canny', 'pet'] },
  'Yorkshire': { dialect: 'Yorkshire', slang: ['ey up', 'nowt', 'owt'] },
  'Scotland': { dialect: 'Scots', slang: ['wee', 'aye', 'bonnie'] },
  'Wales': { dialect: 'Welsh English', slang: ['tidy', 'cwtch', 'now in a minute'] },
  'N. Ireland': { dialect: 'Hiberno-English', slang: ['craic', 'wee', 'so it is'] },
};
```

| 項目 | 値 |
|------|-----|
| 新規作成 | Step 2 のプロンプトに統合（別スクリプト不要） |
| 推定所要時間 | 0（Step 2 に含む） |
| 依存関係 | Step 1 |

---

## Step 5: 画像生成

### 概要
各キャラクターの画像を2バリアント生成。

### 方式: CF Workers AI Image Worker
US方式と同じく、専用 Image Gen Worker を作成。

### 作成するもの
```
goenchan/uk-image-worker/              ← NEW (Cloudflare Worker)
  src/index.ts                         ← Image generation worker
  wrangler.toml
goenchan/uk-mascot-pipeline/src/image-gen.js   ← NEW (batch caller)
```

### Image Worker の構成
```typescript
// models: @cf/stabilityai/stable-diffusion-xl-base-1.0
// or: @cf/bytedance/stable-diffusion-xl-lightning
// Input: { postcode, prompt, variant, negative_prompt }
// Output: generated image → R2 mascodex-uk に保存
// Key: uk/{postcode}_0{variant}.png
```

### バッチ生成スクリプト
- profiles/*.json を読み、appearance フィールドからプロンプト生成
- 並列度: 5（Workers AI rate limit考慮）
- レジューム可能（R2に既存チェック）

| 項目 | 値 |
|------|-----|
| 参考スクリプト | `goenchan/us-mascot-pipeline/src/image-gen.js` + `goenchan/us-image-worker/` |
| 新規作成 | Worker + バッチスクリプト |
| 推定所要時間 | 1時間（Worker作成）+ 4-6時間（3,000×2=6,000画像生成） |
| 依存関係 | Step 0 + Step 2 完了後 |
| コスト | CF Workers AI は無料枠あり（1日10,000req） |

---

## Step 6: クイズデータ生成

### 概要
各 postcode に対して5問のクイズを生成し、KV にアップロード。

### 作成するスクリプト
```
goenchan/uk-mascot-pipeline/src/quiz-pipeline.js   ← NEW
```

### ロジック（US版の流れを踏襲）
1. postcodes.json + wiki データを読み込み
2. Claude Haiku で各 postcode につき5問のクイズ生成
3. KV バッチファイルに出力: `data/quiz-kv-batches/batch_XXXX.json`
4. wrangler kv bulk put でアップロード

### KV キー形式
```
quiz_uk:{postcode}   → { "questions": [...] }
```

### クイズ形式
```json
{
  "questions": [
    {
      "question": "What famous landmark is located in Westminster?",
      "choices": ["Big Ben", "Tower Bridge", "Stonehenge", "Edinburgh Castle"],
      "correct": 0
    }
  ]
}
```

| 項目 | 値 |
|------|-----|
| 参考スクリプト | `goenchan/us-mascot-pipeline/src/quiz-pipeline.js` |
| 新規作成 | `goenchan/uk-mascot-pipeline/src/quiz-pipeline.js` |
| 推定所要時間 | 1時間（スクリプト）+ 3-4時間（3,000件生成） |
| 依存関係 | Step 1 + Step 3 完了後 |
| コスト | 約$3-5（Claude Haiku） |

---

## Step 7: ページ生成

### 概要
プロフィール + Wiki + 画像パスからHTML静的ページを生成。

### 作成するスクリプト
```
goenchan/uk-mascot-pipeline/src/page-gen.js   ← NEW
```

### ページ構成（AU版を参考）
- ヘッダー: キャラ名、postcode、city、catchphrase
- 画像: `/img/uk/{postcode}_01.png`, `_02.png`
- セクション: About, Personality, Appearance, Local Facts
- チャットウィジェット: `/api/chat/uk/{postcode}` へPOST
- クイズウィジェット: `/api/quiz/uk/{postcode}` からGET
- マーチャンダイズリンク
- ソーシャルフィード

### 出力
```
data/pages/{postcode}/index.html
```

| 項目 | 値 |
|------|-----|
| 参考スクリプト | `goenchan/au-mascot-pipeline/src/page-gen.js` |
| 新規作成 | `goenchan/uk-mascot-pipeline/src/page-gen.js` |
| 推定所要時間 | 1時間（テンプレート作成）+ 1分（3,000件生成） |
| 依存関係 | Step 2 + Step 3 完了後 |
| 自動化 | 完全自動 |

---

## Step 8: R2 アップロード

### 概要
生成したHTML pages を R2 mascodex-uk にアップロード。

### 作成するスクリプト
```
goenchan/uk-mascot-pipeline/src/upload-r2-parallel.js   ← NEW
```

### キー形式
```
mascodex-uk/uk/c/{postcode}/index.html
```

### アップロード設定
- 並列度: 20（wrangler r2 object put）
- リトライ: 3回
- Content-Type: text/html

| 項目 | 値 |
|------|-----|
| 参考スクリプト | `goenchan/au-mascot-pipeline/src/upload-r2-parallel.js` |
| 新規作成 | `goenchan/uk-mascot-pipeline/src/upload-r2-parallel.js` |
| 推定所要時間 | 30分（スクリプト）+ 10分（3,000件アップロード） |
| 依存関係 | Step 7 完了後 |
| 自動化 | 完全自動 |

---

## Step 9: KV アップロード（プロフィール + クイズ）

### プロフィール KV
```bash
# キー形式: uk_char_{postcode}
# バッチファイル作成後:
wrangler kv bulk put --namespace-id=<UK_KV_ID> data/profile-kv-batch.json --remote
```

### クイズ KV
```bash
# キー形式: quiz_uk:{postcode}
wrangler kv bulk put --namespace-id=<UK_KV_ID> data/quiz-kv-batches/batch_0001.json --remote
```

### 作成するスクリプト
```
goenchan/uk-mascot-pipeline/src/bulk-kv-upload.js   ← NEW
```

| 項目 | 値 |
|------|-----|
| 参考スクリプト | `goenchan/us-mascot-pipeline/src/bulk-kv-upload.js` |
| 新規作成 | `goenchan/uk-mascot-pipeline/src/bulk-kv-upload.js` |
| 推定所要時間 | 20分（スクリプト）+ 5分（アップロード） |
| 依存関係 | Step 2 + Step 6 完了後 |

---

## Step 10: モックアップ生成（Tシャツ・マグ）

### 方式: Printful API（既存スクリプト流用可能）
既存の `scripts/mockup/generate-character-mockups.js` をそのまま使える。

### 実行方法
```bash
# 人気postcodeのみ（全件は不要、代表的な50件程度）
PRINTFUL_API_KEY=xxx node scripts/mockup/generate-character-mockups.js \
  --products=tshirt,mug \
  --file=uk-popular-postcodes.txt
```

### 注意点
- Printful API は postcode ではなく character code (7桁) を想定
- UK 用にコード体系を決める必要あり（例: `UK_SW1A` → 7桁IDに変換）
- **代替案**: AU方式と同じくCSS合成でモックアップ表示（API不要）

| 項目 | 値 |
|------|-----|
| 既存スクリプト | `scripts/mockup/generate-character-mockups.js` |
| 新規作成 | 不要（既存を流用 or CSS合成） |
| 推定所要時間 | 1時間（50件のモックアップ生成） |
| 依存関係 | Step 5 完了後 |
| コスト | Printful API 無料枠 |

---

## Step 11: Cloudflare Pages Functions 追加

### 新規作成が必要なファイル

#### 11a. ページルーティング
```
functions/uk/c/[code].js   ← NEW
```
- R2 `mascodex-uk` から `uk/c/{postcode}/index.html` を返す
- ソーシャルフィード注入
- クイズ注入
- 参考: `functions/us/c/[code].js`
- **バリデーション**: UK postcode district `/^[A-Z]{1,2}\d[A-Z\d]?$/i`

#### 11b. 画像プロキシ
```
functions/img/uk/[key].js   ← NEW
```
- R2 `mascodex-uk` から `uk/{key}` を返す
- 参考: `functions/img/us/[key].js`

#### 11c. チャットAPI
```
functions/api/chat/uk/[postcode].js   ← NEW
```
- UK_KV から `uk_char_{postcode}` でプロフィール取得
- Claude Haiku でチャット応答
- UK英語のシステムプロンプト
- 参考: `functions/api/chat/us/[zipCode].js`

#### 11d. クイズAPI
```
functions/api/quiz/uk/[postcode].js   ← NEW
```
- UK_KV から `quiz_uk:{postcode}` を返す
- 参考: `functions/api/quiz/us/[zipCode].js`

| 項目 | 値 |
|------|-----|
| 参考スクリプト | `functions/us/c/[code].js`, `functions/api/chat/us/[zipCode].js`, etc. |
| 新規作成 | 4ファイル |
| 推定所要時間 | 2時間 |
| 依存関係 | Step 0（wrangler.toml更新）完了後 |

---

## Step 12: Mastodon ソーシャル対応

### mascot-social Worker の更新

#### 12a. Actor URL パターン追加
`goenchan/mascot-social/src/index.ts` を更新:

```typescript
// 既存の判定ロジックにUKを追加
summary: zip.startsWith('UK')
  ? `Community mascot for ${mascot.city} (${zip}) 🇬🇧 | mascodex.com/uk/c/${zip}`
  : ...,
url: zip.startsWith('UK')
  ? `https://mascodex.com/uk/c/${zip}`
  : ...,
icon: {
  url: zip.startsWith('UK')
    ? `https://mascodex.com/img/uk/${zip}_01.png`
    : ...
}
```

#### 12b. マスコット登録
D1 DB に UK マスコットを登録する投稿クロンスクリプトを作成:

```
goenchan/uk-mascot-pipeline/src/social-register.js   ← NEW
```

各マスコットを `POST /users/{postcode}/post` で初回投稿。

#### 12c. index.html の Live Feed 更新
```javascript
function isUK(zip) { return /^[A-Z]{1,2}\d/.test(zip); }
// getCharUrl / getImgUrl にUK分岐を追加
```

| 項目 | 値 |
|------|-----|
| 既存ファイル修正 | `goenchan/mascot-social/src/index.ts` |
| 新規作成 | `goenchan/uk-mascot-pipeline/src/social-register.js` |
| 推定所要時間 | 1.5時間 |
| 依存関係 | Step 2 + Step 5 完了後 |

---

## Step 13: トップページ（index.html）更新

### 追加するカード
```html
<a href="/uk/" class="country-card">
  <div class="country-flag">&#x1F1EC;&#x1F1E7;</div>
  <div class="country-name">United Kingdom</div>
  <div class="country-count">3,000+ mascots</div>
  <div class="country-mascots">
    <img src="/img/uk/SW1A_01.png" alt="Westminster mascot" onerror="this.style.display='none'">
    <img src="/img/uk/M1_01.png" alt="Manchester mascot" onerror="this.style.display='none'">
    <img src="/img/uk/EH1_01.png" alt="Edinburgh mascot" onerror="this.style.display='none'">
  </div>
  <span class="country-btn">Explore UK</span>
</a>
```

### Live Feed に UK 列追加
```html
<div class="live-col" id="live-uk">
  <div class="live-col-header">🇬🇧 UK</div>
  <div class="live-posts" id="posts-uk"><div class="loading">Loading...</div></div>
</div>
```

### UK ランディングページ
```
uk/index.html   ← NEW: UK マスコット一覧・検索ページ
```

### 国判定ロジック更新（index.html内のJS）
```javascript
function isUK(zip) { return /^[A-Z]{1,2}\d/.test(zip); }
function getCharUrl(zip) {
  if (isUK(zip)) return `${MASCODEX}/uk/c/${zip}`;
  // ... existing
}
function getImgUrl(zip) {
  if (isUK(zip)) return `${MASCODEX}/img/uk/${zip}_01.png`;
  // ... existing
}
```

| 項目 | 値 |
|------|-----|
| 既存ファイル修正 | `index.html` |
| 新規作成 | `uk/index.html` |
| 推定所要時間 | 1時間 |
| 依存関係 | Step 5（画像が少なくとも一部必要） |

---

## Step 14: サイトマップ・ルーティング

### 14a. サイトマップ
```
functions/sitemap-uk.xml.js   ← NEW
```
- 全 UK postcode district の URL を列挙
- 参考: `functions/sitemap-us.xml.js`

### 14b. _routes.json 更新（もしあれば）
Pages Functions のルーティング設定。

### 14c. sitemap.xml（親）更新
```
functions/sitemap.xml.js   ← 修正: UK サイトマップへのリンク追加
```

| 項目 | 値 |
|------|-----|
| 新規作成 | `functions/sitemap-uk.xml.js` |
| 修正 | `functions/sitemap.xml.js` |
| 推定所要時間 | 30分 |
| 依存関係 | Step 11 完了後 |

---

## 依存関係グラフ

```
Step 0 (CF Resources)
  ├── Step 1 (Postcodes)
  │     ├── Step 2 (Profiles) ──→ Step 5 (Images) ──→ Step 8 (R2 Upload Pages)
  │     │     │                      │                    │
  │     │     │                      ├── Step 10 (Mockups)│
  │     │     │                      │                    │
  │     │     ├── Step 7 (Pages) ←───┘                    │
  │     │     │     └── Step 8 (R2 Upload) ───────────────┘
  │     │     │
  │     │     ├── Step 9 (KV Upload) ←── Step 6 (Quiz)
  │     │     │
  │     │     └── Step 12 (Mastodon)
  │     │
  │     └── Step 3 (Wikipedia) ──→ Step 6 (Quiz)
  │                              ──→ Step 2 に情報追加（オプション）
  │
  └── Step 11 (CF Functions) ← 独立して先行作成可能
        └── Step 13 (Top Page)
              └── Step 14 (Sitemap)
```

### 並行実行可能な組み合わせ
- Step 2 (プロフィール) と Step 3 (Wikipedia) は並行可能
- Step 5 (画像生成) と Step 6 (クイズ生成) は並行可能
- Step 11 (Functions) は Step 1 完了後すぐ着手可能

---

## 全体タイムライン（UK: 3,000 postcodes）

| フェーズ | 所要時間 | 内容 |
|---------|---------|------|
| Day 1 午前 | 2h | Step 0-1: リソース作成 + 郵便番号収集 |
| Day 1 午前 | 2h | Step 11: CF Functions 作成（並行） |
| Day 1 午後 | 4h | Step 2+3: プロフィール生成 + Wikipedia収集（並行） |
| Day 1 夜 | 6h | Step 5: 画像生成（バックグラウンド実行） |
| Day 2 午前 | 2h | Step 6+7: クイズ生成 + ページ生成 |
| Day 2 午後 | 1h | Step 8+9: R2/KV アップロード |
| Day 2 午後 | 2h | Step 12+13+14: Social + トップページ + サイトマップ |
| Day 2 夕 | 1h | Step 10: モックアップ（人気50件のみ） |
| Day 2 夕 | 30m | 最終デプロイ + テスト |
| **合計** | **約2日** | |

---

## コスト概算

| 項目 | コスト |
|------|--------|
| Claude Haiku (プロフィール3K件) | ~$5-10 |
| Claude Haiku (クイズ3K件) | ~$3-5 |
| Claude Haiku (チャット運用/月) | ~$5-20/月 |
| CF Workers AI (画像6K枚) | 無料枠内 |
| Printful API (モックアップ50件) | 無料 |
| R2 Storage | 無料枠内 |
| KV Storage | 無料枠内 |
| **初期構築合計** | **~$10-15** |

---

## 新規作成ファイル一覧

### パイプラインスクリプト（7ファイル）
```
goenchan/uk-mascot-pipeline/
  package.json
  src/gen-postcodes.js
  src/batch-profile-gen.js
  src/wiki-collect.js
  src/image-gen.js
  src/page-gen.js
  src/upload-r2-parallel.js
  src/bulk-kv-upload.js
  src/quiz-pipeline.js
  src/social-register.js
```

### Image Worker（2ファイル）
```
goenchan/uk-image-worker/
  src/index.ts
  wrangler.toml
```

### CF Pages Functions（6ファイル）
```
functions/uk/c/[code].js
functions/img/uk/[key].js
functions/api/chat/uk/[postcode].js
functions/api/quiz/uk/[postcode].js
functions/sitemap-uk.xml.js
```

### ページ
```
uk/index.html
```

### 修正ファイル一覧
```
wrangler.toml                           ← R2/KV binding追加
index.html                              ← UK カード + Live Feed追加
functions/sitemap.xml.js                 ← UK サイトマップリンク追加
goenchan/mascot-social/src/index.ts      ← UK actor パターン追加
```

---

## 汎用化のポイント（次の国追加を更に簡単に）

今後さらに国を追加する場合（例: FR, DE, BR）に備えて:

1. **テンプレート化**: `goenchan/country-template/` に雛形を作る
2. **設定ファイル**: `country-config.json` に国固有情報を集約
   ```json
   {
     "code": "uk",
     "name": "United Kingdom",
     "flag": "🇬🇧",
     "postalFormat": "/^[A-Z]{1,2}\\d[A-Z\\d]?$/i",
     "language": "en",
     "r2Bucket": "mascodex-uk",
     "kvPrefix": "uk_char_",
     "quizPrefix": "quiz_uk:",
     "imgPath": "/img/uk/",
     "pagePath": "/uk/c/"
   }
   ```
3. **共通モジュール**: R2アップロード、KVバッチ、ページテンプレートを共通化

---

## チェックリスト（実行時の確認用）

- [ ] R2バケット `mascodex-uk` 作成
- [ ] KV namespace `UK_KV` 作成
- [ ] wrangler.toml にバインディング追加
- [ ] postcodes.json 生成（~3,000件）
- [ ] プロフィール JSON 全件生成
- [ ] Wikipedia データ収集
- [ ] 画像 6,000枚生成・R2アップロード
- [ ] HTMLページ 3,000件生成・R2アップロード
- [ ] クイズデータ生成・KVアップロード
- [ ] プロフィール KVアップロード
- [ ] functions/uk/c/[code].js 作成・テスト
- [ ] functions/img/uk/[key].js 作成・テスト
- [ ] functions/api/chat/uk/[postcode].js 作成・テスト
- [ ] functions/api/quiz/uk/[postcode].js 作成・テスト
- [ ] index.html に UK カード追加
- [ ] uk/index.html 作成
- [ ] mascot-social に UK 対応追加
- [ ] sitemap-uk.xml 作成
- [ ] sitemap.xml に UK 追加
- [ ] モックアップ生成（代表50件）
- [ ] 全ページ動作テスト
- [ ] デプロイ
