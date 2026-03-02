/**
 * US Character Page Handler
 * Generates pages dynamically from US_KV profile data.
 * URL: /us/c/{zipCode}
 */
export async function onRequestGet(context) {
  const { code } = context.params;
  const { env } = context;

  if (!/^\d{5}$/.test(code)) {
    return new Response('Not Found', { status: 404 });
  }

  // Try R2 first (pre-uploaded pages)
  const obj = await env.US_CHAR_R2.get(`us/${code}/index.html`);
  if (obj) {
    let html = await obj.text();
    // ソーシャルフィードを注入
    const socialScript = `
<div class="section" id="mascot-social" style="border:1px solid rgba(255,255,255,.1);margin-bottom:20px">
  <h2 style="display:flex;align-items:center;gap:8px">
    💬 Recent Posts
    <a href="https://mascodex-social.pages.dev" target="_blank" 
       style="font-size:.7rem;font-weight:400;opacity:.5;text-decoration:none;margin-left:auto">
      mascodex social ↗
    </a>
  </h2>
  <div id="social-feed-posts" style="margin-top:12px">
    <div style="opacity:.4;font-size:.85rem">Loading...</div>
  </div>
</div>
<script>
(function(){
  fetch('https://mascot-social.taiichifox.workers.dev/users/${code}/outbox')
    .then(function(r){return r.ok?r.json():null})
    .then(function(d){
      if(!d)return;
      var items=d.orderedItems||[];
      var el=document.getElementById('social-feed-posts');
      if(!items.length){el.innerHTML='<div style="opacity:.4;font-size:.85rem">No posts yet</div>';return;}
      el.innerHTML=items.slice(0,5).map(function(p){
        var c=(p.object&&p.object.content)||'';
        var t=p.published?new Date(p.published).toLocaleDateString():'';
        return '<div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.07)">'
          +'<div style="font-size:.88rem;line-height:1.6;opacity:.9">'+c+'</div>'
          +'<div style="font-size:.72rem;opacity:.4;margin-top:4px">'+t+'</div></div>';
      }).join('');
    }).catch(function(){});
})();
</script>`;
    // チャットウィジェットの前に挿入
    // historyグローバル変数の衝突を修正
    html = html
      .replace('var history = [];', 'var chatHistory = [];')
      .replace(/history\.push\(/g, 'chatHistory.push(')
      .replace(/history\.slice\(-8\)/g, 'chatHistory.slice(-8)');
    html = html.replace('<div class="chat-widget">', socialScript + '<div class="chat-widget">');
    if (!html.includes('social-feed-posts')) {
      html = html.replace('</body>', socialScript + '</body>');
    }
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  // Fallback: generate dynamically from KV
  const raw = await env.US_KV.get(`us_char_${code}`);
  if (!raw) {
    return new Response('Not Found', { status: 404 });
  }

  const profile = JSON.parse(raw);
  const html = renderPage(code, profile);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=3600',
    },
  });
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderPage(zip, p) {
  const name = p.name || `ZIP ${zip} Mascot`;
  const catchphrase = p.catchphrase || '';
  const backstory = p.backstory || '';
  const colors = p.colorPalette || ['#667eea', '#764ba2', '#ffdd57'];
  const city = p.city || '';
  const state = p.state || '';
  const stateName = p.stateName || '';
  const county = p.county || '';

  let poiHtml = '';
  if (p.pois) {
    const sections = [];
    for (const [cat, items] of Object.entries(p.pois)) {
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
  <title>${esc(name)} - ZIP ${zip} Mascot | Mascodex USA</title>
  <meta name="description" content="${esc(name)} is the mascot of ZIP ${zip} (${esc(city)}, ${esc(state)}). ${esc(catchphrase)}">
  <meta property="og:title" content="${esc(name)} - ZIP ${zip} Mascot">
  <meta property="og:image" content="/img/us/${zip}_01.png">
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
    <h1>${esc(name)}</h1>
    <div class="zip">ZIP ${zip} &mdash; ${esc(city)}, ${esc(state)}</div>
    ${catchphrase ? `<div class="catchphrase">&ldquo;${esc(catchphrase)}&rdquo;</div>` : ''}
  </div>

  <div class="images">
    <img src="/img/us/${zip}_01.png" alt="${esc(name)} variant 1" loading="lazy">
    <img src="/img/us/${zip}_02.png" alt="${esc(name)} variant 2" loading="lazy">
  </div>

  <div class="content">
    <div class="section">
      <h2>About ${esc(name)}</h2>
      <p>${esc(backstory)}</p>
      <p style="margin-top:8px;opacity:.6;font-size:.85rem;">${esc(city)}, ${esc(stateName)}${county ? ` &bull; ${esc(county)} County` : ''}</p>
    </div>

    ${poiHtml}

    <div class="section" id="mascot-social" style="border:1px solid rgba(255,255,255,.1)">
      <h2 style="display:flex;align-items:center;gap:8px">
        💬 Recent Posts
        <a href="https://mascodex-social.pages.dev" target="_blank" 
           style="font-size:.7rem;font-weight:400;opacity:.5;text-decoration:none;margin-left:auto">
          mascodex social ↗
        </a>
      </h2>
      <div id="social-feed-posts" style="margin-top:12px">
        <div style="opacity:.4;font-size:.85rem">Loading...</div>
      </div>
    </div>

    <div class="chat-widget">
      <h2>Chat with ${esc(name)}</h2>
      <div class="chat-messages" id="chat-messages">
        <div class="chat-msg bot">Hey! I'm ${esc(name)} from ZIP ${zip}! Ask me anything about this area!</div>
      </div>
      <div class="chat-input-row">
        <input type="text" id="chat-input" placeholder="Say something...">
        <button id="chat-send">Send</button>
      </div>
    </div>
  </div>

  <div class="footer">&copy; 2026 Mascodex USA. AI-generated character.</div>

  <script>
    var chatHistory = [];
    var sendBtn = document.getElementById('chat-send');
    var input = document.getElementById('chat-input');
    var msgs = document.getElementById('chat-messages');

    function sendChat() {
      var msg = input.value.trim();
      if (!msg) return;
      input.value = '';
      appendMsg('user', msg);
      chatHistory.push({ role: 'user', content: msg });

      fetch('/api/chat/us/${zip}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: chatHistory.slice(-8) })
      })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var text = d.response || 'Hmm, try again!';
        appendMsg('bot', text);
        chatHistory.push({ role: 'assistant', content: text });
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

    // ソーシャルフィード読み込み
    fetch('https://mascot-social.taiichifox.workers.dev/users/${zip}/outbox')
      .then(function(r){return r.ok?r.json():null})
      .then(function(d){
        if(!d)return;
        var items=d.orderedItems||[];
        var el=document.getElementById('social-feed-posts');
        if(!items.length){el.innerHTML='<div style="opacity:.4;font-size:.85rem">No posts yet</div>';return;}
        el.innerHTML=items.slice(0,5).map(function(p){
          var c=(p.object&&p.object.content)||'';
          var t=p.published?new Date(p.published).toLocaleDateString():'';
          return '<div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.07)"><div style="font-size:.88rem;line-height:1.6;opacity:.9">'+c+'</div><div style="font-size:.72rem;opacity:.4;margin-top:4px">'+t+'</div></div>';
        }).join('');
      }).catch(function(){});
  </script>
</body>
</html>`;
}
