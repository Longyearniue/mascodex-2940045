# Goenchan Founder Visibility Checker - Lovable用プロジェクト依頼書

## プロジェクト概要

企業ウェブサイトから創業者・CEOの情報を自動検出し、パーソナライズされたアウトリーチメールを生成する日本語対応のWebアプリケーションを作成してください。

## 技術スタック

- **フレームワーク**: React + TypeScript
- **スタイリング**: TailwindCSS
- **状態管理**: React Hooks (useState)
- **API通信**: Fetch API

## 環境変数

```
VITE_API_BASE_URL=http://localhost:8787
```

本番環境では実際のCloudflare Worker URLに変更します。

---

## API仕様

### 1. POST /api/founder-visibility

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
  "evidence": ["https://example.com/about", "https://example.com/message"],
  "checked_urls": ["https://example.com", "https://example.com/about", "..."],
  "hit_keywords": ["代表挨拶", "CEO", "Founder"]
}
```

### 2. POST /api/outreach/generate

**リクエスト:**
```json
{
  "companyName": "株式会社サンプル",
  "url": "https://example.com",
  "questions": "創業のきっかけは何ですか？"
}
```

**レスポンス（eligible=true の場合）:**
```json
{
  "eligible": true,
  "subject": "ライブ配信出演のご相談（Goenchan）",
  "body": "株式会社サンプルの皆様\n\nお世話になります...",
  "evidence": ["https://example.com/about"]
}
```

**レスポンス（eligible=false の場合）:**
```json
{
  "eligible": false,
  "reason": "founder_visibility_false"
}
```

---

## UI/UX要件

### 全体レイアウト

- **背景色**: グレー50 (bg-gray-50)
- **最大幅**: 4xl (max-w-4xl)
- **中央揃え**: mx-auto
- **パディング**: py-8 px-4

### ヘッダー

```
タイトル: "Goenchan - Founder Visibility Checker"
サブタイトル: "企業サイトから創業者・CEOの情報を検出し、アウトリーチメールを生成します"
```

- タイトル: text-3xl font-bold text-gray-900 mb-2
- サブタイトル: text-gray-600

---

## メインコンテンツ

### 1. 入力フォーム

白い背景カード (bg-white rounded-lg shadow-md p-6 mb-6) 内に3つの入力フィールド：

**① 会社名**
- ラベル: "会社名"
- プレースホルダー: "例: 株式会社サンプル"
- タイプ: text input
- スタイル: w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500

**② 会社URL**
- ラベル: "会社URL"
- プレースホルダー: "https://example.com"
- タイプ: url input
- スタイル: 同上

**③ 質問内容**
- ラベル: "質問内容"
- プレースホルダー: "例: 創業のきっかけは？"
- タイプ: textarea (rows={3})
- スタイル: 同上

**ボタン群（横並び、gap-4）:**

**判定するボタン:**
- テキスト: "判定する" (通常時) / "処理中..." (ローディング時)
- スタイル: flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors
- 機能: URLの創業者可視性をチェック

**文面を生成ボタン:**
- テキスト: "文面を生成" (通常時) / "生成中..." (ローディング時)
- スタイル: flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors
- **重要**: `founder_visibility === true` の場合のみ有効化
- 機能: アウトリーチメールを生成

---

### 2. エラー表示エリア

エラーがある場合のみ表示:

```jsx
{error && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
    <p className="text-red-800">{error}</p>
  </div>
)}
```

---

### 3. 判定結果表示エリア

`visibilityResult` が存在する場合のみ表示:

**カードレイアウト** (bg-white rounded-lg shadow-md p-6 mb-6)

**タイトル:** "判定結果" (text-xl font-semibold mb-4)

**① Founder Visibility表示:**
```
ラベル: "Founder Visibility: "
値: TRUE (text-green-600) または FALSE (text-red-600)
スタイル: font-bold
```

**② 証拠URL（evidence.length > 0 の場合）:**
- 見出し: "証拠URL:" (text-sm font-medium text-gray-700 mb-2)
- リスト: 箇条書き (list-disc list-inside space-y-1)
- 各URL: 青色リンク (text-blue-600 hover:underline)
- target="_blank" rel="noopener noreferrer"

**③ 検出キーワード（hit_keywords.length > 0 の場合）:**
- 見出し: "検出キーワード:" (text-sm font-medium text-gray-700 mb-2)
- タグ表示: flex flex-wrap gap-2
- 各キーワード: bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm

**④ 確認済みURL（折りたたみ式）:**
- トグルボタン: "確認済みURL ({checked_urls.length}件) を表示" / "確認済みURLを隠す"
- スタイル: text-sm text-gray-600 hover:text-gray-900 underline
- 展開時: 箇条書きリスト (mt-2 list-disc list-inside space-y-1 text-sm text-gray-600)

---

### 4. メール文面表示エリア

`outreachResult` が存在する場合のみ表示:

**カードレイアウト** (bg-white rounded-lg shadow-md p-6)

#### eligible === true の場合:

**タイトル:** "生成された文面" (text-xl font-semibold mb-4)

**① 件名セクション:**
```jsx
<div className="mb-4">
  <div className="flex justify-between items-center mb-2">
    <h3 className="text-sm font-medium text-gray-700">件名:</h3>
    <button
      onClick={() => copyToClipboard(outreachResult.subject)}
      className="text-sm text-blue-600 hover:text-blue-800"
    >
      コピー
    </button>
  </div>
  <div className="bg-gray-50 p-3 rounded border border-gray-200">
    {outreachResult.subject}
  </div>
