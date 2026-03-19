// Serve character pages from R2 with shop product section injection
// URL: /c/{postalCode}  (e.g., /c/2940045)
export async function onRequestGet(context) {
  const { code } = context.params;

  // Validate: 7-digit postal code
  if (!/^\d{7}$/.test(code)) {
    return new Response('Not Found', { status: 404 });
  }

  const obj = await context.env.CHAR_R2.get(`${code}/index.html`);
  if (!obj) {
    return new Response('Not Found', { status: 404 });
  }

  let html = await obj.text();

  // Inject product preview section before the links section,
  // and the shop-widget floating banner before </body>
  const productSection = buildProductSection(code);
  const radioSection = '<div class="section" id="mascot-radio" style="background:rgba(255,255,255,.04);border-radius:16px;padding:20px;margin-bottom:20px">' + '<h2 style="font-size:1.1rem;margin-bottom:14px;display:flex;align-items:center;gap:8px">&#127908; \u3075\u308B\u3055\u3068\u30E9\u30B8\u30AA' + '<a href="https://mascodex.com/radio" target="_blank" style="font-size:.7rem;opacity:.35;text-decoration:none;margin-left:auto">&#8599;</a></h2>' + '<div id="r-now"><div style="opacity:.4;font-size:.84rem">\u8AAD\u307F\u8FBC\u307F\u4E2D...</div></div>' + '<div id="r-arc"></div></div>' + '<script src="/js/radio-embed.js" data-code="' + code + '"><\/script>';
  html = html.replace(
    '<div class="links">',
    radioSection + productSection + '<div class="links">'
  );

  // Social feed injection
  const jpZip = 'JP' + code;
  const socialScript =`<style>.social-post{padding:10px 0;border-bottom:1px solid rgba(255,255,255,.07);}.social-post:last-child{border-bottom:none;}.social-post-content{font-size:.88rem;line-height:1.6;opacity:.88;}.social-post-meta{font-size:.7rem;opacity:.38;margin-top:4px;}</style><div class="section" id="mascot-social" style="background:rgba(255,255,255,.04);border-radius:16px;padding:20px;margin-bottom:20px"><h2 style="font-size:1.1rem;margin-bottom:12px;display:flex;align-items:center;gap:8px">💬 最近のつぶやき<a href="https://social.mascodex.com/users/JP${code}" target="_blank" style="font-size:.7rem;font-weight:400;opacity:.4;text-decoration:none;margin-left:auto">@JP${code}@social.mascodex.com ↗</a></h2><div id="social-feed-posts"><div style="opacity:.4;font-size:.85rem">読み込み中...</div></div></div><script>(function(){fetch('https://social.mascodex.com/users/JP${code}/outbox').then(function(r){return r.ok?r.json():null}).then(function(d){if(!d)return;var items=(d.orderedItems||[]);var el=document.getElementById('social-feed-posts');if(!items.length){el.innerHTML='<div style="opacity:.4;font-size:.85rem">まだ投稿がありません</div>';return;}el.innerHTML=items.slice(0,5).map(function(p){var raw=(p.object&&p.object.content)||p.content||'';var c=raw.replace(/^#[^\\n]+\\n*/,'').substring(0,140);var t=p.published?new Date(p.published).toLocaleDateString('ja-JP'):'';return '<div class="social-post"><div class="social-post-content">'+c+(c.length>=140?'…':'')+'</div><div class="social-post-meta">'+t+'</div></div>';}).join('');}).catch(function(){});})();</script>`;


  // SNSシェアボタン注入
  const shareSection = `
<style>
.share-section{max-width:700px;margin:0 auto 20px;padding:0 20px}
.share-btns{display:flex;gap:6px;flex-wrap:wrap}
.share-btn{display:inline-flex;align-items:center;gap:5px;padding:8px 13px;border-radius:24px;font-size:.78rem;font-weight:600;text-decoration:none;transition:opacity .2s;white-space:nowrap;border:none}
.share-btn:hover{opacity:.85}
.share-x{background:#000;color:#fff}
.share-line{background:#06C755;color:#fff}
.share-wa{background:#25D366;color:#fff}
.share-tg{background:#229ED9;color:#fff}
.share-pin{background:#E60023;color:#fff}
.share-reddit{background:#FF4500;color:#fff}
.share-bsky{background:#0085ff;color:#fff}
.share-fb{background:#1877F2;color:#fff}
.share-copy{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.2)!important;cursor:pointer}
.share-copy.copied{background:rgba(100,220,100,.2);color:#6dc}
</style>
<div class="share-section">
  <div class="share-btns">
    <a class="share-btn share-x" id="share-x" href="#" target="_blank" rel="noopener">𝕏 X</a>
    <a class="share-btn share-line" id="share-line" href="#" target="_blank" rel="noopener">LINE</a>
    <a class="share-btn share-wa" id="share-wa" href="#" target="_blank" rel="noopener">WhatsApp</a>
    <a class="share-btn share-tg" id="share-tg" href="#" target="_blank" rel="noopener">Telegram</a>
    <a class="share-btn share-pin" id="share-pin" href="#" target="_blank" rel="noopener">Pinterest</a>
    <a class="share-btn share-reddit" id="share-reddit" href="#" target="_blank" rel="noopener">Reddit</a>
    <a class="share-btn share-bsky" id="share-bsky" href="#" target="_blank" rel="noopener">Bluesky</a>
    <a class="share-btn share-fb" id="share-fb" href="#" target="_blank" rel="noopener">Facebook</a>
    <button class="share-btn share-copy" id="share-copy" onclick="copyUrl()">🔗 コピー</button>
  </div>
</div>
<script>
(function(){
  var url=encodeURIComponent(location.href);
  var title=encodeURIComponent(document.title);
  var img=encodeURIComponent((document.querySelector('meta[property="og:image"]')||{}).content||'');
  document.getElementById('share-x').href='https://twitter.com/intent/tweet?text='+title+'&url='+url+'&hashtags=mascodex';
  document.getElementById('share-line').href='https://social-plugins.line.me/lineit/share?url='+url;
  document.getElementById('share-wa').href='https://wa.me/?text='+title+'%20'+url;
  document.getElementById('share-tg').href='https://t.me/share/url?url='+url+'&text='+title;
  document.getElementById('share-pin').href='https://pinterest.com/pin/create/button/?url='+url+'&media='+img+'&description='+title;
  document.getElementById('share-reddit').href='https://reddit.com/submit?url='+url+'&title='+title;
  document.getElementById('share-bsky').href='https://bsky.app/intent/compose?text='+title+'%20'+url;
  document.getElementById('share-fb').href='https://www.facebook.com/sharer/sharer.php?u='+url;
})();
function copyUrl(){
  navigator.clipboard.writeText(location.href).then(function(){
    var b=document.getElementById('share-copy');
    b.textContent='✅ コピー完了';b.classList.add('copied');
    setTimeout(function(){b.textContent='🔗 コピー';b.classList.remove('copied');},2000);
  });
}
</script>`;

  html = html.replace('</body>', shareSection + '</body>');

  // チャットウィジェットまたはlinksの前に挿入
  html = html.replace('<div class="links">', socialScript + '<div class="links">');
  if (!html.includes('social-feed-posts')) {
    html = html.replace('</body>', socialScript + '</body>');
  }

  // Rewrite game link to pass postal code
  html = html.replace(
    /href="https?:\/\/mascodex\.com\/game\.html"/g,
    `href="/game?code=${code}"`
  );
  html = html.replace('</body>', '<script src="/shop-widget.js" defer></script></body>');

  // Replace hardcoded PayPal SDK client-id with live value from env
  const paypalClientId = context.env.PAYPAL_CLIENT_ID;
  if (paypalClientId) {
    html = html.replace(
      /(<script\s+src="https:\/\/www\.paypal\.com\/sdk\/js\?client-id=)[^&"]+/,
      '$1' + paypalClientId
    );
  }

  // JPソーシャルフィード注入
  
  const socialHtml = `
<div style="max-width:700px;margin:20px auto;padding:0 20px">
  <div style="background:rgba(255,255,255,.06);border-radius:16px;padding:20px;border:1px solid rgba(255,255,255,.1)">
    <h2 style="font-size:1.1rem;margin-bottom:12px;display:flex;align-items:center;gap:8px">
      💬 最近の投稿
      <a href="https://mascodex-social.pages.dev" target="_blank"
         style="font-size:.7rem;font-weight:400;opacity:.5;text-decoration:none;margin-left:auto">
        mascodex social ↗
      </a>
    </h2>
    <div id="jp-social-feed" style="opacity:.4;font-size:.85rem">読み込み中...</div>
  </div>
</div>
<script>
(function(){
  fetch('https://mascot-social.taiichifox.workers.dev/users/${jpZip}/outbox')
    .then(function(r){return r.ok?r.json():null})
    .then(function(d){
      if(!d)return;
      var items=d.orderedItems||[];
      var el=document.getElementById('jp-social-feed');
      if(!el)return;
      if(!items.length){el.innerHTML='まだ投稿がありません';el.style.opacity='.4';return;}
      el.style.opacity='1';
      el.innerHTML=items.slice(0,5).map(function(p){
        var c=(p.object&&p.object.content)||'';
        var t=p.published?new Date(p.published).toLocaleDateString('ja-JP'):'';
        return '<div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.07)">'
          +'<div style="font-size:.88rem;line-height:1.7;color:#fff">'+c+'</div>'
          +'<div style="font-size:.72rem;opacity:.4;margin-top:4px">'+t+'</div></div>';
      }).join('');
    }).catch(function(){});
})();
</script>`;
  html = html.replace('</body>', socialHtml + '</body>');

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=600',
    },
  });
}

