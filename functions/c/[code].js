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
  html = html.replace(
    '<div class="links">',
    productSection + '<div class="links">'
  );
  // Social feed injection
  const jpZip = 'JP' + code;
  const socialScript = `<style>.social-post{padding:10px 0;border-bottom:1px solid rgba(255,255,255,.07);}.social-post:last-child{border-bottom:none;}.social-post-content{font-size:.88rem;line-height:1.6;opacity:.88;}.social-post-meta{font-size:.7rem;opacity:.38;margin-top:4px;}</style><div class="section" id="mascot-social" style="background:rgba(255,255,255,.04);border-radius:16px;padding:20px;margin-bottom:20px"><h2 style="font-size:1.1rem;margin-bottom:12px;display:flex;align-items:center;gap:8px">💬 最近のつぶやき<a href="https://social.mascodex.com/users/JP${code}" target="_blank" style="font-size:.7rem;font-weight:400;opacity:.4;text-decoration:none;margin-left:auto">@JP${code}@social.mascodex.com ↗</a></h2><div id="social-feed-posts"><div style="opacity:.4;font-size:.85rem">読み込み中...</div></div></div><script>(function(){fetch('https://social.mascodex.com/users/JP${code}/outbox').then(function(r){return r.ok?r.json():null}).then(function(d){if(!d)return;var items=(d.orderedItems||[]);var el=document.getElementById('social-feed-posts');if(!items.length){el.innerHTML='<div style="opacity:.4;font-size:.85rem">まだ投稿がありません</div>';return;}el.innerHTML=items.slice(0,5).map(function(p){var raw=(p.object&&p.object.content)||p.content||'';var c=raw.replace(/^#[^\\n]+\\n*/,'').substring(0,140);var t=p.published?new Date(p.published).toLocaleDateString('ja-JP'):'';return '<div class="social-post"><div class="social-post-content">'+c+(c.length>=140?'…':'')+'</div><div class="social-post-meta">'+t+'</div></div>';}).join('');}).catch(function(){});})();<\/script>`;

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
  const jpZip = 'JP' + code;
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
    { type: 'tote',    label: 'トートバッグ',   price: '$35.00', bg: '#f0ede6' },
    { type: 'pillow',  label: 'クッション',     price: '$25.00', bg: '#eef0ed' },
    { type: 'poster',  label: 'ポスター',       price: '$25.00', bg: '#f0ece2' },
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
