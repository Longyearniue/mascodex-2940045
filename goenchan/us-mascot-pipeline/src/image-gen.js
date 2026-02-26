#!/usr/bin/env node
/**
 * Batch Image Generator (parallel)
 * Reads profiles and calls the image generation Worker for each ZIP × 2 variants.
 *
 * Usage:
 *   node src/image-gen.js --zips=10001,90210,60601
 *   node src/image-gen.js --state=NY --limit=50
 *   node src/image-gen.js --concurrency=5           # 5 parallel requests
 *   node src/image-gen.js                           # All profiles
 *
 * Supports parallel requests with --concurrency (default: 5).
 * Resume: Worker checks R2 and returns skipped=true for existing images.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const PROFILES_DIR = path.join(__dirname, '..', 'data', 'profiles');
const WORKER_URL = 'https://us-mascot-image-gen.taiichifox.workers.dev';
const VARIANTS = [1, 2];
const DEFAULT_CONCURRENCY = 5;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--(\w+)=(.+)$/);
    if (match) {
      args[match[1]] = match[2];
    }
  }
  return args;
}

/**
 * POST to image generation Worker.
 */
function generateImage(zipCode, prompt, variant) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ zipCode, prompt, variant });
    const parsedUrl = new URL(WORKER_URL);

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Worker HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Process a batch of tasks concurrently with a limit.
 */
async function parallelLimit(tasks, concurrency) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const args = parseArgs();
  const concurrency = parseInt(args.concurrency || DEFAULT_CONCURRENCY, 10);

  // Get profile files to process
  let profileFiles = fs.readdirSync(PROFILES_DIR).filter(f => f.endsWith('.json'));

  if (args.zips) {
    const zips = new Set(args.zips.split(',').map(z => z.trim().padStart(5, '0')));
    profileFiles = profileFiles.filter(f => zips.has(f.replace('.json', '')));
  }
  if (args.limit) {
    profileFiles = profileFiles.slice(0, parseInt(args.limit, 10));
  }

  // Build all tasks
  const allTasks = [];
  for (const file of profileFiles) {
    const profile = JSON.parse(fs.readFileSync(path.join(PROFILES_DIR, file), 'utf8'));
    const zipCode = profile.zipCode?.toString().padStart(5, '0');

    for (const variant of VARIANTS) {
      let prompt = profile.sdPrompt || '';
      if (variant === 2) {
        prompt = prompt.replace('white background', 'soft gradient background');
      }
      allTasks.push({ zipCode, prompt, variant });
    }
  }

  const totalImages = allTasks.length;
  console.log(`\n=== US Mascot Pipeline: Image Generation ===`);
  console.log(`  Profiles: ${profileFiles.length}`);
  console.log(`  Variants: ${VARIANTS.length}`);
  console.log(`  Total images: ${totalImages}`);
  console.log(`  Concurrency: ${concurrency}`);
  console.log('');

  let generated = 0;
  let skipped = 0;
  let errors = 0;
  let completed = 0;

  const taskFns = allTasks.map((task, idx) => async () => {
    const { zipCode, prompt, variant } = task;
    try {
      const result = await generateImage(zipCode, prompt, variant);
      completed++;

      if (result.skipped) {
        skipped++;
        console.log(`  [${completed}/${totalImages}] ${zipCode} v${variant}: SKIPPED`);
      } else {
        generated++;
        console.log(`  [${completed}/${totalImages}] ${zipCode} v${variant}: OK`);
      }
      return result;
    } catch (err) {
      completed++;
      errors++;
      console.error(`  [${completed}/${totalImages}] ${zipCode} v${variant}: ERROR - ${err.message}`);
      return null;
    }
  });

  await parallelLimit(taskFns, concurrency);

  console.log(`\n=== Image Generation Complete ===`);
  console.log(`  Generated: ${generated}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Errors:    ${errors}`);
  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
