/**
 * US ZIP Code Loader
 * Parses two CSV files:
 *   - data/us-zip-codes.csv (state, city, county)
 *   - data/us-zip-coords.csv (lat, lng)
 * Merges into unified records: { zipCode, city, state, stateName, county, lat, lng }
 *
 * Usage:
 *   const { getZipCodes, loadAllZipCodes } = require('./us-postal');
 *   const zips = await getZipCodes({ state: 'NY', limit: 10 });
 *   const specific = await getZipCodes({ zips: ['10001','90210'] });
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const GEO_CSV = path.join(DATA_DIR, 'us-zip-codes.csv');
const COORDS_CSV = path.join(DATA_DIR, 'us-zip-coords.csv');

let cachedRecords = null;

/**
 * Simple CSV line parser (handles basic quoting).
 */
function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Load and merge ZIP code data from both CSV files.
 */
function loadAllZipCodes() {
  if (cachedRecords) return cachedRecords;

  // Load geo data (state, city, county)
  const geoContent = fs.readFileSync(GEO_CSV, 'utf8');
  const geoLines = geoContent.split('\n').filter(l => l.trim());
  const geoMap = new Map();

  // Skip header: state_fips,state,state_abbr,zipcode,county,city
  for (let i = 1; i < geoLines.length; i++) {
    const fields = parseCsvLine(geoLines[i]);
    if (fields.length < 6) continue;
    const zipCode = fields[3].padStart(5, '0');
    geoMap.set(zipCode, {
      stateName: fields[1],
      state: fields[2],
      county: fields[4],
      city: fields[5],
    });
  }

  // Load coordinates
  const coordsContent = fs.readFileSync(COORDS_CSV, 'utf8');
  const coordsLines = coordsContent.split('\n').filter(l => l.trim());
  const coordsMap = new Map();

  // Skip header: ZIP,LAT,LNG
  for (let i = 1; i < coordsLines.length; i++) {
    const fields = parseCsvLine(coordsLines[i]);
    if (fields.length < 3) continue;
    const zipCode = fields[0].padStart(5, '0');
    const lat = parseFloat(fields[1]);
    const lng = parseFloat(fields[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      coordsMap.set(zipCode, { lat, lng });
    }
  }

  // Merge: only include ZIPs that have both geo data and coordinates
  const records = [];
  for (const [zipCode, geo] of geoMap) {
    const coords = coordsMap.get(zipCode);
    if (!coords) continue;
    records.push({
      zipCode,
      city: geo.city,
      state: geo.state,
      stateName: geo.stateName,
      county: geo.county,
      lat: coords.lat,
      lng: coords.lng,
    });
  }

  // Sort by ZIP code
  records.sort((a, b) => a.zipCode.localeCompare(b.zipCode));
  cachedRecords = records;
  console.log(`  Loaded ${records.length} US ZIP codes with coordinates.`);
  return records;
}

/**
 * Get ZIP codes filtered by options.
 * @param {Object} opts
 * @param {string} [opts.state] - Filter by state abbreviation (e.g., 'NY')
 * @param {string} [opts.prefix] - Filter by ZIP code prefix (e.g., '100')
 * @param {string[]} [opts.zips] - Specific ZIP codes to return
 * @param {number} [opts.limit] - Max number of results
 */
function getZipCodes(opts = {}) {
  let all = loadAllZipCodes();

  if (opts.zips && opts.zips.length > 0) {
    const zipSet = new Set(opts.zips.map(z => z.padStart(5, '0')));
    all = all.filter(r => zipSet.has(r.zipCode));
  } else {
    if (opts.state) {
      all = all.filter(r => r.state === opts.state.toUpperCase());
    }
    if (opts.prefix) {
      all = all.filter(r => r.zipCode.startsWith(opts.prefix));
    }
  }

  if (opts.limit) {
    all = all.slice(0, opts.limit);
  }

  return all;
}

module.exports = { getZipCodes, loadAllZipCodes };
