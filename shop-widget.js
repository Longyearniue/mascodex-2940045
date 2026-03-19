(function () {
  'use strict';

  // Don't run on the shop pages themselves
  if (/\/(shop|shop-product|shop-order)\.html/.test(location.pathname)) return;

  // --- charId extraction (pathname → title → meta) ---
  function extractCharId() {
    // 1. URL pathname: /charId.html or /charId/
    var m = location.pathname.match(/\/([0-9]{7})(\.html|\/)?$/);
    if (m) return m[1];

    // 2. Page title
    m = (document.title || '').match(/([0-9]{7})/);
    if (m) return m[1];

    // 3. Meta tag
    var meta = document.querySelector('meta[name="charId"], meta[name="char-id"]');
    if (meta) return meta.content.trim();

    return null;
  }

  // --- charName extraction ---
  function extractCharName() {
    var h1 = document.querySelector('h1');
    if (h1 && h1.textContent.trim()) return h1.textContent.trim();
    return null;
  }

  var charId = extractCharId();
  if (!charId) return; // No charId = not a character page

  var charName = extractCharName() || charId;
  var imgSrc = 'https://img.mascodex.com/' + charId + '_01.png';
  var shopUrl = 'https://mascodex.com/shop-product.html?charId=' + charId + '&variant=01';

  // Placeholder SVG (data URI)
  var placeholderSvg = "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2760%27 height=%2760%27 viewBox=%270 0 60 60%27%3E%3Crect width=%2760%27 height=%2760%27 fill=%27%23e0e0e0%27 rx=%278%27/%3E%3Ctext x=%2730%27 y=%2734%27 text-anchor=%27middle%27 font-size=%2710%27 fill=%27%23999%27 font-family=%27sans-serif%27%3ET-shirt%3C/text%3E%3C/svg%3E";

  // --- Inject CSS ---
  var style = document.createElement('style');
  style.textContent = [
    '#mcx-shop-banner{',
    '  position:fixed;bottom:16px;right:80px;z-index:99998;',
    '  display:flex;align-items:center;gap:10px;',
    '  background:linear-gradient(135deg,#667eea,#764ba2);',
    '  color:#fff;padding:8px 16px 8px 8px;border-radius:40px;',
    '  box-shadow:0 4px 20px rgba(0,0,0,.25);',
    '  cursor:pointer;text-decoration:none;',
    '  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
    '  font-size:14px;font-weight:600;',
    '  transition:transform .2s,box-shadow .2s;',
    '  max-width:calc(100vw - 100px);',
    '}',
    '#mcx-shop-banner:hover{',
    '  transform:translateY(-2px);box-shadow:0 6px 24px rgba(0,0,0,.3);',
    '}',
    '#mcx-shop-banner img{',
    '  width:40px;height:40px;border-radius:50%;object-fit:cover;',
    '  background:#fff;flex-shrink:0;',
    '}',
    '#mcx-shop-banner .mcx-text{',
    '  display:flex;flex-direction:column;line-height:1.3;',
    '}',
    '#mcx-shop-banner .mcx-label{font-size:11px;opacity:.85;font-weight:400;}',
    '#mcx-shop-banner .mcx-price{font-size:13px;opacity:.9;font-weight:500;}',
    '#mcx-shop-banner .mcx-close{',
    '  position:absolute;top:-6px;right:-6px;',
    '  width:20px;height:20px;border-radius:50%;',
    '  background:rgba(0,0,0,.5);color:#fff;border:none;',
    '  font-size:12px;line-height:20px;text-align:center;',
    '  cursor:pointer;padding:0;',
    '}',
    '@media(max-width:480px){',
    '  #mcx-shop-banner{right:12px;bottom:12px;padding:6px 12px 6px 6px;font-size:13px;}',
    '  #mcx-shop-banner img{width:34px;height:34px;}',
    '}'
  ].join('\n');
  document.head.appendChild(style);

  // --- Create banner element ---
  var banner = document.createElement('a');
  banner.id = 'mcx-shop-banner';
  banner.href = shopUrl;
  banner.target = '_blank';
  banner.rel = 'noopener';

  var img = document.createElement('img');
  img.src = imgSrc;
  img.alt = charName;
  img.onerror = function () {
    this.onerror = null;
    this.src = placeholderSvg;
  };

  var textDiv = document.createElement('div');
  textDiv.className = 'mcx-text';
  textDiv.innerHTML = '<span class="mcx-label">T\u30b7\u30e3\u30c4\u3092\u8cb7\u3046</span><span class="mcx-price">$28.00</span>';

  var closeBtn = document.createElement('button');
  closeBtn.className = 'mcx-close';
  closeBtn.textContent = '\u00d7';
  closeBtn.title = '\u9589\u3058\u308b';
  closeBtn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    banner.style.display = 'none';
    try { sessionStorage.setItem('mcx-shop-hidden', '1'); } catch (_) {}
  });

  banner.appendChild(img);
  banner.appendChild(textDiv);
  banner.appendChild(closeBtn);

  // Respect dismiss for this session
  try {
    if (sessionStorage.getItem('mcx-shop-hidden') === '1') return;
  } catch (_) {}

  // Insert when DOM ready
  if (document.body) {
    document.body.appendChild(banner);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.appendChild(banner);
    });
  }
})();
