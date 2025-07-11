# AI CEO Clone Interface - 154.38.160.8 デプロイメント完了パッケージ

## 📋 サーバー情報
- **IP**: 154.38.160.8
- **ユーザー**: root
- **パスワード**: Longyearbyen2686
- **状態**: SSH接続可能、HTTP未設定（デプロイ後にアクセス可能）

## 🚀 クイックデプロイ（推奨）

### 1. SSH接続
```bash
ssh root@154.38.160.8
# パスワード: Longyearbyen2686
```

### 2. ワンライナーデプロイ実行
以下のコマンドをコピー&ペーストして実行：

```bash
apt update && apt upgrade -y && \
apt install -y python3 python3-pip nodejs npm nginx git curl && \
curl -sSL https://install.python-poetry.org | python3 - && \
export PATH="$HOME/.local/bin:$PATH" && \
mkdir -p /var/www/ai-ceo-clone && \
cd /var/www/ai-ceo-clone && \
git clone https://github.com/Longyearniue/ai_clone_interface.git && \
cd ai_clone_interface && \
git checkout devin/1752146247-multi-ceo-profiles && \
cd backend && \
(poetry install || pip3 install -r requirements.txt) && \
cat > .env << 'ENVEOF'
DATABASE_URL=sqlite:///./ai_clone.db
SECRET_KEY=ai-ceo-clone-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
OPENAI_API_KEY=your_openai_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
UPLOAD_DIRECTORY=uploads
MAX_FILE_SIZE=10485760
ALLOWED_ORIGINS=http://154.38.160.8:3000,http://154.38.160.8,http://localhost:3000
ENVEOF
(python3 -m app.db.init_db || echo "Database init skipped") && \
cd ../frontend && \
npm install && \
npm run build && \
cat > /etc/nginx/sites-available/ai-ceo-clone << 'NGINXEOF'
server {
    listen 80;
    server_name 154.38.160.8;

    location / {
        root /var/www/ai-ceo-clone/ai_clone_interface/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINXEOF
ln -sf /etc/nginx/sites-available/ai-ceo-clone /etc/nginx/sites-enabled/ && \
rm -f /etc/nginx/sites-enabled/default && \
nginx -t && \
systemctl restart nginx && \
cat > /etc/systemd/system/ai-ceo-clone-backend.service << 'SERVICEEOF'
[Unit]
Description=AI CEO Clone Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/ai-ceo-clone/ai_clone_interface/backend
Environment=PATH=/root/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/root/.local/bin/poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
SERVICEEOF
systemctl daemon-reload && \
systemctl enable ai-ceo-clone-backend && \
systemctl start ai-ceo-clone-backend && \
echo "=== デプロイ完了 ===" && \
echo "フロントエンド: http://154.38.160.8" && \
echo "バックエンドAPI: http://154.38.160.8/api" && \
echo "API docs: http://154.38.160.8/api/docs"
```

## 🔑 APIキー設定（必須）

デプロイ完了後、APIキーを設定：

```bash
nano /var/www/ai-ceo-clone/ai_clone_interface/backend/.env
```

以下を実際のAPIキーに変更：
```
OPENAI_API_KEY=実際のOpenAI APIキー
ELEVENLABS_API_KEY=実際のElevenLabs APIキー
```

設定後、バックエンドを再起動：
```bash
systemctl restart ai-ceo-clone-backend
```

## 🌐 アクセスURL

デプロイ完了後にアクセス可能：
- **メインアプリ**: http://154.38.160.8
- **API**: http://154.38.160.8/api
- **APIドキュメント**: http://154.38.160.8/api/docs

## 📁 作成されたファイル

このディレクトリには以下のファイルが作成されています：

1. **README.md** - プロジェクト概要
2. **manual_deployment_guide.md** - 詳細な手動デプロイ手順
3. **one_liner_deploy.sh** - ワンライナーデプロイスクリプト
4. **deploy_script.py** - Python自動化スクリプト
5. **ssh_connect.sh** - SSH接続テストスクリプト
6. **deploy_to_server.sh** - 自動デプロイスクリプト
7. **DEPLOYMENT_SUMMARY.md** - このファイル

## 🛠️ システム構成

### フロントエンド
- **技術**: React.js + Vite + TailwindCSS
- **場所**: `/var/www/ai-ceo-clone/ai_clone_interface/frontend/`
- **ビルド出力**: `dist/`
- **Webサーバー**: Nginx

### バックエンド
- **技術**: FastAPI (Python)
- **場所**: `/var/www/ai-ceo-clone/ai_clone_interface/backend/`
- **サービス**: `ai-ceo-clone-backend.service`
- **ポート**: 8000
- **プロセス管理**: systemd

### データベース
- **技術**: SQLite
- **場所**: `/var/www/ai-ceo-clone/ai_clone_interface/backend/ai_clone.db`

## 🔧 トラブルシューティング

### サービス状態確認
```bash
systemctl status ai-ceo-clone-backend
systemctl status nginx
```

### ログ確認
```bash
journalctl -u ai-ceo-clone-backend -f
journalctl -u nginx -f
```

### 手動起動テスト
```bash
cd /var/www/ai-ceo-clone/ai_clone_interface/backend
poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Nginx設定テスト
```bash
nginx -t
```

## 🔄 更新手順

コードを更新する場合：

```bash
cd /var/www/ai-ceo-clone/ai_clone_interface
git pull
cd frontend
npm run build
systemctl restart ai-ceo-clone-backend
systemctl restart nginx
```

## 🎯 主要機能

- ✅ マルチCEOプロフィール管理
- ✅ 会社資料アップロード・管理 (PDF/DOCX/TXT)
- ✅ 音声サンプルアップロード・管理 (MP3/WAV)
- ✅ インタビュー管理
- ✅ AIチャット機能
- ✅ 月次更新・編集機能
- ✅ 遅延初期化パターンによる外部API依存関係の最適化
- ✅ CORS設定の適切な構成

## 📞 サポート

- **開発者**: Devin AI (@Longyearniue)
- **GitHub**: https://github.com/Longyearniue/ai_clone_interface
- **ブランチ**: devin/1752146247-multi-ceo-profiles
- **Devin実行URL**: https://app.devin.ai/sessions/fed77b84f5ed40a8be69e56c7aa20e99

---

## 📝 次のアクション

1. SSH接続してワンライナーデプロイを実行
2. APIキーを設定
3. http://154.38.160.8 にアクセスして動作確認
4. 必要に応じてSSL証明書設定

**🎉 デプロイ完了後、AI CEO Clone Interfaceが154.38.160.8で利用可能になります！**