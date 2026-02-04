# プロンプト管理機能 実装完了

## ✅ 実装内容

文面生成のプロンプトをサイト上で編集可能にする機能を実装しました。

### 主な変更点

1. **Supabaseクライアントのセットアップ**
   - ファイル: `src/supabaseClient.ts`
   - Supabaseクライアントの初期化と型定義

2. **Supabaseテーブル作成SQL**
   - ファイル: `SETUP_SUPABASE.md`
   - `prompts`テーブルのスキーマ定義
   - デフォルトプロンプトの挿入

3. **Supabase Edge Function**
   - ファイル: `supabase/functions/generate-sales-letter/index.ts`
   - Lovable AI Gateway (Gemini) を使用した文面生成
   - プロンプトのDBからの取得と変数置換

4. **プロンプト管理画面**
   - ファイル: `src/pages/PromptManagement.tsx`
   - プロンプトの一覧表示、作成、編集、削除
   - 変数管理機能

5. **API関数の追加**
   - ファイル: `src/api.ts`
   - `generateSalesLetter`関数の追加
   - Supabase Edge Function呼び出し

6. **ルーティングの設定**
   - ファイル: `src/main.tsx`
   - React Routerの設定
   - `/` - ホーム画面
   - `/admin/prompts` - プロンプト管理画面

7. **型定義の追加**
   - ファイル: `src/types.ts`
   - `SalesLetterResponse`インターフェース

8. **ホーム画面の分離**
   - ファイル: `src/pages/Home.tsx`
   - 既存のApp.tsxをHomepage.tsxに移動
   - プロンプト管理画面へのリンク追加

## 📦 セットアップ手順

### 1. 依存関係のインストール

```bash
cd /Users/taiichiwada/mascodex-2940045/goenchan/frontend
npm install @supabase/supabase-js react-router-dom
npm install --save-dev @types/react-router-dom
```

### 2. 環境変数の設定

`.env`ファイルを作成し、以下を設定:

```env
VITE_API_BASE_URL=http://localhost:8787
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Supabaseのセットアップ

詳細は `SETUP_SUPABASE.md` を参照してください。

#### 3.1 テーブルの作成

Supabase SQLエディタで以下を実行:

```sql
-- Create prompts table
CREATE TABLE prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_prompts_name ON prompts(name);
CREATE INDEX idx_prompts_active ON prompts(is_active);

