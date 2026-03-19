/**
 * Australia Character Page Handler
 * Serves Australian mascot character pages from AU_CHAR_R2.
 * URL: /au/c/{postcode}
 */
export async function onRequestGet(context) {
  try {
  const { code } = context.params;

  // Validate 4-digit Australian postcode
  if (!/^\d{4}$/.test(code)) {
    return new Response('Not Found', { status: 404 });
  }

  const obj = await context.env.AU_CHAR_R2.get(`au/c/${code}/index.html`);
  if (!obj) {
    return new Response('Not Found', { status: 404 });
  }

  let html = await obj.text();

  // OGタグ注入
  const _pageUrl = 'https://mascodex.com/au/c/' + code;
  const _imgUrl = 'https://img.mascodex.com/' + code + '_01.png';
  const _titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const _ogTags = '<meta property="og:title" content="' + (_titleMatch ? _titleMatch[1].replace(/"/g,'&quot;') : code) + '">'
    + '<meta property="og:image" content="' + _imgUrl + '">'
    + '<meta property="og:url" content="' + _pageUrl + '">'
    + '<meta property="og:type" content="website">'
    + '<meta name="twitter:card" content="summary_large_image">'
    + '<link rel="canonical" href="' + _pageUrl + '">';
  html = html.replace('</head>', _ogTags + '</head>');


  // Fix history variable collision
  html = html
    .split('var history = [];').join('var chatHistory = [];')
    .split('history.push(').join('chatHistory.push(')
    .split('history.slice(-8)').join('chatHistory.slice(-8)');

  // D1からpersonality・local_notesを取得して注入
  if (context.env.MASCOT_D1) {
    try {
      const row = await context.env.MASCOT_D1.prepare(
        'SELECT personality, local_notes FROM mascots WHERE zip = ?'
      ).bind('AU' + code).first();
      if (row) {
        let inject = '';
        if (row.personality) {
          inject += `<div class="section"><h2>🧠 Personality</h2><p>${row.personality}</p></div>`;
        }
        if (row.local_notes) {
          inject += `<div class="section"><h2>📝 Local Notes</h2><p>${row.local_notes}</p></div>`;
        }
        if (inject) {
          if (html.includes('<div class="chat-widget"')) {
            html = html.replace(/<div class="chat-widget"/, inject + '<div class="chat-widget"');
          } else {
            html = html.replace('</div>\n\n  <div class="footer">', inject + '</div>\n\n  <div class="footer">');
          }
        }
      }
    } catch (e) {
      // D1 error - silently continue without personality data
    }
  }

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
      if(!items.length){el.innerHTML='<div style="opacity:.4;font-size:.85rem">No posts yet</div>';return;}
      el.innerHTML=items.slice(0,5).map(function(p){
        var raw=(p.object&&p.object.content)||p.content||'';
        var c=raw.replace(/^#[^\\n]+\\n*/,'').substring(0,160);
        var t=p.published?new Date(p.published).toLocaleDateString():'';
        return '<div class="social-post">'
          +'<div class="social-post-content">'+c+(c.length>=160?'...':'')+'</div>'
          +'<div class="social-post-meta">'+t+'</div>'
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

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
  } catch(e) {
    return new Response("Error: " + e.message, {status:500, headers:{"Content-Type":"text/plain"}});
  }
}
