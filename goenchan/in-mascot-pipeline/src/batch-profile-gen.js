#!/usr/bin/env node
/**
 * Batch Profile Generator for India PIN Codes (no API required)
 * Generates mascot profiles for ALL India PIN codes using state/city data.
 * Uses yuru-chara prompt structure with STRICT single-character enforcement.
 *
 * Usage:
 *   node src/batch-profile-gen.js                    # All PINs
 *   node src/batch-profile-gen.js --state=DL          # Only Delhi
 *   node src/batch-profile-gen.js --pins=110001,400001 # Specific PINs
 *   node src/batch-profile-gen.js --limit=100          # First 100
 *   node src/batch-profile-gen.js --force              # Overwrite existing
 */

const fs = require('fs');
const path = require('path');
const { getPinCodes } = require('./in-postal');

const PROFILES_DIR = path.join(__dirname, '..', 'data', 'profiles');
const NEGATIVE_PROMPT = 'low quality, text, letters, watermark, blurry, bad anatomy, cropped, disfigured, duplicate, extra limbs, realistic human, photograph, multiple characters, group, crowd, duo, pair, two characters, many characters, multiple mascots, split image, collage';

// State/UT theme data for all 36 states and union territories
const STATE_THEMES = {
  AN: { animal: 'dugong', items: ['coconut palm', 'coral reef', 'tribal art'], features: ['island paradise', 'turquoise waters'], colors: ['#009688','#00BCD4','#FF9800'] },
  AP: { animal: 'blackbuck', items: ['Tirupati laddu', 'Kuchipudi dancer', 'chili pepper'], features: ['Deccan charm', 'spice coast warmth'], colors: ['#FF9800','#4CAF50','#FFFFFF'] },
  AR: { animal: 'mithun', items: ['bamboo hat', 'orchid', 'prayer flag'], features: ['dawn-lit mountains', 'tribal heritage'], colors: ['#4CAF50','#FF5722','#FFC107'] },
  AS: { animal: 'one-horned rhino', items: ['tea leaf', 'gamosa towel', 'bihu drum'], features: ['tea garden paradise', 'Brahmaputra spirit'], colors: ['#4CAF50','#FF9800','#FFFFFF'] },
  BR: { animal: 'sparrow', items: ['Bodhi tree leaf', 'litti chokha', 'Nalanda scroll'], features: ['ancient wisdom land', 'Ganges plain'], colors: ['#FF9800','#795548','#FFC107'] },
  CH: { animal: 'Indian grey hornbill', items: ['Open Hand monument', 'rose', 'modernist arch'], features: ['planned city elegance', 'Le Corbusier spirit'], colors: ['#9E9E9E','#E91E63','#607D8B'] },
  CG: { animal: 'wild buffalo', items: ['bastar art mask', 'rice bowl', 'waterfall'], features: ['tribal art heartland', 'dense forest green'], colors: ['#4CAF50','#795548','#FF5722'] },
  DD: { animal: 'flamingo', items: ['sea fort', 'coconut', 'tribal jewelry'], features: ['coastal serenity', 'Portuguese heritage'], colors: ['#2196F3','#FF9800','#4CAF50'] },
  DL: { animal: 'house sparrow', items: ['Red Fort silhouette', 'chaat plate', 'metro card'], features: ['capital city hustle', 'Mughal grandeur'], colors: ['#C62828','#FF8F00','#1565C0'] },
  GA: { animal: 'ruby-throated yellow bulbul', items: ['seashell', 'church bell', 'fish curry'], features: ['beach paradise', 'Portuguese charm'], colors: ['#FFEB3B','#E91E63','#00BCD4'] },
  GJ: { animal: 'Asiatic lion', items: ['dhokla plate', 'kite', 'Rann salt crystal'], features: ['vibrant textiles', 'white desert wonder'], colors: ['#FF9800','#E91E63','#FFFFFF'] },
  HR: { animal: 'blackbuck', items: ['wrestling medal', 'bajra roti', 'dairy pot'], features: ['wrestling champion land', 'green farmland'], colors: ['#4CAF50','#FFC107','#795548'] },
  HP: { animal: 'snow leopard', items: ['apple', 'prayer wheel', 'pine cone'], features: ['mountain paradise', 'Himalayan serenity'], colors: ['#1B5E20','#F44336','#FFFFFF'] },
  JK: { animal: 'hangul deer', items: ['saffron flower', 'shikara boat', 'pashmina shawl'], features: ['paradise on earth', 'snow-capped majesty'], colors: ['#1565C0','#FFFFFF','#4CAF50'] },
  JH: { animal: 'elephant', items: ['tribal drum', 'waterfall', 'Sal tree leaf'], features: ['mineral rich land', 'forest heartbeat'], colors: ['#4CAF50','#795548','#FF9800'] },
  KA: { animal: 'elephant', items: ['sandalwood chip', 'Mysore silk', 'dosa'], features: ['silicon valley of India', 'royal heritage'], colors: ['#C62828','#FFC107','#FFFFFF'] },
  KL: { animal: 'elephant', items: ['coconut', 'kathakali mask', 'houseboat'], features: ['Gods own country', 'backwater serenity'], colors: ['#4CAF50','#FFC107','#F44336'] },
  LA: { animal: 'snow leopard', items: ['prayer flag', 'monastery bell', 'apricot'], features: ['high altitude wonder', 'Buddhist peace'], colors: ['#1565C0','#FF9800','#FFFFFF'] },
  LD: { animal: 'butterfly fish', items: ['coconut palm', 'coral', 'lagoon wave'], features: ['tropical island jewel', 'coral garden'], colors: ['#00BCD4','#4CAF50','#FFFFFF'] },
  MP: { animal: 'tiger', items: ['khajuraho sculpture', 'marble rock', 'lake'], features: ['heart of India', 'wildlife sanctuary'], colors: ['#FF9800','#4CAF50','#795548'] },
  MH: { animal: 'giant squirrel', items: ['vada pav', 'Bollywood star', 'Ganesh idol'], features: ['dream city energy', 'Maratha pride'], colors: ['#FF9800','#4CAF50','#FFFFFF'] },
  MN: { animal: 'Sangai deer', items: ['polo mallet', 'Shirui lily', 'bamboo dance stick'], features: ['jewel of India', 'polo birthplace'], colors: ['#4CAF50','#E91E63','#FFC107'] },
  ML: { animal: 'clouded leopard', items: ['living root bridge', 'rain drop', 'cherry blossom'], features: ['abode of clouds', 'wettest place on earth'], colors: ['#4CAF50','#2196F3','#E91E63'] },
  MZ: { animal: 'Seram', items: ['bamboo flute', 'mizo shawl', 'mountain orchid'], features: ['land of the highlanders', 'bamboo forest'], colors: ['#4CAF50','#E91E63','#2196F3'] },
  NL: { animal: 'tragopan', items: ['hornbill feather', 'Naga shawl', 'warrior spear'], features: ['land of festivals', 'hornbill spirit'], colors: ['#F44336','#4CAF50','#000000'] },
  OD: { animal: 'olive ridley turtle', items: ['Jagannath temple wheel', 'Pattachitra art', 'rasagola'], features: ['temple city grandeur', 'tribal art'], colors: ['#FF9800','#C62828','#FFFFFF'] },
  PB: { animal: 'blackbuck', items: ['turban', 'tandoori naan', 'bhangra drum'], features: ['land of five rivers', 'golden wheat'], colors: ['#FF9800','#4CAF50','#FFFFFF'] },
  PY: { animal: 'squirrel', items: ['French window', 'beret', 'auroville sphere'], features: ['French Riviera of India', 'spiritual serenity'], colors: ['#1565C0','#FFFFFF','#FFC107'] },
  RJ: { animal: 'camel', items: ['turban', 'mahal silhouette', 'desert rose'], features: ['royal desert kingdom', 'colorful splendor'], colors: ['#FF9800','#C62828','#FFC107'] },
  SK: { animal: 'red panda', items: ['prayer wheel', 'orchid', 'Kanchenjunga peak'], features: ['Himalayan jewel', 'organic paradise'], colors: ['#4CAF50','#E91E63','#FFFFFF'] },
  TN: { animal: 'Nilgiri tahr', items: ['temple gopuram', 'filter coffee cup', 'bharatanatyam pose'], features: ['Dravidian heritage', 'temple city'], colors: ['#C62828','#FFC107','#FFFFFF'] },
  TS: { animal: 'Indian roller', items: ['Charminar silhouette', 'pearl', 'biryani pot'], features: ['pearl city charm', 'Deccan plateau'], colors: ['#FF9800','#4CAF50','#FFFFFF'] },
  TR: { animal: 'Phayres langur', items: ['bamboo craft', 'rubber tree', 'tribal mask'], features: ['land of fourteen gods', 'bamboo paradise'], colors: ['#4CAF50','#FF9800','#795548'] },
  UP: { animal: 'barasingha', items: ['Taj Mahal silhouette', 'chikan embroidery', 'mango'], features: ['land of wonders', 'Mughal splendor'], colors: ['#FFFFFF','#4CAF50','#FF9800'] },
  UK: { animal: 'musk deer', items: ['temple bell', 'yoga mat', 'Himalayan herb'], features: ['dev bhoomi', 'land of gods'], colors: ['#4CAF50','#FF9800','#FFFFFF'] },
  WB: { animal: 'fishing cat', items: ['Howrah Bridge silhouette', 'rasgulla', 'Durga idol'], features: ['city of joy', 'cultural capital'], colors: ['#C62828','#FFFFFF','#FF9800'] },
};

