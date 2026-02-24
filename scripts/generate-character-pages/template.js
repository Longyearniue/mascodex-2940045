function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateCharacterHTML(char) {
  const { name, postalCode, area, intro, story } = char;
  const imgBase = 'https://img.mascodex.com/' + postalCode;
  const desc = escapeHtml((story || intro || name + 'は' + area + 'のゆるキャラです').replace(/\n/g, ' ').slice(0, 120));
  const escapedName = escapeHtml(name);
  const escapedArea = escapeHtml(area);
  const chatApiBase = 'https://mascodex.com/api/chat';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedName} - ${escapedArea}のゆるキャラ | Mascodex</title>
  <meta name="description" content="${desc}">
  <meta property="og:title" content="${escapedName} - ${escapedArea}のゆるキャラ">
  <meta property="og:description" content="${desc}">
  <meta property="og:image" content="${imgBase}_01.png">
  <meta property="og:url" content="https://characters.mascodex.com/${postalCode}/">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="https://characters.mascodex.com/${postalCode}/">
  <script type="application/ld+json">
  {
    "@context":"https://schema.org",
    "@type":"Thing",
    "name":${JSON.stringify(name)},
    "description":${JSON.stringify(desc)},
    "image":"${imgBase}_01.png",
    "url":"https://characters.mascodex.com/${postalCode}/"
  }
  </script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Sans','Noto Sans JP',sans-serif;background:#0f0c29;color:#fff;min-height:100vh;}
    .container{max-width:680px;margin:0 auto;padding:20px 16px 80px;}

    /* Header */
    .header{display:flex;justify-content:space-between;align-items:center;padding:12px 0;margin-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.08);}
    .header a{color:rgba(255,255,255,0.6);text-decoration:none;font-size:0.85rem;}
    .header a:hover{color:#fff;}
    .logo{font-weight:800;font-size:1.1rem;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}

    /* Character Card */
    .char-card{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden;margin-bottom:24px;}
    .char-images{display:flex;gap:4px;padding:20px 20px 0;}
    .char-images img{flex:1;aspect-ratio:1;object-fit:cover;border-radius:16px;background:rgba(255,255,255,0.03);cursor:pointer;transition:transform 0.3s;}
    .char-images img:hover{transform:scale(1.05);}
    .char-info{padding:20px;}
    .char-name{font-size:1.8rem;font-weight:800;margin-bottom:4px;}
    .char-area{color:rgba(255,255,255,0.5);font-size:0.9rem;margin-bottom:4px;}
    .char-postal{color:rgba(255,255,255,0.3);font-size:0.8rem;margin-bottom:16px;}
    .char-badge{display:inline-block;background:#ffdd57;color:#000;font-weight:700;font-size:0.75rem;padding:3px 10px;border-radius:20px;margin-bottom:16px;}

    /* Story */
    .section-title{font-size:1.1rem;font-weight:700;margin-bottom:10px;padding-left:12px;border-left:3px solid #667eea;}
    .section-text{color:rgba(255,255,255,0.75);line-height:1.8;font-size:0.95rem;margin-bottom:24px;}

    /* Chat Widget */
    .chat-widget{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;}
    .chat-header{padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);font-weight:700;display:flex;align-items:center;gap:10px;}
    .chat-header img{width:32px;height:32px;border-radius:50%;object-fit:cover;}
    .chat-messages{height:280px;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:10px;}
    .chat-msg{max-width:85%;padding:10px 14px;border-radius:16px;font-size:0.9rem;line-height:1.5;animation:fadeIn 0.3s ease;}
    .chat-msg.bot{background:rgba(102,126,234,0.15);border:1px solid rgba(102,126,234,0.2);align-self:flex-start;border-bottom-left-radius:4px;}
    .chat-msg.user{background:rgba(233,69,96,0.15);border:1px solid rgba(233,69,96,0.2);align-self:flex-end;border-bottom-right-radius:4px;}
    .chat-msg.typing{opacity:0.5;}
    @keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
    .chat-input-row{display:flex;gap:8px;padding:12px 16px;border-top:1px solid rgba(255,255,255,0.06);}
    .chat-input{flex:1;padding:10px 16px;border:1px solid rgba(255,255,255,0.1);border-radius:24px;background:rgba(255,255,255,0.05);color:#fff;font-size:0.9rem;outline:none;font-family:inherit;}
    .chat-input:focus{border-color:rgba(102,126,234,0.4);}
    .chat-input::placeholder{color:rgba(255,255,255,0.25);}
    .chat-send{padding:10px 20px;background:linear-gradient(135deg,#667eea,#764ba2);border:none;border-radius:24px;color:#fff;font-weight:700;font-size:0.85rem;cursor:pointer;transition:opacity 0.2s;}
    .chat-send:hover{opacity:0.85;}
    .chat-send:disabled{opacity:0.4;cursor:not-allowed;}

    /* Links */
    .links{display:flex;gap:10px;margin-top:24px;flex-wrap:wrap;}
    .link-btn{flex:1;min-width:140px;padding:14px;text-align:center;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:14px;color:#fff;text-decoration:none;font-size:0.85rem;font-weight:600;transition:background 0.2s;}
    .link-btn:hover{background:rgba(255,255,255,0.1);}

    /* Footer */
    .footer{text-align:center;padding:40px 0 20px;color:rgba(255,255,255,0.2);font-size:0.75rem;}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="https://mascodex.com/" class="logo">Mascodex</a>
      <div>
        <a href="https://mascodex.com/game.html">ゲーム</a>
      </div>
    </div>

    <div class="char-card">
      <div class="char-images">
        <img src="${imgBase}_01.png" alt="${escapedName} 1" loading="eager">
        <img src="${imgBase}_02.png" alt="${escapedName} 2" loading="lazy">
        <img src="${imgBase}_03.png" alt="${escapedName} 3" loading="lazy">
      </div>
      <div class="char-info">
        <div class="char-badge">非公式ゆるキャラ</div>
        <h1 class="char-name">${escapedName}</h1>
        <div class="char-area">${escapedArea}</div>
        <div class="char-postal">〒${postalCode}</div>
      </div>
    </div>

    ${intro ? '<div class="section-title">紹介</div><p class="section-text">' + escapeHtml(intro) + '</p>' : ''}

    ${story ? '<div class="section-title">ストーリー</div><p class="section-text">' + escapeHtml(story) + '</p>' : ''}

    <div class="chat-widget">
      <div class="chat-header">
        <img src="${imgBase}_01.png" alt="${escapedName}">
        <span>${escapedName} とおはなし</span>
      </div>
      <div class="chat-messages" id="chatMessages">
        <div class="chat-msg bot">こんにちは！${escapedName}だよ。${escapedArea}のことなら何でも聞いてね！</div>
      </div>
      <div class="chat-input-row">
        <input type="text" class="chat-input" id="chatInput" placeholder="${escapedName}に話しかける..." maxlength="200">
        <button class="chat-send" id="chatSend" onclick="sendChat()">送信</button>
      </div>
    </div>

    <div class="links">
      <a href="https://mascodex.com/game.html" class="link-btn">🎮 ゲームで冒険</a>
      <a href="https://mascodex.com/shop.html?char=${postalCode}" class="link-btn">🛍️ グッズを見る</a>
    </div>

    <div class="footer">&copy; 2025 Mascodex. All characters are AI-generated original designs.</div>
  </div>

  <script>
    var CHAR_NAME = ${JSON.stringify(name)};
    var POSTAL = '${postalCode}';
    var API = '${chatApiBase}';
    var history = [];

    document.getElementById('chatInput').addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) sendChat();
    });

    async function sendChat() {
      var input = document.getElementById('chatInput');
      var msg = input.value.trim();
      if (!msg) return;
      input.value = '';

      var msgs = document.getElementById('chatMessages');
      // Add user message
      var userEl = document.createElement('div');
      userEl.className = 'chat-msg user';
      userEl.textContent = msg;
      msgs.appendChild(userEl);

      // Add typing indicator
      var typingEl = document.createElement('div');
      typingEl.className = 'chat-msg bot typing';
      typingEl.textContent = CHAR_NAME + 'が考え中...';
      msgs.appendChild(typingEl);
      msgs.scrollTop = msgs.scrollHeight;

      history.push({ role: 'user', content: msg });
      // Keep last 5 exchanges
      if (history.length > 10) history = history.slice(-10);

      var btn = document.getElementById('chatSend');
      btn.disabled = true;

      try {
        var res = await fetch(API + '/' + POSTAL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg, history: history })
        });
        var data = await res.json();
        typingEl.remove();

        var botEl = document.createElement('div');
        botEl.className = 'chat-msg bot';
        botEl.textContent = data.response || 'ごめんね、うまく答えられなかったよ。';
        msgs.appendChild(botEl);
        history.push({ role: 'assistant', content: data.response || '' });
      } catch (e) {
        typingEl.remove();
        var errEl = document.createElement('div');
        errEl.className = 'chat-msg bot';
        errEl.textContent = 'ごめんなさい、今お話しできないみたい。また後で話しかけてね！';
        msgs.appendChild(errEl);
      }
      msgs.scrollTop = msgs.scrollHeight;
      btn.disabled = false;
    }
  </script>
</body>
</html>`;
}

module.exports = { generateCharacterHTML };
