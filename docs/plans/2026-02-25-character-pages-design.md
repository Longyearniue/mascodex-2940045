# 12万体キャラクターページ + チャット機能 設計書

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 124,550体のゆるキャラそれぞれに、SEO対応の静的ページ + Claude AIチャット機能を持たせる

**Architecture:** R2静的HTML（12万ページ） + Pages Functions API（チャット） + Claude API

**Tech Stack:** Node.js（生成スクリプト）, Cloudflare R2, Pages Functions, Claude API (claude-haiku-4-5)

---

## 既存データソース

| データ | 場所 | 内容 |
|--------|------|------|
| キャラ名・ストーリー | `jp{xx}.mascodex.com/jp/{code}/` | HTML（名前、紹介、ストーリー） |
| キャラ画像（3形態） | `img.mascodex.com/{code}_{01,02,03}.png` | AI生成ゆるキャラ画像 |
| 郵便番号→地名マッピング | `zip-tree.json` | 124,550件の郵便番号データ |

### 既存ページHTML構造

```html
<h2>{prefecture} {city} {area} の非公式ゆるキャラページ</h2>
<h1>{character_name}</h1>
<p>〒{postalCode}｜{prefecture} {city} {area}</p>
<div class="mascots">
  <img src="https://img.mascodex.com/{code}_01.png">
  <img src="https://img.mascodex.com/{code}_02.png">
  <img src="https://img.mascodex.com/{code}_03.png">
</div>
<div class="section"><h2>紹介</h2><p>{intro}</p></div>
<div class="section"><h2>ストーリー</h2><p>{story}</p></div>
```

### サブドメインパターン

```
郵便番号の先頭2桁 → サブドメイン
00-09 → jp00.mascodex.com
10-19 → jp01.mascodex.com
...
80-89 → jp08.mascodex.com
90-94 → jp09a.mascodex.com
95-99 → jp09b.mascodex.com
```

---

## 1. R2 静的キャラクターページ

### ファイル構造

```
R2バケット: mascodex-characters
├── {postalCode}/index.html    × 124,550件
├── sitemap-00.xml             (00xxx郵便番号)
├── sitemap-01.xml             (01xxx郵便番号)
├── ...
├── sitemap-99.xml
├── sitemap-index.xml          (全サイトマップのインデックス)
└── robots.txt
```

### ページデザイン

各ページは以下を含む:
- **SEOメタタグ**: title, description, og:image, canonical, JSON-LD構造化データ
- **キャラクタープロフィール**: 名前、地域、画像3形態、紹介、ストーリー
- **チャットウィジェット**: キャラクターとリアルタイム会話
- **ナビゲーション**: ゲームへのリンク、ショップへのリンク、近隣キャラへのリンク
- **レスポンシブデザイン**: モバイルファースト

### SEO対策

- `<title>`: `{name} - {area}のゆるキャラ | Mascodex`
- `<meta name="description">`: ストーリー冒頭120文字
- `<meta property="og:image">`: `img.mascodex.com/{code}_01.png`
- `<link rel="canonical">`: `https://characters.mascodex.com/{code}/`
- JSON-LD: LocalBusiness + Character schema

---

## 2. チャットAPI

### エンドポイント

```
POST /api/chat/{postalCode}
Body: { "message": "こんにちは！", "history": [...] }
Response: { "response": "...", "success": true }
```

### System Prompt テンプレート

```
あなたは「{name}」という{area}の非公式ゆるキャラです。

【プロフィール】
{intro_text}

【ストーリー】
{story_text}

【地域情報】
- 所在地: {prefecture} {city} {district}
- 郵便番号: 〒{postalCode}

あなたはこの地域を愛し、地元の魅力を知り尽くしています。
訪問者に地元の名所、グルメ、文化、季節の行事について
楽しく教えてください。

キャラクターの性格を反映した口調で話してください。
返答は2-3文の短い文章で答えてください。
一人称や語尾にキャラクターらしさを出してください。
```

### AIバックエンド

- **モデル**: claude-haiku-4-5（高速・低コスト）
- **会話履歴**: クライアント側で最新5往復を保持、送信
- **プロフィールデータ**: KVにキャッシュ（キー: `char_{postalCode}`）

---

## 3. 生成スクリプト

### 処理フロー

```
zip-tree.json から全124,550郵便番号を取得
    ↓
50件並列で jp{xx}.mascodex.com/jp/{code}/ をfetch
    ↓
HTMLパース → 名前・紹介・ストーリーを抽出
    ↓
新しいHTML（チャット付き）を生成
    ↓
R2にアップロード（S3互換API使用）
    ↓
サイトマップXML生成・アップロード
```

### 所要時間見込み

- fetch: 124,550件 ÷ 50並列 = ~2,500バッチ × 200ms = ~8分
- HTML生成: ~2分
- R2アップロード: ~15分
- **合計: 約25分**

---

## 4. インフラ設定

### 新規作成

| リソース | 名前 | 用途 |
|---------|------|------|
| R2バケット | `mascodex-characters` | 12万HTML + サイトマップ |
| カスタムドメイン | `characters.mascodex.com` | R2パブリックアクセス |
| KV namespace | 既存GAME_KV流用 | チャット用プロフィールキャッシュ |

### wrangler.toml追加

```toml
[[r2_buckets]]
binding = "CHAR_R2"
bucket_name = "mascodex-characters"
```

### 環境変数

- `ANTHROPIC_API_KEY`: Claude API キー（Pages Functions用）

---

## 5. コスト見込み

| 項目 | 月額 |
|------|------|
| R2ストレージ (~1.5GB) | 無料（10GB枠内） |
| R2読み取り | 無料（1000万回枠内） |
| Claude API (1日1000チャット想定) | ~$30 |
| **合計** | **~$30/月** |

---

## 6. 今後の拡張

- ゲーム（アメーバ・シティ）との連携: チャットからバトルへ
- キャラクター同士の会話機能
- 地域イベント情報のリアルタイム更新
- ユーザーがキャラに「お気に入り」をつける機能
