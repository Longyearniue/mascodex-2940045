/**
 * US Character Page Handler
 * Serves US mascot character pages from US_CHAR_R2.
 * URL: /us/c/{zipCode}
 */
export async function onRequestGet(context) {
  const { code } = context.params;

  // Validate 5-digit US ZIP code
  if (!/^\d{5}$/.test(code)) {
    return new Response('Not Found', { status: 404 });
  }

  const obj = await context.env.US_CHAR_R2.get(`us/${code}/index.html`);
  if (!obj) {
    return new Response('Not Found', { status: 404 });
  }

  const html = await obj.text();

  // Inject shop widget (US version)
  const injected = html.replace('</body>', '<script src="/js/shop-widget.js" defer></script></body>');

  return new Response(injected, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
