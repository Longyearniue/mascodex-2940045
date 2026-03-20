#!/bin/bash
set -e
REPO="$HOME/mascodex-2940045"
DEPLOY="/tmp/mascodex-pages-deploy"

echo "🚀 mascodex deploy starting..."

# ── GUARD: デプロイ前必須要素チェック ────────────
echo ""
echo "🔒 デプロイ前ガード..."

# JS構文チェック
python3 -c "
import re, sys, subprocess, tempfile, os
with open('$REPO/index.html') as f:
    html = f.read()
scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
if scripts:
    with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as tf:
        tf.write(scripts[0]); tname = tf.name
    r = subprocess.run(['node', '--check', tname], capture_output=True)
    os.unlink(tname)
    if r.returncode != 0:
        print('❌ JS構文エラー:', r.stderr.decode()[:300]); sys.exit(1)
    print('  ✅ JS構文OK')
"

# 必須要素チェック関数
check_required() {
  local file="$1" keyword="$2" desc="$3"
  if ! grep -q "$keyword" "$file" 2>/dev/null; then
    echo "❌ 必須要素なし: $desc"; echo "   ($file に '$keyword' が見つかりません)"; exit 1
  fi
  echo "  ✅ $desc"
}
check_required "$REPO/index.html" "Happening Now"         "What's Happening Now セクション"
check_required "$REPO/index.html" "live-posts"            "ライブフィード要素"
check_required "$REPO/index.html" "social.mascodex.com/map" "Live Mapセクション"
check_required "$REPO/index.html" "loadLiveFeed"          "ライブフィード関数"
echo "✅ ガード通過"

# ── 0. デプロイ前スモークテスト（本番チェック）──
echo ""
echo "🔍 [1/4] デプロイ前チェック（現在の本番）..."
node "$REPO/scripts/smoke-test.mjs" https://mascodex.com
echo "✅ 本番 OK"

# ── 1. デプロイディレクトリ構築 ──────────────
echo ""
echo "📦 [2/4] デプロイパッケージ作成..."
rm -rf "$DEPLOY"
mkdir -p "$DEPLOY"

cp "$REPO/wrangler.toml"        "$DEPLOY/"
cp "$REPO/_routes.json"         "$DEPLOY/"
cp "$REPO/_headers"             "$DEPLOY/" 2>/dev/null || true

# functions/ (compose/ は含める — Workerへのプロキシ版)
cp -r "$REPO/functions"         "$DEPLOY/"

# js/ jp/ us/ in/ au/ kr/ feed/
for d in js jp us in au kr feed; do
  [ -d "$REPO/$d" ] && cp -r "$REPO/$d" "$DEPLOY/"
done

# index.html, shop-*.html 等
cp "$REPO"/*.html               "$DEPLOY/" 2>/dev/null || true
cp "$REPO"/*.js                 "$DEPLOY/" 2>/dev/null || true
cp "$REPO"/*.css                "$DEPLOY/" 2>/dev/null || true

echo "✅ パッケージ OK"

# ── 2. デプロイ ───────────────────────────────
echo ""
echo "🌐 [3/4] Cloudflare Pages デプロイ..."
cd "$DEPLOY"
wrangler pages deploy . \
  --project-name mascodex-2940045 \
  --branch main \
  --commit-dirty=true

echo "✅ デプロイ完了"

# ── 3. デプロイ後スモークテスト（反映待ち）──
echo ""
echo "⏳ [4/4] 反映待ち (8秒)..."
sleep 8

echo "🔍 デプロイ後チェック..."
node "$REPO/scripts/smoke-test.mjs" https://mascodex.com
echo ""
echo "🎉 デプロイ成功！全チェック通過"
