#!/usr/bin/env node
/**
 * Batch Runner - Orchestrates the India data collection pipeline.
 *
 * Usage:
 *   node src/collect-all.js --state=DL --limit=10
 *   node src/collect-all.js --pins=110001,400001,560001
 *   node src/collect-all.js --prefix=11 --limit=5
 *   node src/collect-all.js                          # All PINs
 *
 * Flow (2-step, no OSM POIs for India):
 *   1. Load India PIN codes from CSV
 *   2. Collect Wikipedia data per unique city+state (1.1s rate limit)
 *   3. Merge -> save to data/merged/{pinCode}.json
 *
 * Features:
 *   - Resume support: skips already-processed PIN codes
 *   - Progress logging every 10 items
 */

const fs = require('fs');
const path = require('path');
const { getPinCodes } = require('./in-postal');
const { collectWikiBatch } = require('./wiki');

const MERGED_DIR = path.join(__dirname, '..', 'data', 'merged');

/**
 * Parse CLI arguments.
 */
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

async function main() {
  const args = parseArgs();

  const opts = {};
  if (args.pins) {
    opts.pins = args.pins.split(',').map(p => p.trim());
  }
  if (args.state) opts.state = args.state;
  if (args.prefix) opts.prefix = args.prefix;
  if (args.limit) opts.limit = parseInt(args.limit, 10);

  console.log(`\n=== India Mascot Pipeline: Data Collection ===`);
  if (opts.pins) console.log(`  PINs: ${opts.pins.join(', ')}`);
  if (opts.state) console.log(`  State: ${opts.state}`);
  if (opts.prefix) console.log(`  Prefix: ${opts.prefix}`);
  if (opts.limit) console.log(`  Limit: ${opts.limit}`);
  console.log('');

  // Ensure output directories exist
  if (!fs.existsSync(MERGED_DIR)) {
    fs.mkdirSync(MERGED_DIR, { recursive: true });
  }

  // Step 1: Load PIN codes
  console.log('[1/2] Loading India PIN codes...');
  const pinCodes = getPinCodes(opts);
  console.log(`  Found ${pinCodes.length} PIN codes\n`);

  if (pinCodes.length === 0) {
    console.error('No PIN codes found for the given filters.');
    process.exit(1);
  }

  // Check which are already processed (resume support)
  const toProcess = pinCodes.filter(pc => {
    const mergedPath = path.join(MERGED_DIR, `${pc.pinCode}.json`);
    return !fs.existsSync(mergedPath);
  });

  const skipped = pinCodes.length - toProcess.length;
  if (skipped > 0) {
    console.log(`  Skipping ${skipped} already-processed PIN codes.`);
  }
  console.log(`  Processing ${toProcess.length} PIN codes.\n`);

  if (toProcess.length === 0) {
    console.log('All PIN codes already processed. Nothing to do.');
    displaySummary(pinCodes);
    return;
  }

  // Step 2: Collect Wikipedia data per unique city+state
  console.log('[2/2] Collecting Wikipedia data...');
  const cityEntries = toProcess
    .filter(pc => pc.city)
    .map(pc => ({ city: pc.city, stateName: pc.stateName }));
  const uniqueCount = new Set(cityEntries.map(e => `${e.city}_${e.stateName}`)).size;
  console.log(`  ${uniqueCount} unique cities to look up.`);
  const wikiMap = await collectWikiBatch(cityEntries);
  console.log(`  Wikipedia data collected.\n`);

  // Merge and save
  console.log('Saving merged output...');
  for (const pc of toProcess) {
    const wikiKey = `${pc.city}_${pc.stateName}`;
    const wikiData = wikiMap.get(wikiKey) || { summary: '', description: '' };
    const merged = {
      pinCode: pc.pinCode,
      city: pc.city,
      state: pc.state,
      stateName: pc.stateName,
      district: pc.district,
      lat: pc.lat,
      lng: pc.lng,
      wiki: {
        summary: wikiData.summary,
        description: wikiData.description,
      },
    };

    const outPath = path.join(MERGED_DIR, `${pc.pinCode}.json`);
    fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), 'utf8');
  }
  console.log(`  Saved ${toProcess.length} merged files.`);

  console.log('\n=== Collection Complete ===');
  displaySummary(pinCodes);
}

function displaySummary(pinCodes) {
  console.log(`\nSummary:`);
  let mergedCount = 0;
  let withWiki = 0;
  for (const pc of pinCodes) {
    const mergedPath = path.join(MERGED_DIR, `${pc.pinCode}.json`);
    if (fs.existsSync(mergedPath)) {
      mergedCount++;
      try {
        const data = JSON.parse(fs.readFileSync(mergedPath, 'utf8'));
        if (data.wiki && data.wiki.summary) withWiki++;
      } catch {}
    }
  }
  console.log(`  Merged files: ${mergedCount}/${pinCodes.length}`);
  console.log(`  With Wikipedia data: ${withWiki}`);
  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