// Fallback theme for states not in the map
const DEFAULT_THEME = { animal: 'peacock', items: ['lotus flower', 'tricolor flag', 'mango'], features: ['incredible India', 'unity in diversity'], colors: ['#FF9800','#FFFFFF','#4CAF50'] };

// Animal-based name options for India mascots
const animalNames = {
  dugong: ['Duggy', 'Reef', 'Coral', 'Splash'],
  blackbuck: ['Buck', 'Sprint', 'Gazelle', 'Swift'],
  mithun: ['Mithu', 'Horn', 'Forest', 'Chief'],
  'one-horned rhino': ['Rhino', 'Horn', 'Tank', 'Mighty'],
  sparrow: ['Chirpy', 'Tweet', 'Wing', 'Pip'],
  'Indian grey hornbill': ['Horny', 'Bill', 'Crown', 'Forest'],
  'wild buffalo': ['Buff', 'Thunder', 'Storm', 'Charge'],
  flamingo: ['Flam', 'Pink', 'Wade', 'Grace'],
  'house sparrow': ['Sparky', 'Chip', 'Tweet', 'Pip'],
  'ruby-throated yellow bulbul': ['Bulbul', 'Song', 'Melody', 'Gold'],
  'Asiatic lion': ['Leo', 'King', 'Pride', 'Roar'],
  'snow leopard': ['Snow', 'Ghost', 'Peak', 'Frost'],
  'hangul deer': ['Hangul', 'Grace', 'Forest', 'Glen'],
  elephant: ['Ellie', 'Jumbo', 'Tusker', 'Gaja'],
  tiger: ['Tiger', 'Stripe', 'Raja', 'Sher'],
  'giant squirrel': ['Nutty', 'Scurry', 'Acorn', 'Bushy'],
  'Sangai deer': ['Sangai', 'Dance', 'Grace', 'Marsh'],
  'clouded leopard': ['Cloud', 'Misty', 'Shadow', 'Rain'],
  'Seram': ['Seram', 'Highland', 'Bamboo', 'Mist'],
  tragopan: ['Trago', 'Plume', 'Crest', 'Horn'],
  'olive ridley turtle': ['Olive', 'Shell', 'Wave', 'Sandy'],
  squirrel: ['Nutty', 'Scurry', 'Skip', 'Dash'],
  camel: ['Camel', 'Dune', 'Sandy', 'Desert'],
  'red panda': ['Panda', 'Red', 'Bamboo', 'Fuzzy'],
  'Nilgiri tahr': ['Nilgiri', 'Mountain', 'Crest', 'Hill'],
  'Indian roller': ['Roller', 'Blue', 'Sky', 'Flash'],
  'Phayres langur': ['Langur', 'Leaf', 'Swing', 'Tree'],
  barasingha: ['Bara', 'Swamp', 'Crown', 'Marsh'],
  'musk deer': ['Musky', 'Alpine', 'Glen', 'Forest'],
  'fishing cat': ['Fisher', 'Splash', 'Creek', 'Paws'],
  'butterfly fish': ['Flutter', 'Reef', 'Coral', 'Fin'],
  peacock: ['Peacock', 'Plume', 'Jewel', 'Dance'],
  default: ['Buddy', 'Star', 'Spark', 'Glow'],
};

