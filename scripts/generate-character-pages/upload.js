const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const OUTPUT_DIR = path.join(__dirname, 'output');
const BUCKET = process.env.R2_BUCKET || 'mascodex-characters';
const CONCURRENCY = 200;
const PROGRESS_FILE = path.join(__dirname, `upload-progress-${BUCKET}.json`);

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

function loadProgress() {
  try {
    return new Set(JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8')));
  } catch { return new Set(); }
}

function saveProgress(done) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify([...done]));
}

async function uploadBatch(items) {
  return Promise.allSettled(
    items.map(async ({ key, filePath, contentType }) => {
      const body = fs.readFileSync(filePath);
      await client.send(new PutObjectCommand({
        Bucket: BUCKET, Key: key, Body: body, ContentType: contentType,
      }));
      return key;
    })
  );
}

async function main() {
  if (!process.env.CF_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    console.error('Required env vars: CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
    process.exit(1);
  }

  const done = loadProgress();
  const entries = fs.readdirSync(OUTPUT_DIR);
  const items = [];

  for (const entry of entries) {
    const fullPath = path.join(OUTPUT_DIR, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      const key = entry + '/index.html';
      if (done.has(key)) continue;
      const indexPath = path.join(fullPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        items.push({ key, filePath: indexPath, contentType: 'text/html; charset=utf-8' });
      }
    } else if (entry.endsWith('.xml')) {
      const key = entry;
      if (done.has(key)) continue;
      items.push({ key, filePath: fullPath, contentType: 'application/xml; charset=utf-8' });
    } else if (entry === 'robots.txt') {
      if (done.has('robots.txt')) continue;
      items.push({ key: 'robots.txt', filePath: fullPath, contentType: 'text/plain; charset=utf-8' });
    }
  }

  console.log(`Total files: ${items.length + done.size}, Already uploaded: ${done.size}, Remaining: ${items.length}`);
  console.log(`Concurrency: ${CONCURRENCY}`);

  let uploaded = 0, failed = 0;
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const results = await uploadBatch(batch);

    for (const r of results) {
      if (r.status === 'fulfilled') {
        uploaded++;
        done.add(r.value);
      } else {
        failed++;
      }
    }

    // Save progress every 1000 files
    if ((uploaded + failed) % 1000 < CONCURRENCY) {
      saveProgress(done);
      const rate = uploaded / ((Date.now() - startTime) / 60000);
      const remaining = items.length - i - CONCURRENCY;
      const eta = remaining > 0 ? Math.ceil(remaining / rate) : 0;
      console.log(`Progress: ${done.size}/${items.length + done.size - items.length + uploaded + failed} (${uploaded} new, ${failed} failed) ~${Math.round(rate)}/min ETA:${eta}min`);
    }
  }

  saveProgress(done);
  console.log(`\nDone! Uploaded: ${uploaded}, Failed: ${failed}, Total in R2: ${done.size}`);
}

const startTime = Date.now();
main().catch(console.error);
