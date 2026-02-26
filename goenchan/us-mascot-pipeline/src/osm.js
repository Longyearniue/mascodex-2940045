/**
 * OSM POI Collector (US version)
 * Uses Overpass API to collect Points of Interest near a coordinate.
 * Adapted from quiz-pipeline/src/osm.js for US ZIP codes.
 *
 * Changes from JP version:
 * - Uses tags.name || tags['name:en'] instead of tags['name:ja']
 * - 1000m radius (suburban areas are more spread out)
 * - Added: landmarks, libraries, historic sites
 *
 * Rate limited: 1 request per 2 seconds.
 * Saves results to data/osm/{zipCode}.json
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const OSM_DIR = path.join(__dirname, '..', 'data', 'osm');
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'USMascotPipeline/1.0 (mascot character data collection)';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Build Overpass QL query for POIs around a point.
 * Larger 1000m radius for US suburban areas.
 */
function buildQuery(lat, lng, radius = 1000) {
  return `[out:json][timeout:25];
(
  node["shop"](around:${radius},${lat},${lng});
  node["amenity"~"school|hospital|restaurant|cafe|pharmacy|place_of_worship|library"](around:${radius},${lat},${lng});
  node["tourism"~"museum|attraction"](around:${radius},${lat},${lng});
  node["railway"="station"](around:${radius},${lat},${lng});
  node["leisure"="park"](around:${radius},${lat},${lng});
  node["historic"](around:${radius},${lat},${lng});
  way["shop"](around:${radius},${lat},${lng});
  way["amenity"~"school|hospital|library"](around:${radius},${lat},${lng});
  way["leisure"="park"](around:${radius},${lat},${lng});
  way["historic"](around:${radius},${lat},${lng});
);
out center;`;
}

/**
 * POST to Overpass API and return parsed JSON.
 */
function queryOverpass(overpassQl) {
  return new Promise((resolve, reject) => {
    const postData = `data=${encodeURIComponent(overpassQl)}`;
    const parsedUrl = new URL(OVERPASS_URL);

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const mod = parsedUrl.protocol === 'https:' ? https : http;
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 429) {
          reject(new Error('Overpass rate limited (429). Will retry.'));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Overpass HTTP ${res.statusCode}: ${data.substring(0, 300)}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Categorize OSM elements into POI categories.
 * US version: uses English names, adds landmarks/libraries.
 */
function categorize(elements) {
  const pois = {
    shops: [],
    landmarks: [],
    schools: [],
    parks: [],
    stations: [],
    restaurants: [],
    libraries: [],
    hospitals: [],
  };

  for (const el of elements) {
    const tags = el.tags || {};
    const name = tags.name || tags['name:en'] || '';
    if (!name) continue;

    if (tags.railway === 'station') {
      pois.stations.push(name);
    } else if (tags.leisure === 'park') {
      pois.parks.push(name);
    } else if (tags.amenity === 'school') {
      pois.schools.push(name);
    } else if (tags.amenity === 'hospital') {
      pois.hospitals.push(name);
    } else if (tags.amenity === 'library') {
      pois.libraries.push(name);
    } else if (tags.amenity === 'restaurant' || tags.amenity === 'cafe') {
      pois.restaurants.push(name);
    } else if (tags.amenity === 'place_of_worship') {
      pois.landmarks.push(name);
    } else if (tags.amenity === 'pharmacy') {
      pois.shops.push(name);
    } else if (tags.historic) {
      pois.landmarks.push(name);
    } else if (tags.tourism) {
      pois.landmarks.push(name);
    } else if (tags.shop) {
      pois.shops.push(name);
    }
  }

  // Deduplicate each category
  for (const key of Object.keys(pois)) {
    pois[key] = [...new Set(pois[key])];
  }

  return pois;
}

/**
 * Collect POIs for a ZIP code at given coordinates.
 * Returns cached result if available.
 */
async function collectPOIs(zipCode, lat, lng, retries = 2) {
  if (!fs.existsSync(OSM_DIR)) {
    fs.mkdirSync(OSM_DIR, { recursive: true });
  }

  const cachePath = path.join(OSM_DIR, `${zipCode}.json`);

  // Check cache
  if (fs.existsSync(cachePath)) {
    try {
      return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    } catch {
      // Corrupted cache, re-fetch
    }
  }

  const query = buildQuery(lat, lng);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await queryOverpass(query);
      const elements = result.elements || [];
      const pois = categorize(elements);

      // Save to cache
      fs.writeFileSync(cachePath, JSON.stringify(pois, null, 2), 'utf8');
      return pois;
    } catch (err) {
      console.error(`    Overpass error (attempt ${attempt + 1}): ${err.message}`);
      if (attempt < retries) {
        const delay = err.message.includes('429') ? 10000 : 3000;
        await sleep(delay);
      }
    }
  }

  // Return empty POIs on failure
  console.warn(`    Failed to collect POIs for ${zipCode}`);
  const emptyPois = {
    shops: [], landmarks: [], schools: [], parks: [],
    stations: [], restaurants: [], libraries: [], hospitals: [],
  };
  return emptyPois;
}

module.exports = { collectPOIs };
