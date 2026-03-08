(function () {
  'use strict';

  // Only run on character pages where POSTAL is defined
  if (typeof POSTAL === 'undefined') return;

  var PRODUCT_TYPES = [
    { type: 'tshirt',  label: 'T-Shirt',      name: 'T-Shirt',       price: '$28.00', icon: '👕' },
    { type: 'mug',     label: 'Mug',           name: 'Mug',    price: '$18.00', icon: '☕' },
    { type: 'case',    label: 'iPhone Case',   name: 'iPhone Case',  price: '$25.00', icon: '📱' },
    { type: 'sticker', label: 'Sticker',       name: 'Sticker',    price: '$6.00',  icon: '✨' },
  ];

  var IMG_CDN = 'https://img.mascodex.com/';
  var charImg = IMG_CDN + POSTAL + '_01.png';

  // --- Inject CSS ---
  var style = document.createElement('style');
  style.textContent = [
    '.mcx-shop-section{margin-top:24px;}',
    '.mcx-shop-title{font-size:1.1rem;font-weight:700;margin-bottom:14px;padding-left:12px;border-left:3px solid #667eea;}',
    '.mcx-shop-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;}',
    '.mcx-shop-card{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;transition:transform 0.3s;cursor:pointer;text-decoration:none;color:#fff;display:block;}',
    '.mcx-shop-card:hover{transform:translateY(-4px);border-color:rgba(102,126,234,0.3);}',
    '.mcx-card-img{position:relative;width:100%;aspect-ratio:1;background:linear-gradient(135deg,#1a1640,#2a2260);overflow:hidden;}',
    '.mcx-card-img img{display:block;width:100%;height:100%;object-fit:cover;}',
    '.mcx-card-img .mcx-badge{position:absolute;top:8px;right:8px;background:rgba(102,126,234,0.85);backdrop-filter:blur(4px);color:#fff;font-size:.65rem;font-weight:700;padding:3px 8px;border-radius:10px;text-transform:uppercase;letter-spacing:.5px;}',
    '.mcx-card-info{padding:10px 12px;text-align:center;}',
    '.mcx-card-type{font-size:.7rem;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;}',
    '.mcx-card-name{font-weight:600;font-size:.85rem;margin-bottom:4px;}',
    '.mcx-card-price{color:#ffdd57;font-weight:700;font-size:.9rem;}',
    '@media(max-width:500px){',
    '  .mcx-shop-grid{gap:8px;}',
    '  .mcx-card-info{padding:8px 10px;}',
    '  .mcx-card-name{font-size:.78rem;}',
    '}'
  ].join('\n');
  document.head.appendChild(style);

  // --- Build section ---
  var section = document.createElement('div');
  section.className = 'mcx-shop-section';

  var title = document.createElement('div');
  title.className = 'mcx-shop-title';
  title.textContent = 'Original Merch';
  section.appendChild(title);

  var grid = document.createElement('div');
  grid.className = 'mcx-shop-grid';

  var imgRefs = [];

  PRODUCT_TYPES.forEach(function (p) {
    var card = document.createElement('a');
    card.className = 'mcx-shop-card';
    card.href = '/shop-product?charId=' + POSTAL + '&variant=01&product=' + p.type;

    var imgWrap = document.createElement('div');
    imgWrap.className = 'mcx-card-img';

    var img = document.createElement('img');
    img.src = charImg;
    img.alt = p.name;
    imgRefs.push(img);

    var badge = document.createElement('div');
    badge.className = 'mcx-badge';
    badge.textContent = p.icon + ' ' + p.label;

    imgWrap.appendChild(img);
    imgWrap.appendChild(badge);

    var info = document.createElement('div');
    info.className = 'mcx-card-info';
    info.innerHTML =
      '<div class="mcx-card-type">' + p.label + '</div>' +
      '<div class="mcx-card-name">' + p.name + '</div>' +
      '<div class="mcx-card-price">' + p.price + '</div>';

    card.appendChild(imgWrap);
    card.appendChild(info);
    grid.appendChild(card);
  });

  section.appendChild(grid);

  // --- Insert after .chat-widget ---
  function insertSection() {
    var chatWidget = document.querySelector('.chat-widget');
    if (chatWidget && chatWidget.parentNode) {
      chatWidget.parentNode.insertBefore(section, chatWidget.nextSibling);
    } else {
      var links = document.querySelector('.links');
      var footer = document.querySelector('.footer');
      var target = links || footer;
      if (target && target.parentNode) {
        target.parentNode.insertBefore(section, target);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', insertSection);
  } else {
    insertSection();
  }

  // --- Fetch mockup images with staggered timing ---
  // Each product fetches on its own delay to avoid concurrent connection issues
  PRODUCT_TYPES.forEach(function (p, i) {
    setTimeout(function () {
      fetch('/api/shop/mockup/' + POSTAL + '?product=' + p.type)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.success && data.mockup && data.mockup.status === 'completed' &&
              data.mockup.mockups && data.mockup.mockups.length > 0) {
            var url = data.mockup.mockups[0].imageUrl;
            if (url && imgRefs[i]) {
              imgRefs[i].src = url;
            }
          }
        })
        .catch(function () { /* keep character image */ });
    }, i * 200);
  });
})();