-- Insert default prompt
INSERT INTO prompts (name, content, variables) VALUES (
  'sales_letter_default',
  E'あなたはプロフェッショナルな営業メール作成の専門家です。\n\n以下の情報を基に、効果的な営業メールを作成してください：\n\n会社名: {{company_name}}\n会社情報:\n{{company_info}}\n\n追加の質問への回答:\n{{questions}}\n\nメールの要件：\n1. 丁寧でプロフェッショナルな日本語\n2. 相手企業の課題や強みを理解していることを示す\n3. 具体的な価値提案を含める\n4. 行動喚起（CTA）を含める\n5. 適度な長さ（300〜500文字程度）\n\nフォーマット：\n件名: [魅力的な件名]\n\n本文:\n[メール本文]',
  '["company_name", "company_info", "questions"]'::jsonb
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_prompts_updated_at
  BEFORE UPDATE ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### 3.2 Edge Functionのデプロイ

Supabase CLIを使用:

```bash
# Supabase CLIのインストール（未インストールの場合）
npm install -g supabase

# Supabaseプロジェクトにログイン
supabase login

# プロジェクトにリンク
supabase link --project-ref your-project-ref

# Edge Functionをデプロイ
supabase functions deploy generate-sales-letter
```

または、Supabase Dashboardから手動でデプロイ:
1. Supabase Dashboard → Edge Functions
2. 「New Function」をクリック
3. 関数名: `generate-sales-letter`
4. `supabase/functions/generate-sales-letter/index.ts`の内容をコピー&ペースト
5. 「Deploy」をクリック

#### 3.3 環境変数の設定（Supabase側）

Edge Functionで使用する環境変数を設定:

Supabase Dashboard → Project Settings → Edge Functions → Environment Variables

```
LOVABLE_AI_API_KEY=your-lovable-ai-api-key
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

## 🎯 使い方

### プロンプト管理画面へのアクセス

1. ブラウザで `http://localhost:5173/` を開く
2. 右上の「プロンプト管理」ボタンをクリック
3. または直接 `http://localhost:5173/admin/prompts` にアクセス

### プロンプトの作成

1. 「新規作成」ボタンをクリック
2. プロンプト名を入力（例: `sales_letter_v2`）
3. プロンプト内容を入力
4. 変数を追加/削除
5. 「保存」をクリック

### プロンプトの編集

1. 左側のリストから編集したいプロンプトを選択
2. 「編集」ボタンをクリック
3. 内容を変更
4. 「保存」をクリック

### 文面生成API の使用例

```typescript
import { generateSalesLetter } from './api';

const result = await generateSalesLetter(
  '株式会社サンプル',  // companyName
  '会社情報...',        // companyInfo
  '質問への回答...',    // questions
  'sales_letter_default' // promptName (optional)
);

console.log(result.subject); // 件名
console.log(result.body);    // 本文
```

## 📁 ファイル構成

```
frontend/
├── src/
│   ├── api.ts                        # API関数（generateSalesLetter追加）
│   ├── types.ts                      # 型定義（SalesLetterResponse追加）
│   ├── supabaseClient.ts            # Supabaseクライアント（新規）
│   ├── main.tsx                      # ルーティング設定（更新）
│   └── pages/
│       ├── Home.tsx                  # ホーム画面（新規）
│       └── PromptManagement.tsx     # プロンプト管理画面（新規）
├── supabase/
│   └── functions/
│       └── generate-sales-letter/
│           └── index.ts              # Edge Function（新規）
├── .env.example                      # 環境変数テンプレート（更新）
├── SETUP_SUPABASE.md                # Supabaseセットアップ手順（新規）
└── PROMPT_MANAGEMENT_README.md      # このファイル
```

## 🔧 主な機能

### プロンプト管理

- ✅ プロンプトの一覧表示
- ✅ プロンプトの作成
- ✅ プロンプトの編集
- ✅ プロンプトの削除
- ✅ プロンプトの有効/無効切り替え
- ✅ 変数の管理（追加/削除/編集）

### 文面生成

- ✅ Supabase Edge Functionによる生成
- ✅ Lovable AI Gateway (Gemini) の使用
- ✅ プロンプトのDBからの動的取得
- ✅ 変数の置換（{{company_name}}など）
- ✅ 件名と本文の自動解析

## 🚀 次のステップ

1. **認証の追加（推奨）**
   - プロンプト管理画面に認証を追加
   - Supabase Authの設定
   - RLSポリシーの適用

2. **プロンプトバージョン管理**
   - プロンプトの履歴管理
   - バージョン間の比較機能

3. **テンプレート機能**
   - よく使うプロンプトのテンプレート化
   - テンプレートライブラリの作成

4. **A/Bテスト機能**
   - 複数プロンプトの効果測定
   - 自動的に最適なプロンプトを選択

5. **プロンプト分析**
   - 使用頻度の追跡
   - 成功率の測定

## 🐛 トラブルシューティング

### Edge Functionのエラー

**エラー:** `Prompt not found: sales_letter_default`

**解決策:**
1. Supabase SQLエディタでプロンプトが作成されているか確認
2. プロンプト名が正しいか確認
3. `is_active`が`true`になっているか確認

### CORS エラー

**エラー:** `Access-Control-Allow-Origin` エラー

**解決策:**
1. Edge Functionの`corsHeaders`が正しく設定されているか確認
2. Supabase DashboardでCORS設定を確認

### 環境変数エラー

**エラー:** `Missing Supabase environment variables`

**解決策:**
1. `.env`ファイルが存在するか確認
2. `VITE_SUPABASE_URL`と`VITE_SUPABASE_ANON_KEY`が設定されているか確認
3. 開発サーバーを再起動

## 📞 サポート

問題が発生した場合は、以下を確認してください:

1. `SETUP_SUPABASE.md`のセットアップ手順
2. Supabase Dashboardのログ（Edge Functions → Logs）
3. ブラウザのコンソールエラー
4. ネットワークタブでAPIリクエストの状態

---

**実装完了日:** 2026-01-30
**バージョン:** 1.0.0
