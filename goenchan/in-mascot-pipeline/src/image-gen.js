#!/usr/bin/env node
/**
 * India Mascot Pipeline: Batch Image Generator (parallel)
 * Reads profiles and calls the image generation Worker for each PIN x 2 variants.
 *
 * Usage:
 *   node src/image-gen.js --pins=110001,400001,560001
 *   node src/image-gen.js --state=DL --limit=50
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
const WORKER_URL = 'https://in-mascot-image-gen.taiichifox.workers.dev';
const DEFAULT_VARIANTS = [1, 2];
const DEFAULT_CONCURRENCY = 5;
const NEGATIVE_PROMPT = 'low quality, text, letters, watermark, blurry, bad anatomy, cropped, disfigured, duplicate, extra limbs, realistic human, photograph, multiple characters, group, crowd, duo, pair, two characters, many characters, multiple mascots, split image, collage';

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
function generateImage(pinCode, prompt, variant, negative_prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ pinCode, prompt, negative_prompt, variant });
    const parsedUrl = new URL(WORKER_URL);

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      method: 'POST',
      timeout: 60000,
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

    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Request timeout (60s)'));
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
  const variants = args.variants ? Array.from({length: parseInt(args.variants, 10)}, (_, i) => i + 1) : DEFAULT_VARIANTS;

  // Get profile files to process
  let profileFiles = fs.readdirSync(PROFILES_DIR).filter(f => f.endsWith('.json'));

  if (args.pins) {
    const pins = new Set(args.pins.split(',').map(p => p.trim().padStart(6, '0')));
    profileFiles = profileFiles.filter(f => pins.has(f.replace('.json', '')));
  }
  if (args.state) {
    // Filter by state code - need to read merged data
    const MERGED_DIR = path.join(__dirname, '..', 'data', 'merged');
    profileFiles = profileFiles.filter(f => {
      const mergedPath = path.join(MERGED_DIR, f);
      if (fs.existsSync(mergedPath)) {
        const merged = JSON.parse(fs.readFileSync(mergedPath, 'utf8'));
        return merged.state === args.state;
      }
      return false;
    });
  }
  if (args.limit) {
    profileFiles = profileFiles.slice(0, parseInt(args.limit, 10));
  }

  // Build all tasks
  const allTasks = [];
  for (const file of profileFiles) {
    const profile = JSON.parse(fs.readFileSync(path.join(PROFILES_DIR, file), 'utf8'));
    const pinCode = profile.pinCode?.toString().padStart(6, '0');

    for (const variant of variants) {
      let prompt = profile.sdPrompt || '';
      if (variant === 2) {
        prompt = prompt.replace('white background', 'soft gradient background');
      }
      const negative = profile.negativePrompt || NEGATIVE_PROMPT;
      allTasks.push({ pinCode, prompt, variant, negative_prompt: negative });
    }
  }

  const totalImages = allTasks.length;
  console.log(`\n=== India Mascot Pipeline: Image Generation ===`);
  console.log(`  Profiles: ${profileFiles.length}`);
  console.log(`  Variants: ${variants.length}`);
  console.log(`  Total images: ${totalImages}`);
  console.log(`  Concurrency: ${concurrency}`);
  console.log('');

  let generated = 0;
  let skipped = 0;
  let errors = 0;
  let completed = 0;

  const MAX_RETRIES = 3;
  const taskFns = allTasks.map((task, idx) => async () => {
    const { pinCode, prompt, variant, negative_prompt } = task;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await generateImage(pinCode, prompt, variant, negative_prompt);
        completed++;

        if (result.skipped) {
          skipped++;
          if (completed % 500 === 0) console.log(`  [${completed}/${totalImages}] ${pinCode} v${variant}: SKIPPED`);
        } else {
          generated++;
          if (completed % 100 === 0 || completed <= 20) console.log(`  [${completed}/${totalImages}] ${pinCode} v${variant}: OK (gen=${generated} skip=${skipped} err=${errors})`);
        }
        return result;
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          console.error(`  [retry ${attempt+1}/${MAX_RETRIES}] ${pinCode} v${variant}: ${err.message}`);
          await sleep(3000 * (attempt + 1));
          continue;
        }
        completed++;
        errors++;
        console.error(`  [${completed}/${totalImages}] ${pinCode} v${variant}: FAILED - ${err.message}`);
        return null;
      }
    }
  });

  await parallelLimit(taskFns, concurrency);

  console.log(`\n=== India Image Generation Complete ===`);
  console.log(`  Generated: ${generated}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Errors:    ${errors}`);
  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
