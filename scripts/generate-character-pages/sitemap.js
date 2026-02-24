const fs = require('fs');
const path = require('path');

const ZIP_TREE_PATH = path.join(__dirname, '../../backups/mascodex-top-backup/zip-tree.json');
const OUTPUT_DIR = path.join(__dirname, 'output');
const BASE_URL = 'https://characters.mascodex.com';

function main() {
  const zipTree = JSON.parse(fs.readFileSync(ZIP_TREE_PATH, 'utf-8'));

  // Ensure output dir exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Group postal codes by first 2 digits
  const groups = {};
  for (const pref of Object.values(zipTree)) {
    for (const city of Object.values(pref)) {
      for (const code of Object.values(city)) {
        const prefix = code.slice(0, 2);
        if (!groups[prefix]) groups[prefix] = [];
        groups[prefix].push(code);
      }
    }
  }

  // Generate individual sitemaps per prefix group
  const sitemapFiles = [];
  let totalUrls = 0;
  for (const [prefix, codes] of Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))) {
    const urls = codes.map(code =>
      `  <url><loc>${BASE_URL}/${code}/</loc><changefreq>monthly</changefreq></url>`
    ).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

    const filename = `sitemap-${prefix}.xml`;
    fs.writeFileSync(path.join(OUTPUT_DIR, filename), xml);
    sitemapFiles.push(filename);
    totalUrls += codes.length;
  }

  // Generate sitemap index
  const indexEntries = sitemapFiles.map(f =>
    `  <sitemap><loc>${BASE_URL}/${f}</loc></sitemap>`
  ).join('\n');

  const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexEntries}
</sitemapindex>`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'sitemap-index.xml'), indexXml);

  // Generate robots.txt
  fs.writeFileSync(path.join(OUTPUT_DIR, 'robots.txt'),
    `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap-index.xml\n`);

  console.log(`Generated ${sitemapFiles.length} sitemaps (${totalUrls} URLs) + sitemap-index.xml + robots.txt`);
}

main();
