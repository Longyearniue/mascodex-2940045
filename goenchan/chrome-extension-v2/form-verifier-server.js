#!/usr/bin/env node
/**
 * form-verifier-server.js - フォーム検証サーバー (port 7788)
 */
const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = 7788;
const EXTENSION_DIR = __dirname;
const DATA_FILE = '/tmp/form-verify-latest.json';
const CLAUDE_BIN = process.env.CLAUDE_BIN || '/opt/homebrew/bin/claude';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}

function launchClaudeCode(url, dataFile) {
  let hostname = 'unknown';
  try { hostname = new URL(url).hostname; } catch(e) {}

  const prompt = `フォーム自動入力Chrome拡張の修正タスク

対象サイト: ${url}
問題: フォームフィールドが正しく自動入力されなかった

## ステップ1: データ確認
${dataFile} を読んでフィールド情報を確認する
- fields[].name, id, type, label, placeholder, ariaLabel, filled(入力済みか)
- filled=false のフィールドが未入力の対象

## ステップ2: 問題の診断
以下の観点で問題を特定する:
A) サイトマッピングが存在しない → content.js に追加
B) フィールドの値が間違っている（例: 姓欄に氏名全体が入る）→ popup.jsのsaveProfile分割ロジック確認
C) カタカナに変換されていない → content.jsのkana変換確認
D) フィールドが認識されていない → content.jsのdetectFieldType確認

## ステップ3: 修正

### A. マッピング追加（最優先）
${EXTENSION_DIR}/content.js の getSiteMappings() に追加
挿入位置: 'www.yokoo.co.jp': の直前

形式例:
  '${hostname}': {
    company_url: '${url}',
    last_name:        { selector: 'input[name="xxx"]', confidence: 100 },
    first_name:       { selector: 'input[name="xxx"]', confidence: 100 },
    last_name_kana:   { selector: 'input[name="xxx"]', confidence: 100 },
    first_name_kana:  { selector: 'input[name="xxx"]', confidence: 100 },
    email:            { selector: 'input[name="xxx"]', confidence: 100 },
    email_confirm:    { selector: 'input[name="xxx"]', confidence: 100 },
    phone1:           { selector: 'input[name="xxx"]', confidence: 100 },
    phone2:           { selector: 'input[name="xxx"]', confidence: 100 },
    phone3:           { selector: 'input[name="xxx"]', confidence: 100 },
    zipcode:          { selector: 'input[name="xxx"]', confidence: 100 },
    prefecture:       { selector: 'select[name="xxx"]', confidence: 100 },
    city:             { selector: 'input[name="xxx"]', confidence: 100 },
    address:          { selector: 'input[name="xxx"]', confidence: 100 },
    company:          { selector: 'input[name="xxx"]', confidence: 100 },
    message:          { selector: 'textarea[name="xxx"]', confidence: 100 },
  },

フィールドタイプ: last_name/first_name/last_name_kana/first_name_kana/full_name/
email/email_confirm/phone/phone1/phone2/phone3/zipcode/zipcode1/zipcode2/
prefecture/city/address/address2/company/message/subject

### B. ロジックバグの修正（必要な場合）
${EXTENSION_DIR}/popup.js または ${EXTENSION_DIR}/content.js の該当箇所を修正する
例: 姓欄に氏名全体が入る → popup.js の saveProfile() の姓名分割ロジック

## ステップ4: 構文チェック
node --check ${EXTENSION_DIR}/content.js && node --check ${EXTENSION_DIR}/popup.js

## ステップ5: コミット
git -C ${EXTENSION_DIR} add -A && git -C ${EXTENSION_DIR} commit -m "fix: フォーム自動入力修正 - ${hostname}"

## ステップ6: 報告
何をどのファイルのどの部分に修正したか報告する

When completely finished, run: openclaw system event --text "フォーム検証完了: ${hostname} の修正をコミットしました" --mode now
`;

  console.log('[Verifier] Launching Claude Code for: ' + url);
  const logFile = '/tmp/form-verify-claude-' + Date.now() + '.log';
  const logStream = fs.createWriteStream(logFile);

  const proc = spawn(CLAUDE_BIN, ['--dangerously-skip-permissions', '--print'], {
    cwd: EXTENSION_DIR,
    detached: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env }
  });

  proc.stdout.pipe(logStream);
  proc.stderr.pipe(logStream);
  proc.stdin.write(prompt);
  proc.stdin.end();

  proc.on('exit', (code) => {
    console.log('[Verifier] Claude Code exited: ' + code + ', log: ' + logFile);
  });

  proc.unref();
  return logFile;
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders()); res.end(); return;
  }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>🔍 フォーム検証サーバー ✅ 稼働中 (port ' + PORT + ')</h1><p>Chrome拡張の「フォーム検証」ボタンを押してください</p>');
    return;
  }

  if (req.method === 'POST' && req.url === '/verify-form') {
    let body = '';
    req.on('data', c => { body += c.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const url = (data.data && data.data.url) ? data.data.url : (data.url || 'unknown');
        const fields = (data.data && data.data.fields) ? data.data.fields : (data.fields || []);
        const unfilled = fields.filter(f => !f.filled).length;
        console.log('[Verifier] From: ' + url + ' fields: ' + fields.length + ' (unfilled: ' + unfilled + ')');
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
        let logFile = '';
        try { logFile = launchClaudeCode(url, DATA_FILE); } catch(e) { console.error('[Verifier] Launch error:', e.message); }
        res.writeHead(200, corsHeaders());
        res.end(JSON.stringify({ success: true, message: 'Claude Codeを起動しました。ログ: ' + logFile }));
      } catch(e) {
        res.writeHead(400, corsHeaders());
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404, corsHeaders());
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('\n🔍 フォーム検証サーバー起動 (port ' + PORT + ')');
  console.log('   Claude Code: ' + CLAUDE_BIN + '\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('❌ ポート ' + PORT + ' 使用中: lsof -ti:' + PORT + ' | xargs kill');
  } else { console.error(err); }
  process.exit(1);
});
