#!/usr/bin/env node
/**
 * US Character Page Generator
 * Generates HTML character pages from profiles.
 *
 * Usage:
 *   node src/page-gen.js --zips=10001,90210,60601
 *   node src/page-gen.js                           # All profiles
 *
 * Output: data/pages/{zipCode}/index.html
 */

const fs = require('fs');
const path = require('path');

const PROFILES_DIR = path.join(__dirname, '..', 'data', 'profiles');
const PAGES_DIR = path.join(__dirname, '..', 'data', 'pages');

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--(\w+)=(.+)$/);
    if (match) {
      args[match[1]] = match[2];
    }
  }
  return args;
}

function generatePage(profile, mergedData) {
  const zip = profile.zipCode;
  const name = profile.name || `ZIP ${zip} Mascot`;
  const catchphrase = profile.catchphrase || '';
  const backstory = profile.backstory || '';
  const colors = profile.colorPalette || ['#667eea', '#764ba2', '#ffdd57'];
  const city = mergedData?.city || '';
  const state = mergedData?.state || '';
  const stateName = mergedData?.stateName || '';
  const county = mergedData?.county || '';

  // Build POI section
  let poiHtml = '';
  if (mergedData?.pois) {
    const sections = [];
    for (const [cat, items] of Object.entries(mergedData.pois)) {
      if (items && items.length > 0) {
        sections.push(`<li><strong>${cat}:</strong> ${items.slice(0, 5).join(', ')}</li>`);
      }
    }
    if (sections.length > 0) {
      poiHtml = `<div class="section"><h2>Nearby Places</h2><ul>${sections.join('')}</ul></div>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name} - ZIP ${zip} Mascot | Mascodex USA</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f0c29;color:#fff;min-height:100vh;}
    .header{background:linear-gradient(135deg,${colors[0]},${colors[1]||colors[0]});padding:20px;text-align:center;position:relative;}
    .header a{color:rgba(255,255,255,.7);text-decoration:none;position:absolute;left:16px;top:20px;font-size:.9rem;}
    .header h1{font-size:2.2rem;font-weight:800;margin-bottom:4px;}
    .header .zip{opacity:.7;font-size:1rem;}
    .header .catchphrase{font-style:italic;opacity:.8;margin-top:6px;}
    .images{display:flex;justify-content:center;gap:16px;padding:30px 20px;flex-wrap:wrap;}
    .images img{width:250px;height:250px;border-radius:20px;object-fit:cover;border:3px solid rgba(255,255,255,.15);box-shadow:0 8px 24px rgba(0,0,0,.3);}
    .content{max-width:700px;margin:0 auto;padding:0 20px 40px;}
    .section{background:rgba(255,255,255,.06);border-radius:16px;padding:20px;margin-bottom:20px;}
    .section h2{font-size:1.2rem;margin-bottom:10px;color:${colors[2]||'#ffdd57'};}
    .section p{line-height:1.6;opacity:.85;}
    .section ul{list-style:none;padding:0;}
    .section ul li{padding:4px 0;opacity:.8;font-size:.9rem;}
    .chat-widget{background:#1e1a3a;border-radius:16px;padding:20px;margin-bottom:20px;}
    .chat-widget h2{font-size:1.2rem;margin-bottom:12px;}
    .chat-messages{min-height:80px;max-height:250px;overflow-y:auto;margin-bottom:12px;}
    .chat-msg{padding:8px 14px;margin:6px 0;border-radius:12px;font-size:.9rem;line-height:1.4;max-width:85%;}
    .chat-msg.bot{background:rgba(102,126,234,.2);}
    .chat-msg.user{background:rgba(255,221,87,.2);margin-left:auto;}
    .chat-input-row{display:flex;gap:8px;}
    .chat-input-row input{flex:1;padding:12px;border:none;border-radius:50px;font-size:.9rem;background:rgba(255,255,255,.1);color:#fff;outline:none;}
    .chat-input-row input::placeholder{color:rgba(255,255,255,.4);}
    .chat-input-row button{padding:12px 20px;background:#ffdd57;color:#000;border:none;border-radius:50px;font-weight:700;cursor:pointer;}
    .footer{text-align:center;padding:30px;opacity:.3;font-size:.8rem;}
    @media(max-width:600px){.images img{width:160px;height:160px;}.header h1{font-size:1.6rem;}}
  </style>
</head>
<body>
  <script>var POSTAL='${zip}';</script>
  <div class="header">
    <a href="/us/">&larr; Back</a>
    <h1>${escHtml(name)}</h1>
    <div class="zip">ZIP ${zip} &mdash; ${escHtml(city)}, ${escHtml(state)}</div>
    ${catchphrase ? `<div class="catchphrase">"${escHtml(catchphrase)}"</div>` : ''}
  </div>

  <div class="images">
    <img src="/img/us/${zip}_01.png" alt="${escHtml(name)} variant 1">
    <img src="/img/us/${zip}_02.png" alt="${escHtml(name)} variant 2">
  </div>

  <div class="content">
    <div class="section">
      <h2>About ${escHtml(name)}</h2>
      <p>${escHtml(backstory)}</p>
      <p style="margin-top:8px;opacity:.6;font-size:.85rem;">${escHtml(city)}, ${escHtml(stateName)} &bull; ${escHtml(county)} County</p>
    </div>

    ${poiHtml}

    <div class="chat-widget">
      <h2>Chat with ${escHtml(name)}</h2>
      <div class="chat-messages" id="chat-messages">
        <div class="chat-msg bot">Hey! I'm ${escHtml(name)} from ZIP ${zip}! Ask me anything about this area!</div>
      </div>
      <div class="chat-input-row">
        <input type="text" id="chat-input" placeholder="Say something...">
        <button id="chat-send">Send</button>
      </div>
    </div>
  </div>

  <div class="footer">&copy; 2025 Mascodex USA. AI-generated character.</div>

  <script>
    var history = [];
    var sendBtn = document.getElementById('chat-send');
    var input = document.getElementById('chat-input');
    var msgs = document.getElementById('chat-messages');

    function sendChat() {
      var msg = input.value.trim();
      if (!msg) return;
      input.value = '';
      appendMsg('user', msg);
      history.push({ role: 'user', content: msg });

      fetch('/api/chat/us/${zip}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: history.slice(-8) })
      })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var text = d.response || 'Hmm, try again!';
        appendMsg('bot', text);
        history.push({ role: 'assistant', content: text });
      })
      .catch(function() { appendMsg('bot', 'Network error. Try again!'); });
    }

    function appendMsg(type, text) {
      var div = document.createElement('div');
      div.className = 'chat-msg ' + type;
      div.textContent = text;
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
    }

    sendBtn.onclick = sendChat;
    input.addEventListener('keypress', function(e) { if (e.key === 'Enter') sendChat(); });
  </script>
</body>
</html>`;
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function main() {
  const args = parseArgs();

  let profileFiles = fs.readdirSync(PROFILES_DIR).filter(f => f.endsWith('.json'));

  if (args.zips) {
    const zips = new Set(args.zips.split(',').map(z => z.trim().padStart(5, '0')));
    profileFiles = profileFiles.filter(f => zips.has(f.replace('.json', '')));
  }
  if (args.limit) {
    profileFiles = profileFiles.slice(0, parseInt(args.limit, 10));
  }

  console.log(`\n=== US Mascot Pipeline: Page Generation ===`);
  console.log(`  Profiles: ${profileFiles.length}\n`);

  const MERGED_DIR = path.join(__dirname, '..', 'data', 'merged');

  for (const file of profileFiles) {
    const zip = file.replace('.json', '');
    const profile = JSON.parse(fs.readFileSync(path.join(PROFILES_DIR, file), 'utf8'));

    // Load merged data for POIs
    let merged = null;
    const mergedPath = path.join(MERGED_DIR, file);
    if (fs.existsSync(mergedPath)) {
      merged = JSON.parse(fs.readFileSync(mergedPath, 'utf8'));
    }

    const html = generatePage(profile, merged);
    const outDir = path.join(PAGES_DIR, zip);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
    console.log(`  Generated: ${zip}/index.html - ${profile.name}`);
  }

  console.log(`\nDone. ${profileFiles.length} pages generated.`);
}

main();
