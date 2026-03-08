#!/usr/bin/env node
/**
 * Batch Runner - Orchestrates the full US data collection pipeline.
 *
 * Usage:
 *   node src/collect-all.js --state=NY --limit=10
 *   node src/collect-all.js --zips=10001,90210,60601
 *   node src/collect-all.js                          # All ZIPs
 *
 * Flow (3-step, no geocoding needed — CSV has lat/lng):
 *   1. Load US ZIP codes from CSV
 *   2. Collect OSM POIs per ZIP (2s rate limit)
 *   3. Collect Wikipedia data per unique city (1s rate limit)
 *   4. Merge → save to data/merged/{zipCode}.json
 *
 * Features:
 *   - Resume support: skips already-processed ZIP codes
 *   - Progress logging every 10 items
 */

const fs = require('fs');
const path = require('path');
const { getZipCodes } = require('./us-postal');
const { collectPOIs } = require('./osm');
const { collectWikiBatch } = require('./wiki');

const MERGED_DIR = path.join(__dirname, '..', 'data', 'merged');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
  if (args.zips) {
    opts.zips = args.zips.split(',').map(z => z.trim());
  }
  if (args.state) opts.state = args.state;
  if (args.prefix) opts.prefix = args.prefix;
  if (args.limit) opts.limit = parseInt(args.limit, 10);

  console.log(`\n=== US Mascot Pipeline: Data Collection ===`);
  if (opts.zips) console.log(`  ZIPs: ${opts.zips.join(', ')}`);
  if (opts.state) console.log(`  State: ${opts.state}`);
  if (opts.prefix) console.log(`  Prefix: ${opts.prefix}`);
  if (opts.limit) console.log(`  Limit: ${opts.limit}`);
  console.log('');

  // Ensure output directories exist
  if (!fs.existsSync(MERGED_DIR)) {
    fs.mkdirSync(MERGED_DIR, { recursive: true });
  }

  // Step 1: Load ZIP codes
  console.log('[1/3] Loading US ZIP codes...');
  const zipCodes = getZipCodes(opts);
  console.log(`  Found ${zipCodes.length} ZIP codes\n`);

  if (zipCodes.length === 0) {
    console.error('No ZIP codes found for the given filters.');
    process.exit(1);
  }

  // Check which are already processed (resume support)
  const toProcess = zipCodes.filter(zc => {
    const mergedPath = path.join(MERGED_DIR, `${zc.zipCode}.json`);
    return !fs.existsSync(mergedPath);
  });

  const skipped = zipCodes.length - toProcess.length;
  if (skipped > 0) {
    console.log(`  Skipping ${skipped} already-processed ZIP codes.`);
  }
  console.log(`  Processing ${toProcess.length} ZIP codes.\n`);

  if (toProcess.length === 0) {
    console.log('All ZIP codes already processed. Nothing to do.');
    displaySummary(zipCodes);
    return;
  }

  // Step 2: Collect OSM POIs for each ZIP
  console.log('[2/3] Collecting OSM POIs...');
  const withPois = [];
  for (let i = 0; i < toProcess.length; i++) {
    const zc = toProcess[i];
    console.log(`  [${i + 1}/${toProcess.length}] ${zc.zipCode} - ${zc.city}, ${zc.state} (${zc.lat}, ${zc.lng})`);

    const pois = await collectPOIs(zc.zipCode, zc.lat, zc.lng);
    withPois.push({ ...zc, pois });

    const totalPois = Object.values(pois).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`    -> ${totalPois} POIs found`);

    // Rate limit for Overpass: 1 request per 2 seconds
    if (i < toProcess.length - 1) {
      await sleep(2100);
    }

    if ((i + 1) % 10 === 0) {
      console.log(`  --- Progress: ${i + 1}/${toProcess.length} POIs collected ---`);
    }
  }
  console.log(`  POIs collected for ${withPois.length} ZIP codes.\n`);

  // Step 3: Collect Wikipedia data per unique city+state
  console.log('[3/3] Collecting Wikipedia data...');
  const cityEntries = withPois
    .filter(zc => zc.city)
    .map(zc => ({ city: zc.city, stateName: zc.stateName }));
  const uniqueCount = new Set(cityEntries.map(e => `${e.city}_${e.stateName}`)).size;
  console.log(`  ${uniqueCount} unique cities to look up.`);
  const wikiMap = await collectWikiBatch(cityEntries);
  console.log(`  Wikipedia data collected.\n`);

  // Merge and save
  console.log('Saving merged output...');
  for (const zc of withPois) {
    const wikiKey = `${zc.city}_${zc.stateName}`;
    const wikiData = wikiMap.get(wikiKey) || { summary: '', description: '' };
    const merged = {
      zipCode: zc.zipCode,
      city: zc.city,
      state: zc.state,
      stateName: zc.stateName,
      county: zc.county,
      lat: zc.lat,
      lng: zc.lng,
      pois: zc.pois,
      wiki: {
        summary: wikiData.summary,
        description: wikiData.description,
      },
    };

    const outPath = path.join(MERGED_DIR, `${zc.zipCode}.json`);
    fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), 'utf8');
  }
  console.log(`  Saved ${withPois.length} merged files.`);

  console.log('\n=== Collection Complete ===');
  displaySummary(zipCodes);
}

function displaySummary(zipCodes) {
  console.log(`\nSummary:`);
  let totalPois = 0;
  let mergedCount = 0;
  for (const zc of zipCodes) {
    const mergedPath = path.join(MERGED_DIR, `${zc.zipCode}.json`);
    if (fs.existsSync(mergedPath)) {
      mergedCount++;
      try {
        const data = JSON.parse(fs.readFileSync(mergedPath, 'utf8'));
        const count = Object.values(data.pois || {}).reduce((s, a) => s + a.length, 0);
        totalPois += count;
      } catch {}
    }
  }
  console.log(`  Merged files: ${mergedCount}/${zipCodes.length}`);
  console.log(`  Total POIs:   ${totalPois}`);
  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
