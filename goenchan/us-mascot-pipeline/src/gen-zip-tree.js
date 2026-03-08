#!/usr/bin/env node
/**
 * Generate us-zip-tree.json for the US page state/city dropdown.
 * Output: { "State": { "City": ["zip1", "zip2", ...] }, ... }
 */

const fs = require('fs');
const path = require('path');
const { loadAllZipCodes } = require('./us-postal');

const OUT_PATH = path.join(__dirname, '..', '..', '..', 'js', 'us-zip-tree.json');

const all = loadAllZipCodes();

// Build tree: state -> city -> [zipCodes]
const tree = {};
for (const rec of all) {
  if (!rec.state || !rec.city) continue;
  if (!tree[rec.state]) tree[rec.state] = {};
  if (!tree[rec.state][rec.city]) tree[rec.state][rec.city] = [];
  tree[rec.state][rec.city].push(rec.zipCode);
}

// Sort states, cities, and zip codes
const sorted = {};
for (const state of Object.keys(tree).sort()) {
  sorted[state] = {};
  for (const city of Object.keys(tree[state]).sort()) {
    sorted[state][city] = tree[state][city].sort();
  }
}

fs.writeFileSync(OUT_PATH, JSON.stringify(sorted), 'utf8');
const states = Object.keys(sorted).length;
const cities = Object.values(sorted).reduce((s, c) => s + Object.keys(c).length, 0);
console.log(`Generated us-zip-tree.json: ${states} states, ${cities} cities`);
console.log(`File: ${OUT_PATH} (${(fs.statSync(OUT_PATH).size / 1024).toFixed(0)} KB)`);
