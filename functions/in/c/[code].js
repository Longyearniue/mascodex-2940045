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

  // Inject shop widget (India version)
  const injected = html.replace('</body>', '<script src="/js/shop-widget.js" defer></script></body>');

  return new Response(injected, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
