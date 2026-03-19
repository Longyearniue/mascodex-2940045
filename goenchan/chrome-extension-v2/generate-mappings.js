#!/usr/bin/env node
/**
 * generate-mappings.js
 * 使い方: node generate-mappings.js [CSVファイル] [同時接続数]
 * 例: node generate-mappings.js ~/Downloads/makers_1000.csv 5
 *
 * Phase 1: CSVからコンタクトページをクロール
 * Phase 2: Claude Codeがフォーム解析してcontent.jsにマッピングを追加
 */

const fs   = require('fs');
const https = require('https');
const http  = require('http');
const path  = require('path');
const { URL } = require('url');
const { spawn } = require('child_process');

// ─── 設定 ───────────────────────────────────────────────────────────────
const CSV_FILE      = process.argv[2] || path.join(process.env.HOME, 'Downloads/makers_1000.csv');
const CONCURRENCY   = parseInt(process.argv[3] || '8');
const EXTENSION_DIR = __dirname;
const CLAUDE_BIN    = process.env.CLAUDE_BIN || '/opt/homebrew/bin/claude';
const BATCH_SIZE    = 50;   // 1回のClaude Codeで処理するサイト数
const TIMEOUT_MS    = 8000;

const CONTACT_PATHS = [
  '/contact','/contact/','/contact.html','/contact.php','/inquiry','/inquiry/',
  '/inquiry.html','/inquiry.php','/otoiawase','/otoiawase/','/otoiawase.html',
  '/toiawase','/form','/form/','/mailform','/mailform/','/support','/support/'
];
const CONTACT_RE = /contact|inquiry|otoiawase|toiawase|form|mail|お問|問合|support/i;
const SKIP_RE    = /\.(css|js|png|jpg|gif|svg|ico|woff|ttf|pdf|zip)(\?|$)/i;

// ─── Phase 1: クロール ────────────────────────────────────────────────
function fetchUrl(urlStr, timeout = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    try {
      const u   = new URL(urlStr);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.get(urlStr, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FormCrawler/1.0)' },
        timeout
      }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchUrl(new URL(res.headers.location, urlStr).href, timeout)
            .then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
        let data = '';
        res.on('data', c => { data += c; if (data.length > 300000) res.destroy(); });
        res.on('end',  () => resolve(data));
        res.on('error', reject);
      });
      req.on('error', reject);
      setTimeout(() => { req.destroy(); reject(new Error('Timeout')); }, timeout);
    } catch(e) { reject(e); }
  });
}

