# AI CEO Clone Interface 手動デプロイガイド

## サーバー情報
- **IP**: 154.38.160.8
- **ユーザー**: root
- **パスワード**: Longyearbyen2686

## ステップ 1: SSH接続
```bash
ssh root@154.38.160.8
# パスワード: Longyearbyen2686
```

## ステップ 2: システム更新とソフトウェアインストール
```bash
# システム更新
apt update && apt upgrade -y

# 必要なソフトウェアのインストール
apt install -y python3 python3-pip nodejs npm nginx git curl

# Python Poetry のインストール
curl -sSL https://install.python-poetry.org | python3 -
export PATH="$HOME/.local/bin:$PATH"
```

## ステップ 3: プロジェクトのクローン
```bash
# プロジェクトディレクトリ作成
mkdir -p /var/www/ai-ceo-clone
cd /var/www/ai-ceo-clone

# GitHubからクローン
git clone https://github.com/Longyearniue/ai_clone_interface.git
cd ai_clone_interface

# 指定ブランチにチェックアウト
git checkout devin/1752146247-multi-ceo-profiles
```

## ステップ 4: バックエンドセットアップ
```bash
cd backend

# 依存関係インストール
poetry install || pip3 install -r requirements.txt

# 環境変数ファイル作成
cp .env.example .env

# .envファイル編集
cat > .env << 'EOF'
DATABASE_URL=sqlite:///./ai_clone.db
SECRET_KEY=ai-ceo-clone-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
OPENAI_API_KEY=your_openai_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
UPLOAD_DIRECTORY=uploads
MAX_FILE_SIZE=10485760
ALLOWED_ORIGINS=http://154.38.160.8:3000,http://154.38.160.8,http://localhost:3000
EOF

# データベース初期化
python3 -m app.db.init_db
```

## ステップ 5: フロントエンドセットアップ
```bash
cd ../frontend

# 依存関係インストール
npm install

# ビルド
npm run build
```

## ステップ 6: Nginx設定
```bash
# Nginx設定ファイル作成
cat > /etc/nginx/sites-available/ai-ceo-clone << 'EOF'
server {
    listen 80;
    server_name 154.38.160.8;

    # フロントエンド（静的ファイル）
    location / {
        root /var/www/ai-ceo-clone/ai_clone_interface/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # バックエンドAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# サイト有効化
ln -sf /etc/nginx/sites-available/ai-ceo-clone /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Nginx設定テストと再起動
nginx -t && systemctl restart nginx
```

## ステップ 7: バックエンドサービス設定
```bash
# Systemdサービスファイル作成
cat > /etc/systemd/system/ai-ceo-clone-backend.service << 'EOF'
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
EOF

# サービス有効化・開始
systemctl daemon-reload
systemctl enable ai-ceo-clone-backend
systemctl start ai-ceo-clone-backend
```

## ステップ 8: 動作確認
```bash
# サービス状態確認
systemctl status ai-ceo-clone-backend
systemctl status nginx

# ポート確認
netstat -tulpn | grep :8000
netstat -tulpn | grep :80

# ログ確認
journalctl -u ai-ceo-clone-backend -f
```

## アクセスURL
- **フロントエンド**: http://154.38.160.8
- **バックエンドAPI**: http://154.38.160.8/api
- **API docs**: http://154.38.160.8/api/docs

## 重要な設定

### APIキーの設定
`.env`ファイルで以下のAPIキーを設定してください：
```bash
nano /var/www/ai-ceo-clone/ai_clone_interface/backend/.env
```

```
OPENAI_API_KEY=実際のOpenAI APIキー
ELEVENLABS_API_KEY=実際のElevenLabs APIキー
```

### SSL証明書（オプション）
Let's Encryptを使用してHTTPS化：
```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d 154.38.160.8
```

## トラブルシューティング

### バックエンドが起動しない場合
```bash
# ログ確認
journalctl -u ai-ceo-clone-backend

# 手動起動テスト
cd /var/www/ai-ceo-clone/ai_clone_interface/backend
poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### フロントエンドが表示されない場合
```bash
# Nginx設定確認
nginx -t

# ファイル権限確認
ls -la /var/www/ai-ceo-clone/ai_clone_interface/frontend/dist/
```

### CORS エラーの場合
`.env`ファイルの`ALLOWED_ORIGINS`を確認・更新してサービスを再起動：
```bash
systemctl restart ai-ceo-clone-backend
```