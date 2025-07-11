#!/bin/bash
# AI CEO Clone Interface ワンライナーデプロイスクリプト
# SSH接続後にコピー&ペーストして実行

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
echo "API docs: http://154.38.160.8/api/docs" && \
echo "" && \
echo "サービス状態:" && \
systemctl status ai-ceo-clone-backend --no-pager && \
systemctl status nginx --no-pager && \
echo "" && \
echo "重要: .envファイルでAPIキーを設定してください:" && \
echo "nano /var/www/ai-ceo-clone/ai_clone_interface/backend/.env"