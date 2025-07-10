# AI CEO Clone Frontend

## 概要
AI CEO Clone Interfaceのフロントエンドアプリケーションです。React.js + TypeScript + TailwindCSSを使用して構築されており、モダンなUI/UXを提供します。

## 技術スタック
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **State Management**: Zustand
- **Data Fetching**: React Query
- **Routing**: React Router DOM
- **UI Components**: Lucide React Icons
- **Forms**: React Hook Form
- **Notifications**: React Hot Toast

## セットアップ

### 1. 依存関係のインストール
```bash
npm install
```

### 2. 開発サーバーの起動
```bash
npm run dev
```

### 3. 本番ビルド
```bash
npm run build
npm run preview
```

## 環境設定

### API URL設定
`src/services/api.ts`でバックエンドURLを設定：
```typescript
const API_BASE_URL = 'http://localhost:8000/api'
```

### 開発環境でのプロキシ設定
`vite.config.ts`でプロキシが設定済み：
```typescript
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
}
```

## 主要機能

### 認証システム
- ユーザー登録・ログイン
- JWTトークン管理
- 認証状態の永続化

### CEO プロフィール管理
- プロフィールの作成・編集・削除
- 音声サンプルのアップロード
- プロフィール一覧表示

### ドキュメント管理
- ファイルアップロード機能
- ドキュメント一覧表示
- ファイル削除機能

### インタビュー管理
- インタビュー内容の記録
- インタビュー一覧表示
- 編集・削除機能

### AI チャット機能
- リアルタイムチャット
- 音声合成機能
- 会話履歴の管理

## コンポーネント構造

```
src/
├── components/
│   └── Layout.tsx          # メインレイアウト
├── pages/
│   ├── Login.tsx           # ログインページ
│   ├── CEOProfiles.tsx     # CEOプロフィール管理
│   ├── Documents.tsx       # ドキュメント管理
│   ├── Interviews.tsx      # インタビュー管理
│   └── Chat.tsx           # AIチャット
├── services/
│   └── api.ts             # API通信層
├── store/
│   └── auth.ts            # 認証状態管理
└── App.tsx                # メインアプリケーション
```

## 開発ガイドライン

### 状態管理
- Zustandを使用したグローバル状態管理
- React Queryによるサーバー状態管理
- ローカル状態はuseState/useReducerを使用

### スタイリング
- TailwindCSSを使用
- カスタムコンポーネントクラスを定義
- レスポンシブデザイン対応

### エラーハンドリング
- React Queryのエラー処理
- Toast通知によるユーザーフィードバック
- フォームバリデーション

### パフォーマンス
- React Queryによるキャッシュ
- 遅延読み込み
- メモ化による最適化

## デプロイメント

### 本番環境での設定
1. 環境変数の設定
2. API URLの変更
3. ビルドとデプロイ

```bash
npm run build
# ビルドされたdist/フォルダをWebサーバーにデプロイ
```

### Docker対応
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

## 開発者向け情報
- TypeScriptによる型安全性
- ESLint + Prettierによるコード品質管理
- ホットリロード対応
- 開発者ツール対応