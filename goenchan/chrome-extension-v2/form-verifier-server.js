#!/usr/bin/env node
/**
 * form-verifier-server.js - フォーム検証サーバー (port 7788)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
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

  // プロンプトをファイルに書いてから渡す（引数長さ制限を回避）
  const promptFile = '/tmp/form-verify-prompt-' + Date.now() + '.md';
  const prompt = `フォーム自動入力Chrome拡張の修正タスク

対象サイト: ${url}
問題: フォームフィールドが正しく自動入力されなかった

手順:
1. ${dataFile} を読んでフィールド情報確認
   - fields: name/id/type/label/placeholder/ariaLabel/filled(入力済みか)
2. filled=false のフィールドを特定し、セマンティックタイプを判断
3. ${EXTENSION_DIR}/content.js の getSiteMappings() にマッピングを追加/更新
   挿入位置: 'www.yokoo.co.jp': の直前
   形式例:
   '${hostname}': {
     company_url: '${url}',
     last_name:       { selector: 'input[name="xxx"]', confidence: 100 },
     first_name:      { selector: 'input[name="xxx"]', confidence: 100 },
     last_name_kana:  { selector: 'input[name="xxx"]', confidence: 100 },
     first_name_kana: { selector: 'input[name="xxx"]', confidence: 100 },
     email:           { selector: 'input[name="xxx"]', confidence: 100 },
     email_confirm:   { selector: 'input[name="xxx"]', confidence: 100 },
     phone:           { selector: 'input[name="xxx"]', confidence: 100 },
     zipcode:         { selector: 'input[name="xxx"]', confidence: 100 },
     address:         { selector: 'input[name="xxx"]', confidence: 100 },
     company:         { selector: 'input[name="xxx"]', confidence: 100 },
     message:         { selector: 'textarea[name="xxx"]', confidence: 100 },
   },
   タイプ一覧: last_name/first_name/last_name_kana/first_name_kana/email/email_confirm/phone/phone1/phone2/phone3/zipcode/zipcode1/zipcode2/prefecture/city/address/address2/company/message/subject
4. git add -A && git commit -m "fix: フォームマッピング追加 - ${hostname}"
5. 修正内容を報告

When completely finished, run: openclaw system event --text "フォーム検証完了: ${hostname}" --mode now
`;

  fs.writeFileSync(promptFile, prompt, 'utf8');

  console.log('[Verifier] Launching Claude Code for: ' + url);
  console.log('[Verifier] Prompt file: ' + promptFile);

  const logFile = '/tmp/form-verify-claude-' + Date.now() + '.log';
  const logStream = fs.createWriteStream(logFile);

  // プロンプトをstdinから渡す
  const proc = spawn(CLAUDE_BIN, ['--dangerously-skip-permissions', '--print'], {
    cwd: EXTENSION_DIR,
    detached: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, HOME: process.env.HOME, PATH: process.env.PATH }
  });

  proc.stdout.pipe(logStream);
  proc.stderr.pipe(logStream);

  // プロンプトをstdinに書き込んで閉じる
  proc.stdin.write(prompt);
  proc.stdin.end();

  proc.on('exit', (code) => {
    console.log('[Verifier] Claude Code exited: ' + code + ', log: ' + logFile);
    try { fs.unlinkSync(promptFile); } catch(e) {}
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
        console.log('[Verifier] From: ' + url + ' fields: ' + fields.length + ' (unfilled: ' + fields.filter(f=>!f.filled).length + ')');
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
        let logFile = '';
        try { logFile = launchClaudeCode(url, DATA_FILE); } catch(e) { console.error('[Verifier] Launch error:', e.message); }
        res.writeHead(200, corsHeaders());
        res.end(JSON.stringify({ success: true, message: 'Claude Codeを起動しました。ログ: ' + logFile }));
      } catch(e) {
        console.error('[Verifier] Parse error:', e.message);
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
