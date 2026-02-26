#!/usr/bin/env node
/**
 * Upload character profiles to US_KV for the chat API.
 * Uses wrangler kv key put.
 *
 * Usage:
 *   node src/upload-kv.js --zips=10001,90210,60601
 *   node src/upload-kv.js                           # All profiles
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROFILES_DIR = path.join(__dirname, '..', 'data', 'profiles');
const MERGED_DIR = path.join(__dirname, '..', 'data', 'merged');
const KV_NAMESPACE_ID = '53c515c4988d4379b2cf231ee3901fdb';

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

function main() {
  const args = parseArgs();

  let files = fs.readdirSync(PROFILES_DIR).filter(f => f.endsWith('.json'));

  if (args.zips) {
    const zips = new Set(args.zips.split(',').map(z => z.trim().padStart(5, '0')));
    files = files.filter(f => zips.has(f.replace('.json', '')));
  }
  if (args.limit) {
    files = files.slice(0, parseInt(args.limit, 10));
  }

  console.log(`\n=== Upload Profiles to US_KV ===`);
  console.log(`  Profiles: ${files.length}\n`);

  let uploaded = 0;
  let errors = 0;

  for (const file of files) {
    const zip = file.replace('.json', '');
    const profile = JSON.parse(fs.readFileSync(path.join(PROFILES_DIR, file), 'utf8'));

    // Merge with merged data for richer context
    const mergedPath = path.join(MERGED_DIR, file);
    if (fs.existsSync(mergedPath)) {
      const merged = JSON.parse(fs.readFileSync(mergedPath, 'utf8'));
      profile.city = merged.city;
      profile.state = merged.state;
      profile.stateName = merged.stateName;
      profile.county = merged.county;
      profile.pois = merged.pois;
      profile.wiki = merged.wiki;
    }

    const key = `us_char_${zip}`;
    const value = JSON.stringify(profile);

    try {
      execSync(
        `wrangler kv key put "${key}" '${value.replace(/'/g, "'\\''")}' --namespace-id="${KV_NAMESPACE_ID}" --remote`,
        { stdio: 'pipe', cwd: path.join(__dirname, '..', '..', '..') }
      );
      uploaded++;
      console.log(`  Uploaded: ${key} - ${profile.name}`);
    } catch (err) {
      errors++;
      console.error(`  ERROR: ${key} - ${err.message}`);
    }
  }

  console.log(`\nDone. Uploaded: ${uploaded}, Errors: ${errors}`);
}

main();
