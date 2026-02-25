// Serve character pages from R2
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

  return new Response(obj.body, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
