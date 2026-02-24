const fs = require('fs');
const path = require('path');
const { parseCharacterPage } = require('./parse');
const { generateCharacterHTML } = require('./template');

const ZIP_TREE_PATH = path.join(__dirname, '../../backups/mascodex-top-backup/zip-tree.json');
const OUTPUT_DIR = path.join(__dirname, 'output');

function computeSubdomain(postalCode) {
  const p2 = parseInt(postalCode.slice(0, 2), 10);
  if (p2 < 90) return 'jp' + String(Math.floor(p2 / 10)).padStart(2, '0');
  if (p2 <= 94) return 'jp09a';
  return 'jp09b';
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
      if (res.status === 404) return null;
    } catch (e) {
      if (i === retries - 1) throw e;
    }
    await new Promise(r => setTimeout(r, 500 * (i + 1)));
  }
  return null;
}

async function processBatch(postalCodes, batchNum, totalBatches) {
  const results = await Promise.allSettled(
    postalCodes.map(async (code) => {
      const subdomain = computeSubdomain(code);
      const url = `https://${subdomain}.mascodex.com/jp/${code}/`;
      const html = await fetchWithRetry(url);
      if (!html) return { code, success: false };

      const charData = parseCharacterPage(html);
      if (!charData.name) return { code, success: false };

      const pageHtml = generateCharacterHTML(charData);
      const dir = path.join(OUTPUT_DIR, code);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), pageHtml);

      return { code, success: true, name: charData.name };
    })
  );

  const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.filter(r => r.status !== 'fulfilled' || !r.value.success).length;
  console.log(`Batch ${batchNum}/${totalBatches}: ${succeeded} ok, ${failed} failed`);
  return { succeeded, failed };
}

async function main() {
  // Load all postal codes from zip-tree.json
  const zipTree = JSON.parse(fs.readFileSync(ZIP_TREE_PATH, 'utf-8'));
  const allCodes = [];
  for (const pref of Object.values(zipTree)) {
    for (const city of Object.values(pref)) {
      for (const code of Object.values(city)) {
        allCodes.push(code);
      }
    }
  }
  console.log(`Total postal codes: ${allCodes.length}`);

  // Clean output dir
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Process in batches of 30
  const BATCH_SIZE = 30;
  const batches = [];
  for (let i = 0; i < allCodes.length; i += BATCH_SIZE) {
    batches.push(allCodes.slice(i, i + BATCH_SIZE));
  }

  let totalOk = 0, totalFail = 0;
  for (let i = 0; i < batches.length; i++) {
    const { succeeded, failed } = await processBatch(batches[i], i + 1, batches.length);
    totalOk += succeeded;
    totalFail += failed;
    // Rate limit: 100ms between batches
    if (i < batches.length - 1) await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\nDone! Generated: ${totalOk}, Failed: ${totalFail}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
}

main().catch(console.error);
