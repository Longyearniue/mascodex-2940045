#!/usr/bin/env node
/**
 * Upload character profiles to IN_KV for the chat API.
 * Uses wrangler kv key put.
 *
 * Usage:
 *   node src/upload-kv.js --pins=110001,400001,600001
 *   node src/upload-kv.js                           # All profiles
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROFILES_DIR = path.join(__dirname, '..', 'data', 'profiles');
const MERGED_DIR = path.join(__dirname, '..', 'data', 'merged');
const KV_NAMESPACE_ID = 'b53a747d21934113b3c7fbfe47e3e0d4';

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

  if (args.pins) {
    const pins = new Set(args.pins.split(',').map(p => p.trim().padStart(6, '0')));
    files = files.filter(f => pins.has(f.replace('.json', '')));
  }
  if (args.limit) {
    files = files.slice(0, parseInt(args.limit, 10));
  }

  console.log(`\n=== Upload Profiles to IN_KV ===`);
  console.log(`  Profiles: ${files.length}\n`);

  let uploaded = 0;
  let errors = 0;

  for (const file of files) {
    const pin = file.replace('.json', '');
    const profile = JSON.parse(fs.readFileSync(path.join(PROFILES_DIR, file), 'utf8'));

    // Merge with merged data for richer context
    const mergedPath = path.join(MERGED_DIR, file);
    if (fs.existsSync(mergedPath)) {
      const merged = JSON.parse(fs.readFileSync(mergedPath, 'utf8'));
      profile.city = merged.city;
      profile.state = merged.state;
      profile.stateName = merged.stateName;
      profile.district = merged.district;
      profile.wiki = merged.wiki;
    }

    const key = `in_char_${pin}`;
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
