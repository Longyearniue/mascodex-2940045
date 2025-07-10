#!/bin/bash
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
