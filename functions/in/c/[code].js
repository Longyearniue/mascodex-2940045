/**
 * India Character Page Handler
 * Serves India mascot character pages from IN_CHAR_R2.
 * URL: /in/c/{pinCode}
 */
export async function onRequestGet(context) {
  const { code } = context.params;

  // Validate 6-digit India PIN code
  if (!/^\d{6}$/.test(code)) {
    return new Response('Not Found', { status: 404 });
  }

  const obj = await context.env.IN_CHAR_R2.get(`in/${code}/index.html`);
  if (!obj) {
    return new Response('Not Found', { status: 404 });
  }

  let html = await obj.text();

  // historyグローバル変数の衝突をスクリプト注入で修正
  const fixScript = `<script>
// Fix: override window.history collision
(function(){
  var _chatHistory = [];
  Object.defineProperty(window, '_chatHistory', {value: _chatHistory, writable: true});
  // Patch after page scripts load
  document.addEventListener('DOMContentLoaded', function() {
    var scripts = document.querySelectorAll('script:not([src])');
    // history variable is local to the inline script - no patch needed
    // The real fix: redefine sendChat to use a safe variable
    var origSend = window.sendChat;
  });
})();
</script>`;

  // 直接文字列置換（Functionが呼ばれていれば効く）
  html = html
    .split('var history = [];').join('var chatHistory = [];')
    .split('history.push(').join('chatHistory.push(')
    .split('history.slice(-8)').join('chatHistory.slice(-8)');


  // Social feed injection
  const socialScript = `
<style>
.social-post{padding:10px 0;border-bottom:1px solid rgba(255,255,255,.07);}
.social-post:last-child{border-bottom:none;}
.social-post-content{font-size:.88rem;line-height:1.6;opacity:.88;}
.social-post-meta{font-size:.7rem;opacity:.38;margin-top:4px;}
</style>
<div class="section" id="mascot-social">
  <h2 style="display:flex;align-items:center;gap:8px">
    💬 Recent Posts
    <a href="https://social.mascodex.com/users/${code}" target="_blank"
       style="font-size:.72rem;font-weight:400;opacity:.45;text-decoration:none;margin-left:auto">
      @${code}@social.mascodex.com ↗
    </a>
  </h2>
  <div id="social-feed-posts"><div style="opacity:.4;font-size:.85rem">Loading...</div></div>
</div>
<script>
(function(){
  fetch('https://social.mascodex.com/users/${code}/outbox')
    .then(function(r){return r.ok?r.json():null})
    .then(function(d){
      if(!d)return;
      var items=(d.orderedItems||[]);
      var el=document.getElementById('social-feed-posts');
      if(!items.length){el.innerHTML='<div style=\'opacity:.4;font-size:.85rem\'>No posts yet</div>';return;}
      el.innerHTML=items.slice(0,5).map(function(p){
        var raw=(p.object&&p.object.content)||p.content||'';
        var c=raw.replace(/^#[^\n]+\n*/,'').substring(0,160);
        var t=p.published?new Date(p.published).toLocaleDateString():'';
        return '<div class=\'social-post\'>'
          +'<div class=\'social-post-content\'>'+c+(c.length>=160?'...':'')+'</div>'
          +'<div class=\'social-post-meta\'>'+t+'</div>'
          +'</div>';
      }).join('');
    }).catch(function(){});
})();
</script>`;

  // chat-widgetの前に挿入
  html = html.replace('<div class="chat-widget">', socialScript + '<div class="chat-widget">');
  if (!html.includes('social-feed-posts')) {
    html = html.replace('</body>', socialScript + '</body>');
  }

  // Inject shop widget (India version)
  const injected = html.replace('</body>', '<script src="/js/shop-widget.js" defer></script></body>');

  return new Response(injected, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