function buildProductSection(code) {
  const mockupBase = `https://img.mascodex.com/mockups/${code}`;
  const shopBase = `/shop-product.html?charId=${code}&variant=01`;

  const products = [
    { type: 'tshirt',  label: 'Tシャツ',       price: '$28.00', bg: '#f2f1ef' },
    { type: 'mug',     label: 'マグカップ',     price: '$18.00', bg: '#f0edea' },



  ];

  // Try CDN cached mockup first, fallback to compose API (generates + caches automatically)
  const composeBase = `/api/mockup/compose/${code}`;
  const cards = products.map(p => `
        <a href="${shopBase}&product=${p.type}" class="prod-card">
          <div class="mk mk-${p.type}" style="background:${p.bg}">
            <img class="mk-img" src="${mockupBase}_${p.type}.jpg?v=3"
                 onerror="this.onerror=null;this.src='${composeBase}?product=${p.type}&v=2'" loading="lazy" alt="${p.label}">
          </div>
          <div class="prod-info">
            <div class="prod-type">${p.label}</div>
            <div class="prod-price">${p.price}</div>
          </div>
        </a>`).join('');

  return `
    <style>
      .products-preview{margin-top:28px;margin-bottom:24px}
      .products-preview h3{font-size:1.1rem;font-weight:700;margin-bottom:14px;padding-left:12px;border-left:3px solid #ffdd57;color:rgba(255,255,255,.9)}
      .products-scroll{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
      .prod-card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:14px;overflow:hidden;text-decoration:none;color:#fff;transition:transform .2s,box-shadow .2s}
      .prod-card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,.25)}
      .prod-info{padding:10px;text-align:center}
      .prod-type{font-size:.7rem;color:#ffdd57;font-weight:600;margin-bottom:2px}
      .prod-price{font-size:.8rem;opacity:.7}

      .mk{position:relative;width:100%;aspect-ratio:1;overflow:hidden;border-radius:14px 14px 0 0}
      .mk-img{width:100%;height:100%;object-fit:cover;display:block}
      @media(max-width:500px){.products-scroll{gap:6px}.prod-info{padding:8px}.prod-type{font-size:.65rem}.prod-price{font-size:.7rem}}
    </style>
    <div class="products-preview">
      <h3>グッズ</h3>
      <div class="products-scroll">${cards}</div>
    </div>`;
}