</div>
```

**② 本文セクション:**
```jsx
<div>
  <div className="flex justify-between items-center mb-2">
    <h3 className="text-sm font-medium text-gray-700">本文:</h3>
    <button
      onClick={() => copyToClipboard(outreachResult.body)}
      className="text-sm text-blue-600 hover:text-blue-800"
    >
      コピー
    </button>
  </div>
  <div className="bg-gray-50 p-3 rounded border border-gray-200 whitespace-pre-wrap">
    {outreachResult.body}
  </div>
</div>
```

**重要:** `whitespace-pre-wrap` を使用して改行を保持

#### eligible === false の場合:

```jsx
<div className="text-center py-8">
  <p className="text-gray-600">
    この企業は対象外です（Founder Visibilityが検出されませんでした）
  </p>
</div>
```

---

## 状態管理

以下の状態を管理してください:

```typescript
const [companyName, setCompanyName] = useState('');
const [url, setUrl] = useState('');
const [questions, setQuestions] = useState('');
const [loading, setLoading] = useState(false);
const [visibilityResult, setVisibilityResult] = useState<FounderVisibilityResponse | null>(null);
const [outreachResult, setOutreachResult] = useState<OutreachGenerateResponse | null>(null);
const [error, setError] = useState<string | null>(null);
const [showCheckedUrls, setShowCheckedUrls] = useState(false);
```

---

## 関数の実装

### 1. handleCheck（判定するボタン）

```typescript
const handleCheck = async () => {
  if (!url) {
    setError('URLを入力してください');
    return;
  }

  setLoading(true);
  setError(null);
  setVisibilityResult(null);
  setOutreachResult(null);
  setShowCheckedUrls(false);

  try {
    const result = await checkFounderVisibility(url);
    setVisibilityResult(result);
  } catch (err: any) {
    setError(err.message || 'エラーが発生しました');
  } finally {
    setLoading(false);
  }
};
```

### 2. handleGenerate（文面を生成ボタン）

```typescript
const handleGenerate = async () => {
  if (!companyName || !url || !questions) {
    setError('会社名、URL、質問をすべて入力してください');
    return;
  }

  setLoading(true);
  setError(null);
  setOutreachResult(null);

  try {
    const result = await generateOutreach(companyName, url, questions);
    setOutreachResult(result);
  } catch (err: any) {
    setError(err.message || 'エラーが発生しました');
  } finally {
    setLoading(false);
  }
};
```

### 3. copyToClipboard（コピー機能）

```typescript
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  alert('コピーしました');
};
```

---

## API クライアント関数

### types.ts

```typescript
export interface FounderVisibilityResponse {
  url: string;
  founder_visibility: boolean;
  evidence: string[];
  checked_urls: string[];
  hit_keywords: string[];
}

