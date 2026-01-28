# Goenchan - Founder Visibility Detection System

企業ウェブサイトから創業者・CEOの情報を検出し、アウトリーチメールを自動生成するシステムです。

## プロジェクト構成

```
goenchan/
├── worker/          # Cloudflare Workers バックエンド
│   ├── src/
│   │   ├── index.ts
│   │   ├── handlers/
│   │   └── utils/
│   ├── package.json
│   └── wrangler.toml
└── frontend/        # React フロントエンド
    ├── src/
    │   ├── App.tsx
    │   ├── api.ts
    │   └── types.ts
    ├── package.json
    └── vite.config.ts
```

## 機能

### バックエンド (Cloudflare Workers)

#### POST /api/founder-visibility

企業URLから創業者・CEOの可視性を判定します。

**リクエスト:**
```json
{
  "url": "https://example.com"
}
```

**レスポンス:**
```json
{
  "url": "https://example.com",
  "founder_visibility": true,
  "evidence": ["https://example.com/message"],
  "checked_urls": ["https://example.com", "https://example.com/about", ...],
  "hit_keywords": ["代表挨拶", "CEO", "Founder"]
}
```

**検出ロジック:**
- 最大5ページをチェック（トップページ + 4ページ）
- 候補リンクを自動検出: `/about`, `/company`, `/message`, `/ceo` など
- キーワード検出: `代表挨拶`, `社長挨拶`, `代表メッセージ`, `代表取締役`, `CEO`, `Founder`
- robots.txt を軽くチェック（Disallow: / の場合はスキップ）
- 各ページのタイムアウト: 8秒

#### POST /api/outreach/generate

創業者が検出された企業向けにアウトリーチメールを生成します。

**リクエスト:**
```json
{
  "companyName": "株式会社サンプル",
  "url": "https://example.com",
  "questions": "創業のきっかけは？"
}
```

**レスポンス（eligible=true の場合）:**
```json
{
  "eligible": true,
  "subject": "ライブ配信出演のご相談（Goenchan）",
  "body": "...",
  "evidence": ["https://example.com/message"]
}
```

**レスポンス（eligible=false の場合）:**
```json
{
  "eligible": false,
  "reason": "founder_visibility_false"
}
```

### フロントエンド (React + Vite)

- 会社名、URL、質問内容を入力
- 「判定する」ボタンで創業者可視性をチェック
- 結果表示: TRUE/FALSE、証拠URL、検出キーワード、確認済みURL
- 「文面を生成」ボタン（founder_visibility=true の場合のみ有効）
- 件名・本文の表示とコピー機能

## セットアップ & 起動

### バックエンド (Worker)

```bash
# ディレクトリ移動
cd goenchan/worker

# 依存関係インストール
npm install

# ローカル開発サーバー起動
npx wrangler dev

# デプロイ
npx wrangler deploy
```

### フロントエンド

```bash
# ディレクトリ移動
cd goenchan/frontend

# 依存関係インストール
npm install

# 環境変数設定（必要に応じて編集）
cp .env.example .env

# 開発サーバー起動
npm run dev

# プロダクションビルド
npm run build

# プロダクションプレビュー
npm run preview
```

### 環境変数

フロントエンドの `.env` ファイル:

```
VITE_API_BASE_URL=http://localhost:8787
```

本番環境では、デプロイ先のWorker URLに変更してください。

## APIテスト (curl)

### Founder Visibility チェック

```bash
curl -X POST http://localhost:8787/api/founder-visibility \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### Outreach Email 生成

```bash
curl -X POST http://localhost:8787/api/outreach/generate \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "株式会社サンプル",
    "url": "https://example.com",
    "questions": "創業のきっかけは何ですか？"
  }'
```

## 技術スタック

- **バックエンド:** TypeScript, Cloudflare Workers, htmlparser2
- **フロントエンド:** React, TypeScript, Vite, TailwindCSS
- **デプロイ:** Wrangler (Cloudflare Workers)

## 制約事項

- ヘッドレスブラウザ不使用（HTTP fetch + HTMLパースのみ）
- ファイルシステム不使用（Cloudflare Workers環境）
- 最大5ページ/ドメイン
- 各ページ8秒タイムアウト
- 同一ドメインのみクロール

## 開発者向け情報

### ディレクトリ構造

```
goenchan/
├── worker/
│   ├── src/
│   │   ├── index.ts              # メインエントリーポイント
│   │   ├── handlers/
│   │   │   ├── founderVisibility.ts
│   │   │   └── outreachGenerate.ts
│   │   └── utils/
│   │       ├── fetcher.ts        # HTTP fetch with timeout
│   │       ├── parser.ts         # HTML parsing & keyword detection
│   │       └── robots.ts         # robots.txt checker
│   ├── package.json
│   ├── wrangler.toml
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── App.tsx               # メインUIコンポーネント
    │   ├── main.tsx              # エントリーポイント
    │   ├── api.ts                # API クライアント
    │   ├── types.ts              # TypeScript 型定義
    │   └── index.css             # TailwindCSS
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── index.html
```

## ライセンス

Private - Goenchan用カスタム開発
