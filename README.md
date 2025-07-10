# AI CEO Clone Interface - Complete Deployment Package

## 概要
社長の音声・人格・知識をAIで再現し、自然な会話を実現するためのウェブベースのインターフェースシステムです。

## システム構成
- **フロントエンド**: React.js + Vite + TailwindCSS
- **バックエンド**: FastAPI (Python)
- **データベース**: SQLite
- **AI API**: OpenAI GPT-4, ElevenLabs

## 主要機能
- マルチCEOプロフィール管理
- 会社資料アップロード・管理 (PDF/DOCX/TXT)
- 音声サンプルアップロード・管理 (MP3/WAV)
- インタビュー管理
- AIチャット機能
- 月次更新・編集機能

## デプロイメント手順

### 1. 環境要件
- Python 3.9+
- Node.js 16+
- Poetry (Python依存関係管理)
- npm/yarn

### 2. バックエンドセットアップ
```bash
cd backend
poetry install
cp .env.example .env
# .envファイルを編集してAPIキーを設定
poetry run python init_db.py
poetry run uvicorn main:app --host 0.0.0.0 --port 8000
```

### 3. フロントエンドセットアップ
```bash
cd frontend
npm install
npm run build
npm run preview  # または本番サーバーにデプロイ
```

### 4. 環境変数設定
バックエンドの`.env`ファイルに以下を設定:
```
OPENAI_API_KEY=your_openai_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
DATABASE_URL=sqlite:///./ai_clone.db
```

フロントエンドの`src/services/api.ts`でバックエンドURLを設定:
```typescript
const API_BASE_URL = 'http://your-backend-url:8000/api'
```

## 技術的改善点
- 遅延初期化パターンによる外部API依存関係の最適化
- CORS設定の適切な構成
- マルチプロフィール対応のデータベース設計
- エラーハンドリングの強化

## セキュリティ考慮事項
- APIキーの適切な管理
- ファイルアップロードの検証
- CORS設定の適切な構成
- データベースアクセスの制限

## サポート
- 月次更新機能により定期的なプロフィール更新が可能
- 各CEOプロフィールは独立して管理
- データの追加・削除・編集機能完備

## 開発者情報
- 開発者: Devin AI
- GitHub: @Longyearniue
- Devin実行URL: https://app.devin.ai/sessions/fed77b84f5ed40a8be69e56c7aa20e99

## ファイル構造
```
ai-ceo-clone/
├── backend/
│   ├── pyproject.toml
│   ├── .env.example
│   ├── config.py
│   ├── database.py
│   ├── auth.py
│   ├── schemas.py
│   ├── ai_service.py
│   ├── main.py
│   ├── init_db.py
│   └── routers/
│       ├── users.py
│       ├── ceo_profiles.py
│       ├── documents.py
│       ├── interviews.py
│       └── chat.py
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── services/
│       │   └── api.ts
│       ├── store/
│       │   └── auth.ts
│       ├── components/
│       │   └── Layout.tsx
│       └── pages/
│           ├── Login.tsx
│           ├── CEOProfiles.tsx
│           ├── Documents.tsx
│           ├── Interviews.tsx
│           └── Chat.tsx
└── README.md
```

## API エンドポイント

### 認証
- `POST /api/users/register` - ユーザー登録
- `POST /api/users/login` - ログイン
- `GET /api/users/me` - 現在のユーザー情報

### CEO プロフィール
- `GET /api/ceo-profiles/` - プロフィール一覧
- `POST /api/ceo-profiles/` - プロフィール作成
- `GET /api/ceo-profiles/{id}` - プロフィール詳細
- `PUT /api/ceo-profiles/{id}` - プロフィール更新
- `DELETE /api/ceo-profiles/{id}` - プロフィール削除
- `POST /api/ceo-profiles/{id}/voice-sample` - 音声サンプルアップロード

### ドキュメント
- `GET /api/documents/{profile_id}` - ドキュメント一覧
- `POST /api/documents/{profile_id}` - ドキュメントアップロード
- `GET /api/documents/{profile_id}/{document_id}` - ドキュメント詳細
- `DELETE /api/documents/{profile_id}/{document_id}` - ドキュメント削除

### インタビュー
- `GET /api/interviews/{profile_id}` - インタビュー一覧
- `POST /api/interviews/{profile_id}` - インタビュー作成
- `GET /api/interviews/{profile_id}/{interview_id}` - インタビュー詳細
- `PUT /api/interviews/{profile_id}/{interview_id}` - インタビュー更新
- `DELETE /api/interviews/{profile_id}/{interview_id}` - インタビュー削除

### チャット
- `POST /api/chat/start` - チャットセッション開始
- `POST /api/chat/continue` - チャット継続
- `GET /api/chat/sessions` - チャットセッション一覧
- `GET /api/chat/sessions/{session_id}/messages` - メッセージ履歴
- `DELETE /api/chat/sessions/{session_id}` - セッション削除