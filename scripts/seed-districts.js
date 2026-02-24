const fs = require('fs');

const districts = JSON.parse(fs.readFileSync('data/districts.json', 'utf8'));
const entries = Object.entries(districts);

let sql = '-- Auto-generated district seed data\n';
sql += '-- Run with: npx wrangler d1 execute mascodex-game --file=d1/seed-districts.sql\n\n';

// Batch inserts (100 per statement for D1 compatibility)
const batchSize = 100;
for (let i = 0; i < entries.length; i += batchSize) {
  const batch = entries.slice(i, i + batchSize);
  sql += 'INSERT OR IGNORE INTO districts (code, prefecture, name, hp, max_hp, status) VALUES\n';
  sql += batch.map(([code, d]) => {
    const name = (d.name || '').replace(/'/g, "''");
    return `  ('${code}', '${d.prefecture}', '${name}', 100, 100, 'healthy')`;
  }).join(',\n');
  sql += ';\n\n';
}

fs.writeFileSync('d1/seed-districts.sql', sql);
console.log(`Generated seed SQL for ${entries.length} districts`);
