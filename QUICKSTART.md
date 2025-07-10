# AI CEO Clone Interface - Quick Start Guide

## 🚀 5分で始める

### 1. 環境準備
```bash
# 必要なツールのインストール
# Python 3.9+, Node.js 16+, Poetry

# Poetryのインストール
curl -sSL https://install.python-poetry.org | python3 -
```

### 2. 自動セットアップ
```bash
# デプロイスクリプトを実行
./deploy.sh dev
```

### 3. 手動セットアップ（推奨）

#### バックエンド設定
```bash
cd backend
poetry install
cp .env.example .env
# .envファイルを編集してAPIキーを設定
poetry run python init_db.py
poetry run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### フロントエンド設定
```bash
cd frontend
npm install
npm run dev
```

### 4. Docker での実行
```bash
# 環境変数を設定
export OPENAI_API_KEY="your-openai-api-key"
export ELEVENLABS_API_KEY="your-elevenlabs-api-key"

# Docker Composeで起動
docker-compose up --build
```

## 🔑 必要なAPIキー

### OpenAI API
1. https://platform.openai.com/ にアクセス
2. アカウント作成・ログイン
3. APIキーを生成
4. `backend/.env`に設定

### ElevenLabs API
1. https://elevenlabs.io/ にアクセス
2. アカウント作成・ログイン
3. APIキーを取得
4. `backend/.env`に設定

## 📱 アクセス方法

- **フロントエンド**: http://localhost:3000
- **バックエンドAPI**: http://localhost:8000
- **API ドキュメント**: http://localhost:8000/docs

## 🎯 最初のステップ

1. フロントエンドにアクセス
2. アカウントを作成
3. CEOプロフィールを作成
4. 音声サンプルをアップロード
5. 会社資料をアップロード
6. AIチャットを開始

## 🔧 トラブルシューティング

### よくある問題

**Q: Poetryが見つからない**
```bash
curl -sSL https://install.python-poetry.org | python3 -
```

**Q: Node.jsが見つからない**
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS
brew install node
```

**Q: ポートが使用中**
```bash
# ポートを確認
lsof -i :3000
lsof -i :8000

# プロセスを終了
kill -9 <PID>
```

**Q: APIキーエラー**
- `.env`ファイルが正しく設定されているか確認
- APIキーが有効か確認
- クレジットが残っているか確認

## 📞 サポート

問題が発生した場合は以下を確認してください：

1. ログの確認
2. 環境変数の設定
3. 依存関係のインストール
4. ポートの競合

詳細なドキュメントは `README.md` を参照してください。