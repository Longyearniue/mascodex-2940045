#!/usr/bin/env node
/**
 * India PIN Code CSV Normalizer
 *
 * Merges two raw data sources:
 *   1. raw-pincodes-govdata.csv  (dropdevrahul/pincodes-india — data.gov.in)
 *      Has: Pincode, District, StateName, Latitude, Longitude  (~157K rows, 19.3K unique PINs)
 *   2. raw-pincodes.csv          (kishorek/India-Codes)
 *      Has: Pincode, City, DistrictsName, State  (~39K rows, city names)
 *
 * Output: data/in-pin-complete.csv
 *   Header: pincode,city,state,district,lat,lon
 *   ~19,300 rows (one per unique PIN code)
 *
 * Usage:
 *   node src/prepare-csv.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const GOVDATA_CSV = path.join(DATA_DIR, 'raw-pincodes-govdata.csv');
const KISHOREK_CSV = path.join(DATA_DIR, 'raw-pincodes.csv');
const OUTPUT_CSV  = path.join(DATA_DIR, 'in-pin-complete.csv');

// ── State-name → 2-letter code mapping ─────────────────────────────
const STATE_CODE_MAP = {
  'ANDAMAN AND NICOBAR ISLANDS': 'AN',
  'ANDHRA PRADESH': 'AP',
  'ARUNACHAL PRADESH': 'AR',
  'ASSAM': 'AS',
  'BIHAR': 'BR',
  'CHANDIGARH': 'CH',
  'CHHATTISGARH': 'CG',
  'DADRA AND NAGAR HAVELI AND DAMAN AND DIU': 'DD',
  'THE DADRA AND NAGAR HAVELI AND DAMAN AND DIU': 'DD',
  'DELHI': 'DL',
  'GOA': 'GA',
  'GUJARAT': 'GJ',
  'HARYANA': 'HR',
  'HIMACHAL PRADESH': 'HP',
  'JAMMU AND KASHMIR': 'JK',
  'JHARKHAND': 'JH',
  'KARNATAKA': 'KA',
  'KERALA': 'KL',
  'LADAKH': 'LA',
  'LAKSHADWEEP': 'LD',
  'MADHYA PRADESH': 'MP',
  'MAHARASHTRA': 'MH',
  'MANIPUR': 'MN',
  'MEGHALAYA': 'ML',
  'MIZORAM': 'MZ',
  'NAGALAND': 'NL',
  'ODISHA': 'OD',
  'PUDUCHERRY': 'PY',
  'PUNJAB': 'PB',
  'RAJASTHAN': 'RJ',
  'SIKKIM': 'SK',
  'TAMIL NADU': 'TN',
  'TELANGANA': 'TS',
  'TRIPURA': 'TR',
  'UTTAR PRADESH': 'UP',
  'UTTARAKHAND': 'UK',
  'WEST BENGAL': 'WB',
};

// ── CSV line parser (handles quoted fields) ─────────────────────────
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

// ── Title-case helper ───────────────────────────────────────────────
function titleCase(str) {
  return str
    .toLowerCase()
    .replace(/(?:^|\s|[-/])\S/g, (m) => m.toUpperCase());
}

// ── Step 1: Build city lookup from kishorek dataset ─────────────────
console.log('Loading city names from kishorek dataset...');
const kishorekContent = fs.readFileSync(KISHOREK_CSV, 'utf8');
const kishorekLines = kishorekContent.split('\n');
// Header: PostOfficeName, Pincode, DistrictsName, City, State
const cityByPin = new Map();
for (let i = 1; i < kishorekLines.length; i++) {
  const line = kishorekLines[i].trim();
  if (!line) continue;
  const f = parseCsvLine(line);
  if (f.length < 5) continue;
  const pin = f[1];
  const city = f[3];
  if (city && !cityByPin.has(pin)) {
    cityByPin.set(pin, city);
  }
}
console.log(`  City lookup: ${cityByPin.size} PIN codes with city names`);

// ── Step 2: Load govdata (primary source) and deduplicate ───────────
console.log('Loading govdata dataset (data.gov.in)...');
const govContent = fs.readFileSync(GOVDATA_CSV, 'utf8');
const govLines = govContent.split('\n');
// Header: CircleName,RegionName,DivisionName,OfficeName,Pincode,
//         OfficeType,Delivery,District,StateName,Latitude,Longitude

const pinMap = new Map(); // pin -> record (deduplicated, first with geo wins)
let totalRows = 0;
const unmappedStates = new Set();

for (let i = 1; i < govLines.length; i++) {
  const line = govLines[i].trim();
  if (!line) continue;
  totalRows++;
  const f = parseCsvLine(line);
  if (f.length < 11) continue;

  const pin       = f[4];
  const district  = f[7];
  const stateName = f[8];
  const lat       = f[9];
  const lon       = f[10];

  // Indian PIN codes are 6 digits starting with 1-8; skip test/placeholder data
  if (!/^[1-8]\d{5}$/.test(pin)) continue;

  const stateCode = STATE_CODE_MAP[stateName.toUpperCase()];
  if (!stateCode) {
    unmappedStates.add(stateName);
  }

  const hasGeo = lat && lat !== 'NA' && lon && lon !== 'NA';

  if (!pinMap.has(pin)) {
    pinMap.set(pin, {
      pin,
      district: titleCase(district),
      state: stateCode || stateName,
      lat: hasGeo ? parseFloat(lat) : 0,
      lon: hasGeo ? parseFloat(lon) : 0,
    });
  } else {
    // Replace if current record has geo but existing doesn't
    const existing = pinMap.get(pin);
    if (existing.lat === 0 && hasGeo) {
      pinMap.set(pin, {
        pin,
        district: titleCase(district),
        state: stateCode || stateName,
        lat: parseFloat(lat),
        lon: parseFloat(lon),
      });
    }
  }
}

console.log(`  Parsed ${totalRows} rows → ${pinMap.size} unique PIN codes`);
if (unmappedStates.size > 0) {
  console.log(`  WARNING: unmapped states → ${[...unmappedStates].join(', ')}`);
}

// ── Step 3: Merge city names and build output ───────────────────────
console.log('Merging city names and building output...');
const records = [];
let citiesFromKishorek = 0;
let citiesFromDistrict = 0;
const stateCount = {};

for (const [pin, data] of pinMap) {
  let city = cityByPin.get(pin);
  if (city) {
    citiesFromKishorek++;
  } else {
    // Fallback: use district as city name
    city = data.district;
    citiesFromDistrict++;
  }

  // Clean city name: remove trailing S.O, B.O, H.O if accidentally in city
  city = city.replace(/\s+(S\.O|B\.O|H\.O)$/i, '').trim();

  // Escape commas in city/district names
  const safeCity = city.includes(',') ? `"${city}"` : city;
  const safeDistrict = data.district.includes(',') ? `"${data.district}"` : data.district;

  const st = data.state;
  stateCount[st] = (stateCount[st] || 0) + 1;

  records.push({
    pin,
    city: safeCity,
    state: st,
    district: safeDistrict,
    lat: data.lat,
    lon: data.lon,
  });
}

// Sort by PIN code
records.sort((a, b) => a.pin.localeCompare(b.pin));

console.log(`  Cities from kishorek: ${citiesFromKishorek}`);
console.log(`  Cities from district fallback: ${citiesFromDistrict}`);

// ── Step 4: Write output CSV ────────────────────────────────────────
const header = 'pincode,city,state,district,lat,lon';
const lines = [header];
for (const r of records) {
  lines.push(`${r.pin},${r.city},${r.state},${r.district},${r.lat},${r.lon}`);
}
fs.writeFileSync(OUTPUT_CSV, lines.join('\n') + '\n', 'utf8');

// ── Summary ─────────────────────────────────────────────────────────
console.log('\n=== Summary ===');
console.log(`Total PIN codes: ${records.length}`);
console.log(`States/UTs: ${Object.keys(stateCount).length}`);
console.log(`Output: ${OUTPUT_CSV}`);

const withGeo = records.filter(r => r.lat !== 0 || r.lon !== 0).length;
console.log(`With coordinates: ${withGeo}`);
console.log(`Without coordinates: ${records.length - withGeo}`);

console.log('\nPIN codes per state:');
const sorted = Object.entries(stateCount).sort((a, b) => b[1] - a[1]);
for (const [st, count] of sorted) {
  console.log(`  ${st}: ${count}`);
}
