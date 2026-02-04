# Bulk Site Crawler Feature Design

**Date:** 2026-02-04
**Status:** Approved

## Overview

企業URLの一括クロール、お問合せフォーム検出、パターン学習システムを実装し、手動でのSITE_MAPPINGS追加作業を自動化する。

## Goals

- 複数の企業URLを一括でクロールしてお問合せフォームを検出
- フォームのパターンを自動認識してSITE_MAPPINGSに追加
- 手動作業を削減し、新規サイト対応を効率化

## Requirements Summary

### 入力方法
- 拡張機能のポップアップUIで複数URL入力（改行区切り）
- テキストエリアに直接ペースト

### 結果の処理
- 検出したパターンを自動的にcontent.jsのSITE_MAPPINGSに追加
- 更新されたcontent.js全体をダウンロード
- ユーザーが手動でファイルを置き換えて反映

### フォーム検出方法
- リンクテキスト検索（「お問い合わせ」「contact」等）
- トップページからお問合せページへのリンクを辿る
- シンプルで高速、80-90%のサイトで有効

### 実行環境
- Cloudflare Workerでバックグラウンド実行
- サーバー側で並列クロール（最大10並列）
- 同期レスポンスで結果を返す

## Architecture

### システム構成

**3つのコンポーネント:**

1. **拡張機能UI (popup.html/popup.js)**
   - 新しい「Bulk Crawler」タブ
   - テキストエリアでURL入力
   - 「Start Crawl」ボタン
   - 進捗表示
   - 結果の表示とダウンロード

2. **Cloudflare Worker (新エンドポイント: `/bulk-crawler`)**
   - URLリストを受け取る
   - 各URLを並列処理（最大10並列）
   - お問合せフォーム検出
   - パターン認識実行
   - 新しいSITE_MAPPINGS JSON生成
   - 更新されたcontent.js全体を返す

3. **パターン検出ロジック**
   - 既存の5パターン検出器を再利用
   - Worker側でTypeScriptで再実装
   - フィールド名解析とマッピング生成

### データフロー

```
ユーザー入力 (URLs)
  ↓
拡張機能 → POST /bulk-crawler
  ↓
Worker: 並列クロール (10並列)
  ↓
Worker: パターン検出 + マッピング生成
  ↓
Worker: 更新されたcontent.jsを生成
  ↓
拡張機能 ← レスポンス (新しいcontent.js)
  ↓
ユーザーがダウンロード & 手動で置き換え
  ↓
拡張機能を再読み込み
```

## Component Details

### 1. Cloudflare Worker Implementation

**新エンドポイント: `/bulk-crawler`**

**リクエスト:**
```typescript
POST /bulk-crawler
Content-Type: application/json

{
  "urls": [
    "https://example.com",
    "https://another-site.co.jp",
    ...
  ]
}
```

**処理フロー:**

1. **URL正規化** - httpをhttpsに、末尾スラッシュ削除
2. **並列クロール (最大10並列)** - Promise.allSettled()で実行
3. **各URLの処理:**
   - トップページのHTML取得
   - お問合せリンク検出（正規表現: `/お問い?合わせ|contact|問い合わせ|コンタクト/i`）
   - リンク先のHTML取得
   - フォームフィールド抽出（`<input>`, `<textarea>`, `<select>`のname属性）
   - パターン検出（5種類のdetector実行）
   - 最高スコアのパターンでマッピング生成
4. **結果の集約:**
   - 成功したサイトのマッピングを収集
   - 既存のSITE_MAPPINGSと結合
   - 新しいcontent.jsファイル全体を生成

**レスポンス:**
```typescript
{
  "success": true,
  "processed": 50,
  "found": 42,        // フォーム検出成功
  "failed": 8,        // フォーム未検出
  "newMappings": 42,  // 新規追加されたマッピング数
  "contentJs": "... 全content.jsコード ...",
  "errors": [
    { "url": "https://failed-site.com", "error": "Form not found" }
  ]
}
```

**タイムアウト対策:**
- Cloudflare Workerのタイムアウト: 50秒（無料プラン）
- 1サイトあたり最大5秒
- 最大10サイトまで同時処理

### 2. Extension UI Design

**popup.htmlの拡張:**

```html
<div class="section">
  <h3>🕷️ Bulk Site Crawler</h3>
  <p>複数サイトを一括クロールしてフォームパターンを検出</p>

  <textarea id="bulkUrls" rows="10" placeholder="https://example.com&#10;https://another-site.co.jp&#10;..."></textarea>

  <button id="startCrawl" class="btn-primary">Start Crawl</button>

  <div id="crawlProgress" style="display: none;">
    <p>進捗: <span id="crawlCount">0</span> / <span id="crawlTotal">0</span></p>
    <p>検出: <span id="foundCount">0</span> フォーム</p>
  </div>

  <div id="crawlResults" style="display: none;">
    <h4>✅ クロール完了</h4>
    <p>新規追加: <span id="newMappingsCount">0</span> サイト</p>
    <button id="downloadContentJs" class="btn-success">Download Updated content.js</button>
    <details>
      <summary>エラー (<span id="errorCount">0</span>)</summary>
      <ul id="errorList"></ul>
    </details>
  </div>
</div>
```

**popup.jsの処理:**

