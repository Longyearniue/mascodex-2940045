# 🚀 AI CEO Clone Interface - 今すぐデプロイ！

## 📋 接続情報（確認済み）
- **サーバー**: 154.38.160.8
- **ユーザー**: root  
- **パスワード**: Longyearbyen2686

---

## ⚡ 5分でデプロイ完了！

### 1️⃣ SSH接続
```bash
ssh root@154.38.160.8
```
パスワード入力: `Longyearbyen2686`

### 2️⃣ 以下をコピー&ペーストして実行

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
(python3 -m app.db.init_db || echo "Database init skipped") && \
cd ../frontend && \
npm install && \
npm run build && \
cat > /etc/nginx/sites-available/ai-ceo-clone << 'EOF'
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
EOF
ln -sf /etc/nginx/sites-available/ai-ceo-clone /etc/nginx/sites-enabled/ && \
rm -f /etc/nginx/sites-enabled/default && \
nginx -t && \
systemctl restart nginx && \
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
systemctl daemon-reload && \
systemctl enable ai-ceo-clone-backend && \
systemctl start ai-ceo-clone-backend && \
echo "🎉 デプロイ完了!" && \
echo "📱 アクセス: http://154.38.160.8" && \
echo "🔗 API: http://154.38.160.8/api" && \
echo "📚 ドキュメント: http://154.38.160.8/api/docs" && \
systemctl status ai-ceo-clone-backend --no-pager
```

### 3️⃣ APIキー設定（重要！）
デプロイ完了後、以下でAPIキーを設定：
```bash
nano /var/www/ai-ceo-clone/ai_clone_interface/backend/.env
```

以下の行を実際のAPIキーに変更：
- `OPENAI_API_KEY=your_openai_api_key_here`
- `ELEVENLABS_API_KEY=your_elevenlabs_api_key_here`

保存後、サービス再起動：
```bash
systemctl restart ai-ceo-clone-backend
```

---

## 🌐 アクセスURL
**デプロイ完了後すぐにアクセス可能！**

- 🖥️ **メインアプリ**: http://154.38.160.8
- 🔌 **API**: http://154.38.160.8/api  
- 📖 **APIドキュメント**: http://154.38.160.8/api/docs

## 🔧 状態確認コマンド
```bash
systemctl status ai-ceo-clone-backend
systemctl status nginx
journalctl -u ai-ceo-clone-backend -f
```

---

## 🎯 実装済み機能
- ✅ マルチCEOプロフィール管理
- ✅ 会社資料アップロード（PDF/DOCX/TXT）
- ✅ 音声サンプル管理（MP3/WAV）  
- ✅ AIチャット機能
- ✅ インタビュー管理
- ✅ 月次更新機能

**🚀 準備完了！SSH接続してコマンドを実行するだけです！**