async function findContactUrl(baseUrl) {
  try {
    const html = await fetchUrl(baseUrl, 6000);
    const scored = [...html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map(([, href, raw]) => {
        try {
          const full = new URL(href, baseUrl).href;
          const t = raw.replace(/<[^>]+>/g, '').trim();
          let s = 0;
          if (CONTACT_RE.test(full)) s += 10;
          if (CONTACT_RE.test(t))    s += 20;
          if (/^お問い?合わせ$|^contact$/i.test(t)) s += 25;
          if (SKIP_RE.test(full)) s = 0;
          return { url: full, score: s };
        } catch { return { url: '', score: 0 }; }
      })
      .filter(l => l.score > 0 && l.url)
      .sort((a, b) => b.score - a.score);
    if (scored[0]) return scored[0].url;
  } catch {}

  const origin = new URL(baseUrl).origin;
  for (const p of CONTACT_PATHS) {
    try { await fetchUrl(origin + p, 3000); return origin + p; } catch {}
  }
  return null;
}

function extractFormFields(html) {
  return [...html.matchAll(/<(?:input|textarea|select)[^>]*>/gi)]
    .map(([tag]) => {
      const name  = (tag.match(/name=["']([^"']+)["']/)  || [])[1] || '';
      const id    = (tag.match(/id=["']([^"']+)["']/)    || [])[1] || '';
      const type  = (tag.match(/type=["']([^"']+)["']/)  || [])[1] ||
                    (tag.includes('<textarea') ? 'textarea' : tag.includes('<select') ? 'select' : 'text');
      const ph    = (tag.match(/placeholder=["']([^"']+)["']/) || [])[1] || '';
      return { name, id, type, placeholder: ph };
    })
    .filter(f => {
      if (!f.name && !f.id) return false;
      if (['hidden','submit','button','image','reset'].includes(f.type)) return false;
      if (f.name === 'g-recaptcha-response') return false;
      return true;
    })
    .map(f => {
      // ラベル取得（HTML全体が必要なので外から差し込む）
      return f;
    });
}

function enrichLabels(fields, html) {
  return fields.map(f => {
    let label = '';
    if (f.id) {
      const m = html.match(new RegExp(
        '<label[^>]+for=["\']' + f.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\'][^>]*>([^<]+)<'));
      if (m) label = m[1].trim();
    }
    if (!label && f.name) {
      const idx = html.indexOf('name="' + f.name + '"');
      if (idx > 0) {
        const before = html.slice(Math.max(0, idx - 200), idx);
        const m = before.match(/<(?:label|th|dt|span|p)[^>]*>([^<]{2,30})<\/(?:label|th|dt|span|p)>\s*$/);
        if (m) label = m[1].trim();
      }
    }
    return { ...f, label };
  });
}

async function processUrl(company, url) {
  try {
    const contactUrl = await findContactUrl(url);
    if (!contactUrl) return { company, url, contactUrl: null, fields: [] };
    const html   = await fetchUrl(contactUrl, 8000);
    const fields = enrichLabels(extractFormFields(html), html);
    return { company, url, contactUrl, fields, fieldCount: fields.length };
  } catch(e) {
    return { company, url, contactUrl: null, fields: [], error: e.message };
  }
}

async function phase1Crawl() {
  console.log('\n📂 Phase 1: クロール開始');
  console.log('   CSV:', CSV_FILE);

  const csv  = fs.readFileSync(CSV_FILE, 'utf8');
  const rows = csv.split('\n').slice(1).filter(l => l.trim());

  // 列判定（url列 or 出典URL列）
  const header = csv.split('\n')[0].toLowerCase();
  const urlCol = header.includes('url') ? header.split(',').findIndex(h => h.includes('url')) : 1;

  const entries = rows.map(line => {
    const p = line.split(',');
    const url = (p[urlCol] || '').trim().replace(/^"(.*)"$/, '$1');
    return { company: (p[0] || '').trim(), url };
  }).filter(e => e.url.startsWith('http'));

  // ドメインでユニーク化
  const seen = new Map();
  for (const e of entries) {
    try { const d = new URL(e.url).hostname; if (!seen.has(d)) seen.set(d, e); } catch {}
  }
  const uniq = [...seen.values()];
  console.log(`   総URL: ${entries.length} → ユニークドメイン: ${uniq.length}`);
  console.log(`   同時接続数: ${CONCURRENCY}\n`);

  const results = [];
  let done = 0;
  const start = Date.now();

  for (let i = 0; i < uniq.length; i += CONCURRENCY) {
    const chunk = uniq.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(chunk.map(e => processUrl(e.company, e.url)));
    for (const r of settled) if (r.status === 'fulfilled') results.push(r.value);
    done += chunk.length;
    const found   = results.filter(r => r.contactUrl && r.fields.length > 0).length;
    const elapsed = ((Date.now() - start) / 1000).toFixed(0);
    process.stdout.write(`\r   ⏳ ${done}/${uniq.length} | フォームあり: ${found}件 | ${elapsed}s`);
  }

  const withForm  = results.filter(r => r.contactUrl && r.fields.length > 0);
  const noContact = results.filter(r => !r.contactUrl);
  console.log('\n');
  console.log(`   ✅ フォームあり: ${withForm.length}件`);
  console.log(`   ❌ コンタクトページ未発見: ${noContact.length}件`);
  console.log(`   ⚠️  フォームなし: ${results.length - withForm.length - noContact.length}件`);

  return results;
}

// ─── Phase 2: マッピング生成 ───────────────────────────────────────────
async function runClaudeBatch(batch, batchNum, total) {
  const siteList = batch.map(r => {
    const hostname = new URL(r.contactUrl).hostname;
    const flist = r.fields.map(f =>
      `  name=${JSON.stringify(f.name)} id=${JSON.stringify(f.id)} type=${f.type} label=${JSON.stringify(f.label)} placeholder=${JSON.stringify(f.placeholder)}`
    ).join('\n');
    return `\n### ${hostname}\ncontactUrl: ${r.contactUrl}\nfields:\n${flist}`;
  }).join('\n---');

  const prompt = `Chrome拡張フォーム自動入力のマッピング一括生成タスク

## 目的
以下の${batch.length}サイトのフォームフィールド情報を読んで、
${EXTENSION_DIR}/content.js の getSiteMappings() にマッピングを追加する。

## 挿入位置
'www.yokoo.co.jp': の直前に全マッピングをまとめて挿入する。

## マッピング形式
  'hostname': {
    company_url: 'https://hostname/',
    last_name:        { selector: 'input[name="xxx"]', confidence: 100 },
    first_name:       { selector: 'input[name="xxx"]', confidence: 100 },
    last_name_kana:   { selector: 'input[name="xxx"]', confidence: 100 },
    first_name_kana:  { selector: 'input[name="xxx"]', confidence: 100 },
    email:            { selector: 'input[name="xxx"]', confidence: 100 },
    email_confirm:    { selector: 'input[name="xxx"]', confidence: 100 },
    phone:            { selector: 'input[name="xxx"]', confidence: 100 },
    phone1:           { selector: 'input[name="xxx"]', confidence: 100 },
    phone2:           { selector: 'input[name="xxx"]', confidence: 100 },
    phone3:           { selector: 'input[name="xxx"]', confidence: 100 },
    zipcode:          { selector: 'input[name="xxx"]', confidence: 100 },
    zipcode1:         { selector: 'input[name="xxx"]', confidence: 100 },
    zipcode2:         { selector: 'input[name="xxx"]', confidence: 100 },
    prefecture:       { selector: 'select[name="xxx"]', confidence: 100 },
    city:             { selector: 'input[name="xxx"]', confidence: 100 },
    address:          { selector: 'input[name="xxx"]', confidence: 100 },
    company:          { selector: 'input[name="xxx"]', confidence: 100 },
    message:          { selector: 'textarea[name="xxx"]', confidence: 100 },
    subject:          { selector: 'input[name="xxx"]', confidence: 100 },
  },

## フィールド判定ルール
- name/id/label/placeholderからフィールドの意味を推定する
- 姓(last_name): sei, family, last, 姓, name-1, name1 など
- 名(first_name): mei, given, first, 名, name-2, name2 など
- カナ: kana, furi, フリガナ, ふりがな など
- メール確認: confirm, check, re_mail, retype など
- 電話3分割: tel1/tel2/tel3, phone1/phone2/phone3 など
- 郵便番号2分割: zip1/zip2, postal1/postal2 など
- フィールドが存在しない場合はそのキーを省略する
- 既にマッピングが存在するサイトは追加不要

## 対象サイト
${siteList}

## 作業
1. 上記フィールド一覧からマッピングを生成（存在するフィールドのみ）
2. ${EXTENSION_DIR}/content.js の 'www.yokoo.co.jp': の直前にまとめて挿入
3. node --check ${EXTENSION_DIR}/content.js
4. git -C ${EXTENSION_DIR} add -A && git -C ${EXTENSION_DIR} commit -m "feat: 事前クロールマッピング batch${batchNum}/${total} (${batch.length}件)"

When done: openclaw system event --text "マッピング batch${batchNum}/${total} 完了: ${batch.length}件追加" --mode now
`;

  return new Promise((resolve, reject) => {
    const log = `/tmp/mapping-batch${batchNum}.log`;
    const ls  = fs.createWriteStream(log);
    console.log(`\n🤖 Claude Code batch ${batchNum}/${total} (${batch.length}件) → ${log}`);

    const proc = spawn(CLAUDE_BIN, ['--dangerously-skip-permissions', '--print'], {
      cwd: EXTENSION_DIR,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    proc.stdout.pipe(ls);
    proc.stderr.pipe(ls);
    proc.stdin.write(prompt);
    proc.stdin.end();
    proc.on('exit', code => { console.log(`   ✅ batch ${batchNum} 完了 (exit ${code})`); resolve(code); });
    proc.on('error', reject);
  });
}

async function phase2Generate(results) {
  console.log('\n📝 Phase 2: マッピング生成');

  // 既存マッピングを確認
  const contentJs = fs.readFileSync(EXTENSION_DIR + '/content.js', 'utf8');
  const existing  = new Set([...contentJs.matchAll(/'([a-z0-9.-]+\.[a-z]{2,})':\s*\{/g)].map(m => m[1]));
  console.log(`   既存マッピング: ${existing.size}件`);

  const targets = results.filter(r => {
    if (!r.contactUrl || !r.fields?.length) return false;
    try { return !existing.has(new URL(r.contactUrl).hostname); } catch { return false; }
  });
  console.log(`   新規対象: ${targets.length}件\n`);

  if (!targets.length) {
    console.log('   ✅ 追加するマッピングはありません');
    return;
  }

  const batches = [];
  for (let i = 0; i < targets.length; i += BATCH_SIZE) batches.push(targets.slice(i, i + BATCH_SIZE));
  console.log(`   ${batches.length}バッチに分割 (最大${BATCH_SIZE}件/バッチ)`);

  for (let i = 0; i < batches.length; i++) {
    await runClaudeBatch(batches[i], i + 1, batches.length);
    if (i < batches.length - 1) {
      process.stdout.write('   ⏳ 5秒待機...\r');
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  console.log('\n🎉 全マッピング生成完了！');
  console.log('   拡張をリロードしてバッチを実行してください。');
}

// ─── メイン ───────────────────────────────────────────────────────────
(async () => {
  console.log('═══════════════════════════════════════════');
  console.log('  フォームマッピング一括生成ツール');
  console.log('═══════════════════════════════════════════');

  const results = await phase1Crawl();
  await phase2Generate(results);
})().catch(console.error);
