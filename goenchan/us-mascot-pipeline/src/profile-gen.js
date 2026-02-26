#!/usr/bin/env node
/**
 * Character Profile Generator
 * Uses Claude API to generate unique mascot profiles for US ZIP codes.
 *
 * Usage:
 *   node src/profile-gen.js --zips=10001,90210,60601
 *   node src/profile-gen.js --state=NY --limit=50
 *   node src/profile-gen.js                           # All merged ZIPs
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 *
 * Batches 10 ZIPs per Claude API call to reduce cost.
 * Resume: skips existing profile files.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const MERGED_DIR = path.join(__dirname, '..', 'data', 'merged');
const PROFILES_DIR = path.join(__dirname, '..', 'data', 'profiles');

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-haiku-4-5-20251001';
const BATCH_SIZE = 10;

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
 * Call Claude API.
 */
function callClaude(messages, retries = 3) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages,
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 429 && retries > 0) {
          console.log(`    Rate limited, retrying in 5s...`);
          sleep(5000).then(() => callClaude(messages, retries - 1).then(resolve).catch(reject));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Claude API ${res.statusCode}: ${data.substring(0, 300)}`));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const text = parsed.content?.[0]?.text || '';
          resolve(text);
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
 * Build prompt for a batch of ZIP codes.
 */
function buildPrompt(batch) {
  const zipData = batch.map(z => {
    const topPois = [];
    for (const [cat, items] of Object.entries(z.pois || {})) {
      if (items.length > 0) {
        topPois.push(`${cat}: ${items.slice(0, 3).join(', ')}`);
      }
    }
    return `ZIP ${z.zipCode} - ${z.city}, ${z.stateName} (${z.county} County)
  POIs: ${topPois.join(' | ') || 'none'}
  Wiki: ${(z.wiki?.summary || '').substring(0, 200)}`;
  }).join('\n\n');

  return `Generate unique mascot character profiles for each US ZIP code below. Each mascot should reflect the local culture, geography, landmarks, and vibe of that specific area.

For each ZIP code, output a JSON object with these fields:
- "zipCode": the 5-digit ZIP
- "name": A creative English mascot name (pun, portmanteau, or wordplay on local features)
- "catchphrase": A fun one-liner the mascot would say
- "sdPrompt": An SDXL image generation prompt: "cute kawaii mascot character, chibi style, [specific visual details reflecting the area], simple clean design, white background, high quality, mascot illustration"
- "colorPalette": Array of 3 hex colors inspired by the area
- "backstory": 1-2 sentences about the character

Output ONLY a JSON array of objects. No markdown, no explanation.

ZIP Code Data:
${zipData}`;
}

/**
 * Parse Claude's response into individual profiles.
 */
function parseProfiles(text) {
  // Try to extract JSON array
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('No JSON array found in response');
  }
  return JSON.parse(jsonMatch[0]);
}

async function main() {
  if (!API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable required.');
    process.exit(1);
  }

  const args = parseArgs();

  if (!fs.existsSync(PROFILES_DIR)) {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
  }

  // Determine which merged files to process
  let mergedFiles;
  if (args.zips) {
    const zips = args.zips.split(',').map(z => z.trim().padStart(5, '0'));
    mergedFiles = zips.map(z => `${z}.json`).filter(f =>
      fs.existsSync(path.join(MERGED_DIR, f))
    );
  } else {
    mergedFiles = fs.readdirSync(MERGED_DIR).filter(f => f.endsWith('.json'));
    if (args.state) {
      mergedFiles = mergedFiles.filter(f => {
        const data = JSON.parse(fs.readFileSync(path.join(MERGED_DIR, f), 'utf8'));
        return data.state === args.state.toUpperCase();
      });
    }
    if (args.limit) {
      mergedFiles = mergedFiles.slice(0, parseInt(args.limit, 10));
    }
  }

  // Filter out already-processed
  const toProcess = mergedFiles.filter(f => {
    const profilePath = path.join(PROFILES_DIR, f);
    return !fs.existsSync(profilePath);
  });

  console.log(`\n=== US Mascot Pipeline: Profile Generation ===`);
  console.log(`  Total merged: ${mergedFiles.length}`);
  console.log(`  Already done: ${mergedFiles.length - toProcess.length}`);
  console.log(`  To process:   ${toProcess.length}`);
  console.log(`  Batches:      ${Math.ceil(toProcess.length / BATCH_SIZE)}`);
  console.log('');

  if (toProcess.length === 0) {
    console.log('All profiles already generated. Nothing to do.');
    return;
  }

  // Load merged data
  const allData = toProcess.map(f =>
    JSON.parse(fs.readFileSync(path.join(MERGED_DIR, f), 'utf8'))
  );

  // Process in batches
  let generated = 0;
  for (let i = 0; i < allData.length; i += BATCH_SIZE) {
    const batch = allData.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(allData.length / BATCH_SIZE);

    console.log(`[Batch ${batchNum}/${totalBatches}] Generating profiles for ${batch.map(z => z.zipCode).join(', ')}...`);

    try {
      const prompt = buildPrompt(batch);
      const response = await callClaude([{ role: 'user', content: prompt }]);
      const profiles = parseProfiles(response);

      for (const profile of profiles) {
        const zip = profile.zipCode?.toString().padStart(5, '0');
        if (!zip) continue;

        const outPath = path.join(PROFILES_DIR, `${zip}.json`);
        fs.writeFileSync(outPath, JSON.stringify(profile, null, 2), 'utf8');
        generated++;
        console.log(`  -> ${zip}: ${profile.name}`);
      }
    } catch (err) {
      console.error(`  Batch ${batchNum} error: ${err.message}`);
      // Save error info and continue
      for (const z of batch) {
        console.error(`    Skipped ${z.zipCode}`);
      }
    }

    // Rate limit between batches
    if (i + BATCH_SIZE < allData.length) {
      await sleep(1000);
    }
  }

  console.log(`\n=== Profile Generation Complete ===`);
  console.log(`  Generated: ${generated}/${toProcess.length}`);
  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