/**
 * Simple seeded hash for deterministic randomness per PIN code.
 */
function hashPin(pin) {
  let h = 0;
  for (let i = 0; i < pin.length; i++) {
    h = ((h << 5) - h + pin.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Pick N items from array using seeded index.
 */
function pick(arr, seed, n) {
  const result = [];
  const copy = arr.slice();
  for (let i = 0; i < Math.min(n, copy.length); i++) {
    const idx = (seed + i * 7) % copy.length;
    result.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return result;
}

/**
 * Generate a mascot name from city + state theme.
 */
function generateName(pin, city, state) {
  const h = hashPin(pin);
  const prefixes = ['Little', 'Buddy', 'Captain', 'Happy', 'Lucky', 'Sunny', 'Mighty', 'Jolly', 'Breezy', 'Zippy', 'Sparky', 'Dash', 'Chip', 'Star', 'Scout', 'Pepper', 'Blaze', 'Maple', 'Sky', 'River'];
  const theme = STATE_THEMES[state] || DEFAULT_THEME;
  const animalOptions = animalNames[theme.animal] || animalNames.default;
  const cityWord = city.split(/[\s-]/)[0].replace(/[^a-zA-Z]/g, '');

  // Alternate between styles
  const style = h % 4;
  switch (style) {
    case 0: return `${cityWord} ${animalOptions[h % animalOptions.length]}`;
    case 1: return `${prefixes[h % prefixes.length]} ${animalOptions[h % animalOptions.length]}`;
    case 2: return `${cityWord} ${prefixes[(h >> 3) % prefixes.length]}`;
    default: return `${prefixes[h % prefixes.length]} ${cityWord.substring(0, Math.min(cityWord.length, 5))}`;
  }
}

/**
 * Generate catchphrase with India context.
 */
function generateCatchphrase(pin, city, state, theme) {
  const h = hashPin(pin);
  const templates = [
    `Welcome to ${city}, where the ${theme.features[0]} never fades!`,
    `Namaste from ${city}, ${state}!`,
    `Come feel the ${theme.features[0]} of ${city}!`,
    `${city} pride, ${state} strong!`,
    `Living that ${theme.features[0]} life in ${city}!`,
    `From ${city} with love and ${theme.features[0]}!`,
    `${city} is where the magic happens!`,
    `Jai ${city}! Spreading ${theme.features[0]} to the world!`,
  ];
  return templates[h % templates.length];
}

/**
 * Generate SD prompt with STRICT single-character enforcement.
 * CRITICAL: Must produce exactly ONE mascot per image.
 */
function generateSdPrompt(pin, city, stateName, theme) {
  const h = hashPin(pin);
  const selectedItems = pick(theme.items, h, 2);
  const itemDescs = selectedItems.map((item, i) => {
    if (i === 0) return `${item} accessory`;
    return `tiny ${item}`;
  }).join(', ');

  return `cute yuru-chara mascot, full body, single character, one mascot only, solo, centered, 3D soft plush texture, kigurumi style, simple rounded body, big eyes, short limbs, friendly expression, a mascot inspired by ${city} ${stateName}, ${theme.animal} shaped, ${itemDescs}, ${theme.features[0]}, white background, high quality, studio lighting, no text, no letters, no watermark`;
}

/**
 * Generate backstory with India context (uses district instead of county).
 */
function generateBackstory(pin, city, stateName, district, theme) {
  const h = hashPin(pin);
  const templates = [
    `This cheerful mascot represents the heart of ${city}, ${stateName}, bringing ${theme.features[0]} to everyone in ${district} district.`,
    `Born in ${city}, ${stateName}, this little character embodies the ${theme.features[0]} that makes ${district} district special.`,
    `Roaming the streets of ${city}, ${stateName}, this mascot shares the ${theme.features[0]} with neighbors across ${district} district.`,
    `A proud resident of ${city} in ${district} district, ${stateName}, spreading ${theme.features[0]} wherever they go.`,
  ];
  return templates[h % templates.length];
}

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--(\w+)(?:=(.+))?$/);
    if (match) {
      args[match[1]] = match[2] || true;
    }
  }
  return args;
}

function main() {
  const args = parseArgs();
  const force = !!args.force;

  if (!fs.existsSync(PROFILES_DIR)) {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
  }

  // Load PIN codes
  const opts = {};
  if (args.state) opts.state = args.state;
  if (args.pins) opts.pins = args.pins.split(',');
  if (args.limit) opts.limit = parseInt(args.limit, 10);

  const pins = getPinCodes(opts);
  console.log(`\n=== India Batch Profile Generation ===`);
  console.log(`  Total PINs: ${pins.length}`);

  let generated = 0;
  let skipped = 0;

  for (const pin of pins) {
    const outPath = path.join(PROFILES_DIR, `${pin.pinCode}.json`);

    if (!force && fs.existsSync(outPath)) {
      skipped++;
      continue;
    }

    const theme = STATE_THEMES[pin.state] || DEFAULT_THEME;
    const name = generateName(pin.pinCode, pin.city, pin.state);
    const catchphrase = generateCatchphrase(pin.pinCode, pin.city, pin.state, theme);
    const sdPrompt = generateSdPrompt(pin.pinCode, pin.city, pin.stateName, theme);
    const negativePrompt = NEGATIVE_PROMPT;
    const backstory = generateBackstory(pin.pinCode, pin.city, pin.stateName, pin.district, theme);

    const profile = {
      pinCode: pin.pinCode,
      name,
      catchphrase,
      sdPrompt,
      negativePrompt,
      colorPalette: theme.colors,
      backstory,
    };

    fs.writeFileSync(outPath, JSON.stringify(profile), 'utf8');
    generated++;
  }

  console.log(`  Generated: ${generated}`);
  console.log(`  Skipped (existing): ${skipped}`);
  console.log(`  Total profiles: ${generated + skipped}`);
  console.log('');
}

main();