```javascript
document.getElementById('startCrawl').addEventListener('click', async () => {
  const urls = document.getElementById('bulkUrls').value
    .split('\n')
    .map(url => url.trim())
    .filter(url => url.length > 0);

  // 進捗表示
  showProgress(urls.length);

  // Workerにリクエスト
  const response = await fetch('https://your-worker.workers.dev/bulk-crawler', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls })
  });

  const result = await response.json();

  // 結果表示
  showResults(result);

  // content.jsダウンロード準備
  prepareDownload(result.contentJs);
});
```

### 3. Pattern Detection Logic (Worker-side)

**TypeScript実装:**

```typescript
// goenchan/worker/src/utils/patternDetector.ts

interface FormField {
  name: string;
  type: string;
  id?: string;
}

interface PatternResult {
  name: string;
  score: number;
}

// 5つの検出器を実装
export function detectWordPressCF7(fields: FormField[]): number {
  let count = 0;
  fields.forEach(f => {
    if (f.name.startsWith('your-')) count++;
  });
  return count >= 3 ? Math.min(100, 50 + count * 10) : 0;
}

export function detectJapaneseDirect(fields: FormField[]): number {
  const regex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
  let count = fields.filter(f => regex.test(f.name)).length;
  return count >= 3 ? Math.min(100, 50 + count * 10) : 0;
}

// ... 残り3つ (required-marks, mailform-cgi, split-fields)

export function detectPattern(fields: FormField[]): PatternResult | null {
  const patterns = [
    { name: 'wordpress-cf7', score: detectWordPressCF7(fields) },
    { name: 'japanese-direct', score: detectJapaneseDirect(fields) },
    { name: 'required-marks', score: detectRequiredMarks(fields) },
    { name: 'mailform-cgi', score: detectMailFormCGI(fields) },
    { name: 'split-fields', score: detectSplitFields(fields) }
  ];

  patterns.sort((a, b) => b.score - a.score);
  return patterns[0].score >= 50 ? patterns[0] : null;
}
```

**HTMLパース処理:**

```typescript
// お問合せリンク検出
const contactRegex = /お問い?合わせ|contact|問い合わせ|コンタクト|お問合せ/i;

export function findContactLink(html: string, baseUrl: string): string | null {
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]+>/g, ''); // タグを除去

    if (contactRegex.test(text)) {
      return new URL(href, baseUrl).toString();
    }
  }
  return null;
}

// フォームフィールド抽出
export function extractFormFields(html: string): FormField[] {
  const fields: FormField[] = [];
  const inputRegex = /<(input|textarea|select)[^>]*name=["']([^"']+)["'][^>]*>/gi;

  let match;
  while ((match = inputRegex.exec(html)) !== null) {
    fields.push({
      name: match[2],
      type: match[1].toLowerCase()
    });
  }

  return fields;
}
```

## Error Handling

### 想定されるエラーケース

1. **お問合せリンクが見つからない**
   - トップページに「contact」リンクなし
   - 対応: エラーリストに記録、スキップ

2. **フォームが見つからない**
   - お問合せページにフォームなし（メールアドレスのみ）
   - 対応: エラーリストに記録、スキップ

3. **パターン検出失敗**
   - 検出スコア < 50%
   - 対応: エラーリストに記録（"Pattern not detected"）

4. **タイムアウト**
   - サイトの応答が遅い（5秒超）
   - 対応: そのサイトをスキップ、エラー記録

5. **CORS/アクセス制限**
   - Worker側では発生しない（サーバーサイド実行）

## Data Structure

### SITE_MAPPINGSの更新

```javascript
// 既存のSITE_MAPPINGSに追加
'new-site.com/contact': {
  company_url: 'https://new-site.com/',
  name: { selector: 'input[name="your-name"]', confidence: 90 },
  email: { selector: 'input[name="your-email"]', confidence: 95 },
  // ... 自動検出されたマッピング
  _auto_detected: true,  // 自動検出フラグ
  _detected_at: '2026-02-04T...',  // 検出日時
  _pattern: 'wordpress-cf7'  // 使用されたパターン
}
```

## Implementation Tasks

### Worker実装 (5タスク)
1. パターン検出ロジック移植 (TypeScript)
2. HTMLパース処理 (お問合せリンク検出、フィールド抽出)
3. `/bulk-crawler`エンドポイント実装
4. SITE_MAPPINGS生成ロジック
5. エラーハンドリング

### 拡張機能UI (3タスク)
6. popup.html拡張 (Bulk Crawlerセクション追加)
7. クロール実行ロジック (popup.js)
8. 結果表示とダウンロード機能

### テスト (2タスク)
9. Worker単体テスト
10. E2Eテスト（実際のサイトでテスト）

**推定: 10タスク、実装時間2-3時間**

## Success Metrics

- お問合せフォーム検出率 > 80%
- パターン認識成功率 > 70%
- 1サイトあたりの処理時間 < 5秒
- タイムアウトエラー率 < 10%

## Future Enhancements (Out of Scope)

- サイトマップ解析のサポート
- AIクローラーの追加
- chrome.storageへの直接保存（コード更新不要）
- 検出結果のレビューUI
- 複数ユーザー間でのパターン共有

---

**Design approved for implementation.**
