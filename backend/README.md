# AI CEO Clone Backend

## 概要
AI CEO Clone InterfaceのバックエンドAPIサーバーです。FastAPIを使用して構築されており、CEOプロフィール管理、ドキュメント処理、AIチャット機能を提供します。

## 技術スタック
- **Framework**: FastAPI
- **Database**: SQLite (SQLAlchemy ORM)
- **Authentication**: JWT (JSON Web Tokens)
- **AI Integration**: OpenAI GPT-4, ElevenLabs
- **File Processing**: PDF, DOCX, TXT, MP3, WAV

## セットアップ

### 1. 依存関係のインストール
```bash
poetry install
```

### 2. 環境変数の設定
```bash
cp .env.example .env
```

`.env`ファイルを編集して以下を設定：
```env
# Database Configuration
DATABASE_URL=sqlite:///./ai_clone.db

# Security
SECRET_KEY=your-secret-key-here-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# ElevenLabs Configuration
ELEVENLABS_API_KEY=your-elevenlabs-api-key-here

# File Upload Configuration
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_DIR=./uploads

# CORS Configuration
ALLOWED_ORIGINS=["http://localhost:3000", "http://localhost:5173"]

# Development Configuration
DEBUG=true
ENVIRONMENT=development
```

### 3. データベースの初期化
```bash
poetry run python init_db.py
```

### 4. サーバーの起動
```bash
poetry run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## API ドキュメント
サーバー起動後、以下のURLでAPIドキュメントにアクセスできます：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 主要機能

### 認証システム
- JWTベースの認証
- ユーザー登録・ログイン
- パスワードハッシュ化

### CEO プロフィール管理
- プロフィールの作成・編集・削除
- 音声サンプルのアップロード
- マルチプロフィール対応

### ドキュメント処理
- PDF, DOCX, TXTファイルのアップロード
- AIによる自動要約生成
- ファイル検証とセキュリティ

### AI チャット機能
- OpenAI GPT-4によるCEO風回答生成
- ElevenLabsによる音声合成
- 会話履歴の管理

### インタビュー管理
- インタビュー内容の記録
- AI学習データとしての活用

## セキュリティ機能
- ファイルアップロード検証
- CORS設定
- APIキーの安全な管理
- データベースアクセス制限

## 開発者向け情報
- 遅延初期化パターンによる外部API最適化
- エラーハンドリングの強化
- ログ機能の実装
- テスト環境の準備