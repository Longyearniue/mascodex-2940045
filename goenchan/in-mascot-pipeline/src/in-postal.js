/**
 * India PIN Code Loader
 * Parses complete PIN code CSV: data/in-pin-complete.csv
 * Header: pincode,city,state,district,lat,lon
 * ~19,297 records (all India PIN codes)
 *
 * Usage:
 *   const { getPinCodes, loadAllPinCodes } = require('./in-postal');
 *   const pins = getPinCodes({ state: 'DL', limit: 10 });
 *   const specific = getPinCodes({ pins: ['110001','400001'] });
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CSV_FILE = path.join(DATA_DIR, 'in-pin-complete.csv');

// State/UT abbreviation → full name mapping (36 states & union territories)
const STATE_NAMES = {
  AN:'Andaman and Nicobar Islands',AP:'Andhra Pradesh',AR:'Arunachal Pradesh',
  AS:'Assam',BR:'Bihar',CH:'Chandigarh',CG:'Chhattisgarh',
  DD:'Dadra and Nagar Haveli and Daman and Diu',DL:'Delhi',GA:'Goa',
  GJ:'Gujarat',HR:'Haryana',HP:'Himachal Pradesh',JK:'Jammu and Kashmir',
  JH:'Jharkhand',KA:'Karnataka',KL:'Kerala',LA:'Ladakh',LD:'Lakshadweep',
  MP:'Madhya Pradesh',MH:'Maharashtra',MN:'Manipur',ML:'Meghalaya',
  MZ:'Mizoram',NL:'Nagaland',OD:'Odisha',PB:'Punjab',PY:'Puducherry',
  RJ:'Rajasthan',SK:'Sikkim',TN:'Tamil Nadu',TS:'Telangana',TR:'Tripura',
  UP:'Uttar Pradesh',UK:'Uttarakhand',WB:'West Bengal',
};

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
 * Load all PIN codes from the complete CSV.
 * Header: pincode,city,state,district,lat,lon
 */
function loadAllPinCodes() {
  if (cachedRecords) return cachedRecords;

  const content = fs.readFileSync(CSV_FILE, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  const records = [];

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length < 6) continue;

    const pinCode = fields[0].padStart(6, '0');
    const city = fields[1];
    const state = fields[2];
    const district = fields[3];
    const lat = parseFloat(fields[4]);
    const lon = parseFloat(fields[5]);

    if (!city || !state) continue;

    records.push({
      pinCode,
      city,
      state,
      stateName: STATE_NAMES[state] || state,
      district,
      lat: isNaN(lat) ? 0 : lat,
      lng: isNaN(lon) ? 0 : lon,
    });
  }

  records.sort((a, b) => a.pinCode.localeCompare(b.pinCode));
  cachedRecords = records;
  console.log(`  Loaded ${records.length} India PIN codes.`);
  return records;
}

/**
 * Get PIN codes filtered by options.
 * @param {Object} opts
 * @param {string[]} opts.pins   - Specific PIN codes to retrieve
 * @param {string}   opts.state  - Filter by state code (e.g. 'DL')
 * @param {string}   opts.prefix - Filter by PIN prefix (e.g. '11')
 * @param {number}   opts.limit  - Max number of results
 */
function getPinCodes(opts = {}) {
  let all = loadAllPinCodes();

  if (opts.pins && opts.pins.length > 0) {
    const pinSet = new Set(opts.pins.map(p => p.padStart(6, '0')));
    all = all.filter(r => pinSet.has(r.pinCode));
  } else {
    if (opts.state) {
      all = all.filter(r => r.state === opts.state.toUpperCase());
    }
    if (opts.prefix) {
      all = all.filter(r => r.pinCode.startsWith(opts.prefix));
    }
  }

  if (opts.limit) {
    all = all.slice(0, opts.limit);
  }

  return all;
}

module.exports = { getPinCodes, loadAllPinCodes };
