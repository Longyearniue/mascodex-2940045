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

  const html = await obj.text();

  // Inject shop widget (India version)
  const injected = html.replace('</body>', '<script src="/js/shop-widget.js" defer></script></body>');

  return new Response(injected, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
