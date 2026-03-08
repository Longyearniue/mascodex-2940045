/**
 * Wikipedia Collector (US version)
 * Uses English Wikipedia REST API to collect city summaries.
 * Adapted from quiz-pipeline/src/wiki.js.
 *
 * Changes from JP version:
 * - Uses en.wikipedia.org instead of ja.wikipedia.org
 * - Searches "{city}, {state}" for disambiguation
 *
 * Caches to data/wiki/{city}_{state}.json
 * Rate limited: 1 request per second.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const WIKI_DIR = path.join(__dirname, '..', 'data', 'wiki');
const USER_AGENT = 'USMascotPipeline/1.0 (mascot character data collection)';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch JSON from a URL.
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    };

    https.get(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchJson(res.headers.location).then(resolve).catch(reject);
        return;
      }

      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 404) {
          resolve(null);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Wikipedia HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Sanitize a name for use as a filename.
 */
function sanitizeFilename(name) {
  return name.replace(/[/\\?%*:|"<>]/g, '_');
}

/**
 * Collect Wikipedia summary for a US city.
 * Tries "{city}, {stateName}" first, then just "{city}".
 * Returns { summary, description, title } or empty.
 */
async function collectWiki(city, stateName) {
  if (!fs.existsSync(WIKI_DIR)) {
    fs.mkdirSync(WIKI_DIR, { recursive: true });
  }

  const cacheKey = sanitizeFilename(`${city}_${stateName}`);
  const cachePath = path.join(WIKI_DIR, `${cacheKey}.json`);

  // Check cache
  if (fs.existsSync(cachePath)) {
    try {
      return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    } catch {
      // Corrupted cache, re-fetch
    }
  }

  try {
    // Try "City, State" first for disambiguation
    const searchTerm = `${city}, ${stateName}`;
    const encoded = encodeURIComponent(searchTerm);
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
    let result = await fetchJson(url);

    // If not found, try just the city name
    if (!result || !result.extract) {
      const fallbackUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(city)}`;
      result = await fetchJson(fallbackUrl);
    }

    if (result && result.extract) {
      const wikiData = {
        summary: result.extract || '',
        description: result.description || '',
        title: result.title || city,
      };
      fs.writeFileSync(cachePath, JSON.stringify(wikiData, null, 2), 'utf8');
      return wikiData;
    }

    const emptyData = { summary: '', description: '', title: city };
    fs.writeFileSync(cachePath, JSON.stringify(emptyData, null, 2), 'utf8');
    return emptyData;
  } catch (err) {
    console.error(`    Wikipedia error for "${city}, ${stateName}": ${err.message}`);
    return { summary: '', description: '', title: city };
  }
}

/**
 * Collect Wikipedia data for multiple unique city+state combinations.
 * @param {Array<{city: string, stateName: string}>} entries
 * @returns {Map<string, object>} - Map of "city_state" -> wikiData
 */
async function collectWikiBatch(entries) {
  // Deduplicate by city+state
  const seen = new Set();
  const unique = [];
  for (const e of entries) {
    const key = `${e.city}_${e.stateName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(e);
  }

  const results = new Map();

  for (let i = 0; i < unique.length; i++) {
    const { city, stateName } = unique[i];
    const key = `${city}_${stateName}`;
    console.log(`    Wiki [${i + 1}/${unique.length}]: ${city}, ${stateName}`);
    const data = await collectWiki(city, stateName);
    results.set(key, data);

    // Rate limit
    if (i < unique.length - 1) {
      await sleep(1100);
    }
  }

  return results;
}

module.exports = { collectWiki, collectWikiBatch };
