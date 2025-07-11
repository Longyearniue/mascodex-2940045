#!/usr/bin/env python3
"""
AI CEO Clone Interface デプロイスクリプト
154.38.160.8サーバーへの自動デプロイ
"""

import os
import sys
import subprocess
import time

def run_command(command, description):
    """コマンドを実行して結果を表示"""
    print(f"\n{'='*50}")
    print(f"実行中: {description}")
    print(f"コマンド: {command}")
    print('='*50)
    
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        if result.stdout:
            print("出力:")
            print(result.stdout)
        if result.stderr:
            print("エラー:")
            print(result.stderr)
        return result.returncode == 0
    except Exception as e:
        print(f"エラーが発生しました: {e}")
        return False

def create_ssh_script():
    """SSH接続スクリプトを作成"""
    ssh_script = '''#!/bin/bash
SERVER="154.38.160.8"
USER="root"
PASSWORD="Longyearbyen2686"

# SSH接続のテスト
echo "=== SSH接続テスト ==="
ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 $USER@$SERVER "echo 'SSH接続成功!'; whoami; pwd"

# システム情報の確認
echo "=== システム情報確認 ==="
ssh -o StrictHostKeyChecking=no $USER@$SERVER "
    echo 'OS情報:';
    cat /etc/os-release;
    echo 'Python バージョン:';
    python3 --version 2>/dev/null || echo 'Python3 not found';
    echo 'Node.js バージョン:';
    node --version 2>/dev/null || echo 'Node.js not found';
    echo 'nginx状態:';
    systemctl status nginx 2>/dev/null || echo 'nginx not installed';
"
'''
    
    with open('ssh_connect.sh', 'w') as f:
        f.write(ssh_script)
    
    os.chmod('ssh_connect.sh', 0o755)
    print("SSH接続スクリプトを作成しました: ssh_connect.sh")

def prepare_deployment_files():
    """デプロイ用ファイルを準備"""
    print("\n=== デプロイファイル準備 ===")
    
    # GitHubリポジトリからクローン
    if not os.path.exists('ai_clone_interface'):
        if run_command(
            "git clone https://github.com/Longyearniue/ai_clone_interface.git",
            "GitHubリポジトリクローン"
        ):
            print("リポジトリクローン成功")
        else:
            print("リポジトリクローンに失敗しました")
            return False
    
    # 指定ブランチにチェックアウト
    os.chdir('ai_clone_interface')
    if run_command(
        "git checkout devin/1752146247-multi-ceo-profiles",
        "ブランチチェックアウト"
    ):
        print("ブランチチェックアウト成功")
    else:
        print("ブランチチェックアウトに失敗しました")
    
    os.chdir('..')
    return True

def create_deployment_script():
    """サーバーデプロイスクリプトを作成"""
    deploy_script = '''#!/bin/bash
SERVER="154.38.160.8"
USER="root"
PASSWORD="Longyearbyen2686"

echo "=== AI CEO Clone Interface サーバーデプロイ ==="

# サーバーに接続してデプロイ実行
ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
# システム更新
apt update && apt upgrade -y

# 必要なソフトウェアのインストール
apt install -y python3 python3-pip nodejs npm nginx git curl

# Python Poetry のインストール
curl -sSL https://install.python-poetry.org | python3 -

# プロジェクトディレクトリ作成
mkdir -p /var/www/ai-ceo-clone
cd /var/www/ai-ceo-clone

# プロジェクトクローン（既存の場合は更新）
if [ -d "ai_clone_interface" ]; then
    cd ai_clone_interface
    git pull
else
    git clone https://github.com/Longyearniue/ai_clone_interface.git
    cd ai_clone_interface
fi

# 指定ブランチにチェックアウト
git checkout devin/1752146247-multi-ceo-profiles

# バックエンドセットアップ
cd backend
export PATH="$HOME/.local/bin:$PATH"
poetry install || pip3 install -r requirements.txt

# .envファイル作成
cp .env.example .env
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

# データベース初期化
python3 -m app.db.init_db || echo "Database init failed, continuing..."

# フロントエンドセットアップ
cd ../frontend
npm install
npm run build

# Nginxの設定
cat > /etc/nginx/sites-available/ai-ceo-clone << 'NGINXEOF'
server {
    listen 80;
    server_name 154.38.160.8;

    # フロントエンド（静的ファイル）
    location / {
        root /var/www/ai-ceo-clone/ai_clone_interface/frontend/dist;
        try_files \$uri \$uri/ /index.html;
    }

    # バックエンドAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINXEOF

# Nginxサイト有効化
ln -sf /etc/nginx/sites-available/ai-ceo-clone /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# バックエンドサービス作成
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

# サービス有効化・開始
systemctl daemon-reload
systemctl enable ai-ceo-clone-backend
systemctl start ai-ceo-clone-backend

echo "=== デプロイ完了 ==="
echo "フロントエンド: http://154.38.160.8"
echo "バックエンドAPI: http://154.38.160.8/api"
echo "サービス状態確認: systemctl status ai-ceo-clone-backend"
EOF
'''
    
    with open('deploy_to_server.sh', 'w') as f:
        f.write(deploy_script)
    
    os.chmod('deploy_to_server.sh', 0o755)
    print("デプロイスクリプトを作成しました: deploy_to_server.sh")

def main():
    """メイン実行関数"""
    print("AI CEO Clone Interface デプロイスクリプト")
    print("サーバー: 154.38.160.8")
    print("-" * 50)
    
    # SSH接続スクリプト作成
    create_ssh_script()
    
    # デプロイスクリプト作成
    create_deployment_script()
    
    print("\n=== 次のステップ ===")
    print("1. SSH接続テスト: ./ssh_connect.sh")
    print("2. サーバーデプロイ: ./deploy_to_server.sh")
    print("3. アクセス確認: http://154.38.160.8")
    print("\n注意: .envファイルでAPIキーを設定してください")

if __name__ == "__main__":
    main()