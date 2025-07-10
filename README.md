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

## プロジェクト構造

```
ai-ceo-clone/
├── backend/                    # FastAPI バックエンド
│   ├── app/
│   │   ├── api/               # API エンドポイント
│   │   ├── core/              # 設定とセキュリティ
│   │   ├── db/                # データベース設定
│   │   ├── models/            # データベースモデル
│   │   ├── services/          # ビジネスロジック
│   │   └── main.py           # FastAPIアプリ
│   ├── requirements.txt
│   ├── pyproject.toml        # Poetry設定
│   └── .env.example
├── frontend/                   # React フロントエンド
│   ├── src/
│   │   ├── components/        # React コンポーネント
│   │   ├── pages/            # ページコンポーネント
│   │   ├── services/         # API クライアント
│   │   ├── hooks/            # カスタムフック
│   │   └── styles/           # CSS/TailwindCSS
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── docs/                      # ドキュメント
└── docker-compose.yml         # デプロイメント設定
```

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
poetry run python app/db/init_db.py
poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000
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
SECRET_KEY=your_secret_key
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