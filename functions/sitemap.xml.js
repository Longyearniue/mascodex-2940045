export async function onRequest(context) {
  const base = 'https://mascodex.com';
  const entries = Array.from({length: 20}, (_,i) =>
    `  <sitemap><loc>${base}/api/sitemap/${String(i).padStart(2,'0')}</loc></sitemap>`
  ).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' }
  });
}