export interface OutreachGenerateResponse {
  eligible: boolean;
  subject?: string;
  body?: string;
  evidence?: string[];
  reason?: string;
}
```

### api.ts

```typescript
import type { FounderVisibilityResponse, OutreachGenerateResponse } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

export async function checkFounderVisibility(url: string): Promise<FounderVisibilityResponse> {
  const response = await fetch(`${API_BASE_URL}/api/founder-visibility`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export async function generateOutreach(
  companyName: string,
  url: string,
  questions: string
): Promise<OutreachGenerateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/outreach/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ companyName, url, questions }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
```

---

## デザインガイドライン

### カラーパレット
- **プライマリ**: Blue-600 (#2563eb)
- **セカンダリ**: Green-600 (#16a34a)
- **背景**: Gray-50 (#f9fafb)
- **カード背景**: White (#ffffff)
- **テキスト**: Gray-900 (#111827)
- **補助テキスト**: Gray-600 (#4b5563)
- **エラー**: Red-800 (#991b1b) on Red-50 (#fef2f2)

### スペーシング
- カード間マージン: mb-6
- カード内パディング: p-6
- 入力フィールド間: space-y-4
- ボタン間: gap-4

### レスポンシブ対応
- モバイル: 全幅表示、適切なパディング
- デスクトップ: max-w-4xl で中央配置

---

## 重要な実装ポイント

### ✅ 必須要件

1. **文面を生成ボタンの有効化条件:**
   ```typescript
   disabled={loading || !visibilityResult?.founder_visibility}
   ```
   - `loading === true` の間は無効
   - `visibilityResult` が存在しない場合は無効
   - `founder_visibility === false` の場合は無効

2. **メール本文の改行保持:**
   ```jsx
   <div className="... whitespace-pre-wrap">
     {outreachResult.body}
   </div>
   ```

3. **エラーハンドリング:**
   - URLが空の場合: "URLを入力してください"
   - 全フィールドが空の場合: "会社名、URL、質問をすべて入力してください"
   - API エラーの場合: エラーメッセージを表示

4. **コピー機能:**
   - `navigator.clipboard.writeText()` を使用
   - コピー成功時: `alert('コピーしました')`

5. **ローディング状態:**
   - ボタンテキストを "処理中..." / "生成中..." に変更
   - ボタンを無効化 (`disabled={loading}`)

---

## テストシナリオ

### シナリオ1: 正常フロー（創業者情報あり）
1. 会社名に "株式会社テスト" を入力
2. URLに "https://www.ycombinator.com" を入力
3. 質問に "創業のきっかけは？" を入力
4. 「判定する」をクリック
5. → `founder_visibility: true` が表示される
6. 「文面を生成」ボタンが有効になる
7. 「文面を生成」をクリック
8. → 件名と本文が表示される
9. 「コピー」ボタンをクリック
10. → "コピーしました" アラートが表示される

### シナリオ2: 創業者情報なし
1. URLに "https://example.com" を入力
2. 「判定する」をクリック
3. → `founder_visibility: false` が表示される
4. 「文面を生成」ボタンが無効のまま

### シナリオ3: エラーハンドリング
1. URLを空のまま「判定する」をクリック
2. → "URLを入力してください" エラーが表示される

---

## 納品物

以下のファイル構成で納品してください:

```
src/
├── App.tsx          # メインコンポーネント
├── main.tsx         # エントリーポイント
├── index.css        # TailwindCSS設定
├── api.ts           # API クライアント
├── types.ts         # TypeScript型定義
└── vite-env.d.ts    # Vite環境変数型定義
```

---

## その他の注意事項

- すべてのテキストは日本語で表示
- レスポンシブ対応を確保
- アクセシビリティを考慮（適切なaria-label、フォーカス管理）
- TypeScriptの型安全性を保つ
- エラー境界の実装（オプション）

---

以上の仕様に従って、完全に動作するReactアプリケーションを作成してください。
