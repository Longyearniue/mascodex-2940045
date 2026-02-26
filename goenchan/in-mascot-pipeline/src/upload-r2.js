#!/usr/bin/env node
/**
 * Upload character pages to R2.
 * Uses wrangler r2 object put to upload HTML pages.
 *
 * Usage:
 *   node src/upload-r2.js --pins=110001,400001,600001
 *   node src/upload-r2.js                           # All pages
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, '..', 'data', 'pages');
const BUCKET = 'mascodex-in';

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

  let dirs = fs.readdirSync(PAGES_DIR).filter(d =>
    fs.statSync(path.join(PAGES_DIR, d)).isDirectory()
  );

  if (args.pins) {
    const pins = new Set(args.pins.split(',').map(p => p.trim().padStart(6, '0')));
    dirs = dirs.filter(d => pins.has(d));
  }
  if (args.limit) {
    dirs = dirs.slice(0, parseInt(args.limit, 10));
  }

  console.log(`\n=== Upload to R2: ${BUCKET} ===`);
  console.log(`  Pages: ${dirs.length}\n`);

  let uploaded = 0;
  let errors = 0;

  for (const dir of dirs) {
    const filePath = path.join(PAGES_DIR, dir, 'index.html');
    if (!fs.existsSync(filePath)) continue;

    const key = `in/${dir}/index.html`;
    try {
      execSync(
        `wrangler r2 object put "${BUCKET}/${key}" --file="${filePath}" --content-type="text/html" --remote`,
        { stdio: 'pipe', cwd: path.join(__dirname, '..', '..', '..') }
      );
      uploaded++;
      console.log(`  Uploaded: ${key}`);
    } catch (err) {
      errors++;
      console.error(`  ERROR: ${key} - ${err.message}`);
    }
  }

  console.log(`\nDone. Uploaded: ${uploaded}, Errors: ${errors}`);
}

main();
