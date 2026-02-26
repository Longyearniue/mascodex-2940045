#!/usr/bin/env node
/**
 * Batch Image Generator
 * Reads profiles and calls the image generation Worker for each ZIP × 2 variants.
 *
 * Usage:
 *   node src/image-gen.js --zips=10001,90210,60601
 *   node src/image-gen.js --state=NY --limit=50
 *   node src/image-gen.js                           # All profiles
 *
 * Rate limited: 1 request per 5 seconds (conservative for Workers AI).
 * Resume: Worker checks R2 and returns skipped=true for existing images.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const PROFILES_DIR = path.join(__dirname, '..', 'data', 'profiles');
const WORKER_URL = 'https://us-mascot-image-gen.taiichifox.workers.dev';
const VARIANTS = [1, 2];
const DELAY_MS = 5000;

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

async function main() {
  const args = parseArgs();

  // Get profile files to process
  let profileFiles = fs.readdirSync(PROFILES_DIR).filter(f => f.endsWith('.json'));

  if (args.zips) {
    const zips = new Set(args.zips.split(',').map(z => z.trim().padStart(5, '0')));
    profileFiles = profileFiles.filter(f => zips.has(f.replace('.json', '')));
  }
  if (args.limit) {
    profileFiles = profileFiles.slice(0, parseInt(args.limit, 10));
  }

  const totalImages = profileFiles.length * VARIANTS.length;
  console.log(`\n=== US Mascot Pipeline: Image Generation ===`);
  console.log(`  Profiles: ${profileFiles.length}`);
  console.log(`  Variants: ${VARIANTS.length}`);
  console.log(`  Total images: ${totalImages}`);
  console.log(`  Estimated time: ~${Math.ceil(totalImages * DELAY_MS / 60000)} min`);
  console.log('');

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < profileFiles.length; i++) {
    const file = profileFiles[i];
    const profile = JSON.parse(fs.readFileSync(path.join(PROFILES_DIR, file), 'utf8'));
    const zipCode = profile.zipCode?.toString().padStart(5, '0');

    for (const variant of VARIANTS) {
      const label = `[${generated + skipped + errors + 1}/${totalImages}]`;

      // Modify prompt slightly for variant 2
      let prompt = profile.sdPrompt || '';
      if (variant === 2) {
        prompt = prompt.replace('white background', 'soft gradient background');
      }

      try {
        console.log(`  ${label} ${zipCode} v${variant}: generating...`);
        const result = await generateImage(zipCode, prompt, variant);

        if (result.skipped) {
          console.log(`    -> SKIPPED (already exists)`);
          skipped++;
        } else {
          console.log(`    -> OK: ${result.key}`);
          generated++;
        }
      } catch (err) {
        console.error(`    -> ERROR: ${err.message}`);
        errors++;
      }

      // Rate limit
      await sleep(DELAY_MS);
    }

    if ((i + 1) % 5 === 0) {
      console.log(`  --- Progress: ${i + 1}/${profileFiles.length} ZIPs (${generated} new, ${skipped} skipped, ${errors} errors) ---`);
    }
  }

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
