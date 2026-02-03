# Form Pattern Recognition Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add pattern recognition to detect 5 common form builder patterns and generate accurate field mappings dynamically.

**Architecture:** Add pattern detection on page load, cache results, generate dynamic mappings for detected patterns, merge with existing 3-tier system (SITE_MAPPINGS → learned → pattern → auto-detection).

**Tech Stack:** Vanilla JavaScript, Chrome Extension Manifest V3, Chrome Storage API

---

## Task 1: Add Pattern Detection Infrastructure

**Files:**
- Modify: `goenchan/chrome-extension-v2/content.js` (add after line 1075, before detectFieldType)

**Step 1: Add global cache variable**

Add at the top of content.js after the SITE_MAPPINGS constant:

```javascript
// Global cache for detected pattern
let cachedPatternMapping = null;
let cachedPatternInfo = null;
```

**Step 2: Add main pattern detection function**

```javascript
// =============================================================================
// PATTERN RECOGNITION
// =============================================================================

/**
 * Detect form builder pattern on current page
 * Returns: { name: string, score: number } | null
 */
function detectFormPattern() {
  const formFields = document.querySelectorAll('input, textarea, select');

  if (formFields.length === 0) {
    console.log('⚠️ [PATTERN] No form fields found on page');
    return null;
  }

  const forms = document.querySelectorAll('form');
  if (forms.length > 1) {
    console.log(`ℹ️ [PATTERN] Multiple forms detected (${forms.length}), analyzing all fields`);
  }

  const patterns = [
    {
      name: 'wordpress-cf7',
      score: 0,
      detector: detectWordPressCF7
    },
    {
      name: 'japanese-direct',
      score: 0,
      detector: detectJapaneseDirect
    },
    {
      name: 'required-marks',
      score: 0,
      detector: detectRequiredMarks
    },
    {
      name: 'mailform-cgi',
      score: 0,
      detector: detectMailFormCGI
    },
    {
      name: 'split-fields',
      score: 0,
      detector: detectSplitFields
    }
  ];

  // Calculate scores for each pattern
  patterns.forEach(pattern => {
    pattern.score = pattern.detector(formFields);
  });

  // Sort by score (highest first)
  patterns.sort((a, b) => b.score - a.score);
  const bestPattern = patterns[0];

  // Log all scores
  console.log('🔍 [PATTERN DETECTION]');
  console.log('All pattern scores:', patterns.map(p => `${p.name}: ${p.score}%`).join(', '));

  // Check threshold
  const THRESHOLD = 50;
  if (bestPattern.score >= THRESHOLD) {
    console.log(`✅ Pattern detected: ${bestPattern.name} (${bestPattern.score}%)`);
    return bestPattern;
  } else {
    console.log(`⚠️ No pattern matched (threshold: ${THRESHOLD}%, best: ${bestPattern.score}%)`);
    return null;
  }
}
```

**Step 3: Commit infrastructure**

```bash
cd /Users/taiichiwada/mascodex-2940045
git add goenchan/chrome-extension-v2/content.js
git commit -m "feat: add pattern detection infrastructure

Add global cache and main detectFormPattern() function with 5 pattern types.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Implement WordPress CF7 Pattern Detector

**Files:**
- Modify: `goenchan/chrome-extension-v2/content.js` (add after detectFormPattern function)

**Step 1: Write WordPress CF7 detector**

```javascript
/**
 * Detect WordPress Contact Form 7 pattern
 * Looks for fields with name="your-*"
 */
function detectWordPressCF7(fields) {
  let yourFieldCount = 0;

  fields.forEach(field => {
    const name = field.getAttribute('name') || '';
    if (name.startsWith('your-')) {
      yourFieldCount++;
    }
  });

  // Need 3+ fields to confidently detect
  if (yourFieldCount >= 3) {
    // Base score 50 + 10 per field, max 100
    const score = Math.min(100, 50 + (yourFieldCount * 10));
    console.log(`  [CF7] Found ${yourFieldCount} 'your-*' fields, score: ${score}`);
    return score;
  }

  return 0;
}
```

**Step 2: Commit CF7 detector**

```bash
git add goenchan/chrome-extension-v2/content.js
git commit -m "feat: add WordPress CF7 pattern detector

Detect forms with your-* field naming convention.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Implement Japanese Direct Pattern Detector

**Files:**
- Modify: `goenchan/chrome-extension-v2/content.js` (add after detectWordPressCF7)

**Step 1: Write Japanese direct detector**

```javascript
/**
 * Detect Japanese direct name attributes pattern
 * Looks for Japanese characters in name attributes
 */
function detectJapaneseDirect(fields) {
  let japaneseFieldCount = 0;
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/; // Hiragana, Katakana, Kanji

  fields.forEach(field => {
    const name = field.getAttribute('name') || '';
    if (japaneseRegex.test(name)) {
      japaneseFieldCount++;
    }
  });

  // Need 3+ Japanese fields
  if (japaneseFieldCount >= 3) {
    const score = Math.min(100, 50 + (japaneseFieldCount * 10));
    console.log(`  [Japanese] Found ${japaneseFieldCount} Japanese name fields, score: ${score}`);
    return score;
  }

  return 0;
}
```

**Step 2: Commit Japanese detector**

```bash
git add goenchan/chrome-extension-v2/content.js
git commit -m "feat: add Japanese direct pattern detector

Detect forms with Japanese characters in name attributes.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Implement Required Marks Pattern Detector

**Files:**
- Modify: `goenchan/chrome-extension-v2/content.js` (add after detectJapaneseDirect)

**Step 1: Write required marks detector**

```javascript
/**
 * Detect required marks pattern
 * Looks for fields with (必須) or （必須） in name
 */
function detectRequiredMarks(fields) {
  let requiredFieldCount = 0;
  const requiredRegex = /[（(]必須[)）]/;

  fields.forEach(field => {
    const name = field.getAttribute('name') || '';
    if (requiredRegex.test(name)) {
      requiredFieldCount++;
    }
  });

  // Need 2+ required mark fields (threshold lower than others)
  if (requiredFieldCount >= 2) {
    const score = Math.min(100, 50 + (requiredFieldCount * 15));
    console.log(`  [Required] Found ${requiredFieldCount} required mark fields, score: ${score}`);
    return score;
  }

  return 0;
}
```

**Step 2: Commit required marks detector**

```bash
git add goenchan/chrome-extension-v2/content.js
git commit -m "feat: add required marks pattern detector

Detect forms with (必須) markers in field names.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Implement MailForm CGI Pattern Detector

**Files:**
- Modify: `goenchan/chrome-extension-v2/content.js` (add after detectRequiredMarks)

**Step 1: Write MailForm CGI detector**

```javascript
/**
 * Detect MailForm CGI pattern
 * Looks for F[digit] or Email[digit] naming
 */
function detectMailFormCGI(fields) {
  let fFieldCount = 0;
  let emailFieldCount = 0;
  const fFieldRegex = /^F\d+$/;
  const emailFieldRegex = /^Email\d+$/i;

  fields.forEach(field => {
    const name = field.getAttribute('name') || '';
    if (fFieldRegex.test(name)) {
      fFieldCount++;
    } else if (emailFieldRegex.test(name)) {
      emailFieldCount++;
    }
  });

  const totalCount = fFieldCount + emailFieldCount;

  // Need 3+ CGI-style fields
  if (totalCount >= 3) {
    const score = Math.min(100, 40 + (totalCount * 12));
    console.log(`  [MailForm] Found ${fFieldCount} F-fields, ${emailFieldCount} Email-fields, score: ${score}`);
    return score;
  }

  return 0;
}
```

**Step 2: Commit MailForm detector**

```bash
git add goenchan/chrome-extension-v2/content.js
git commit -m "feat: add MailForm CGI pattern detector

Detect forms with F[digit] and Email[digit] naming convention.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Implement Split Fields Pattern Detector

**Files:**
- Modify: `goenchan/chrome-extension-v2/content.js` (add after detectMailFormCGI)

**Step 1: Write split fields detector**

```javascript
/**
 * Detect split fields pattern
 * Looks for numbered sequential fields (name1/name2, tel1/tel2/tel3)
 */
function detectSplitFields(fields) {
  const fieldGroups = {};
  const splitRegex = /^(.+?)(\d+)$/;

  fields.forEach(field => {
    const name = field.getAttribute('name') || '';
    const match = name.match(splitRegex);
    if (match) {
      const baseName = match[1];
      const number = parseInt(match[2]);

      if (!fieldGroups[baseName]) {
        fieldGroups[baseName] = [];
      }
      fieldGroups[baseName].push(number);
    }
  });

  // Count groups with 2+ sequential numbers
  let splitGroupCount = 0;
  for (const [baseName, numbers] of Object.entries(fieldGroups)) {
    if (numbers.length >= 2) {
      splitGroupCount++;
    }
  }

  // Need 2+ split groups
  if (splitGroupCount >= 2) {
    const score = Math.min(100, 50 + (splitGroupCount * 12));
    console.log(`  [Split] Found ${splitGroupCount} split field groups, score: ${score}`);
    return score;
  }

  return 0;
}
```

**Step 2: Commit split fields detector**

```bash
git add goenchan/chrome-extension-v2/content.js
git commit -m "feat: add split fields pattern detector

Detect forms with numbered sequential fields like name1/name2.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Implement Pattern Mapping Generator Infrastructure

**Files:**
- Modify: `goenchan/chrome-extension-v2/content.js` (add after split fields detector)

**Step 1: Write main mapping generator**

```javascript
/**
 * Generate field mapping based on detected pattern
 * Returns mapping object similar to SITE_MAPPINGS structure
 */
function generatePatternMapping(patternName, formFields) {
  console.log(`🗺️ [MAPPING GENERATION] Pattern: ${patternName}`);

  if (!formFields || formFields.length === 0) {
    console.log('⚠️ [MAPPING] No fields found for pattern generation');
    return {};
  }

  let mapping = {};

  switch(patternName) {
    case 'wordpress-cf7':
      mapping = generateWordPressCF7Mapping(formFields);
      break;
    case 'japanese-direct':
      mapping = generateJapaneseDirectMapping(formFields);
      break;
    case 'required-marks':
      mapping = generateRequiredMarksMapping(formFields);
      break;
    case 'mailform-cgi':
      mapping = generateMailFormCGIMapping(formFields);
      break;
    case 'split-fields':
      mapping = generateSplitFieldsMapping(formFields);
      break;
    default:
      console.log(`⚠️ [MAPPING] Unknown pattern: ${patternName}`);
      return {};
  }

  console.log('Generated mapping:', mapping);
  console.log(`  - Mapped ${Object.keys(mapping).length} field types`);

  return mapping;
}
```

**Step 2: Commit generator infrastructure**

```bash
git add goenchan/chrome-extension-v2/content.js
git commit -m "feat: add pattern mapping generator infrastructure

Add main generatePatternMapping() function with switch for 5 patterns.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Implement WordPress CF7 Mapping Generator

**Files:**
- Modify: `goenchan/chrome-extension-v2/content.js` (add after generatePatternMapping)

**Step 1: Write CF7 mapping generator**

```javascript
/**
 * Generate mapping for WordPress Contact Form 7
 */
function generateWordPressCF7Mapping(fields) {
  const mapping = {};

  const cf7FieldMap = {
    'your-name': { field: 'name', confidence: 90 },
    'your-email': { field: 'email', confidence: 95 },
    'your-subject': { field: 'subject', confidence: 90 },
    'your-message': { field: 'message', confidence: 90 },
    'your-tel': { field: 'phone', confidence: 85 },
    'your-phone': { field: 'phone', confidence: 85 },
    'your-company': { field: 'company', confidence: 85 },
    'your-zipcode': { field: 'zipcode', confidence: 85 },
    'your-address': { field: 'address', confidence: 85 }
  };

  fields.forEach(field => {
    const name = field.getAttribute('name') || '';
    if (cf7FieldMap[name]) {
      const { field: fieldType, confidence } = cf7FieldMap[name];
      mapping[fieldType] = {
        selector: `[name="${name}"]`,
        confidence: confidence
      };
    }
  });

  return mapping;
}
```

**Step 2: Commit CF7 generator**

```bash
git add goenchan/chrome-extension-v2/content.js
git commit -m "feat: add WordPress CF7 mapping generator

Generate high-confidence mappings for your-* fields.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Implement Japanese Direct Mapping Generator

**Files:**
- Modify: `goenchan/chrome-extension-v2/content.js` (add after generateWordPressCF7Mapping)

**Step 1: Write Japanese direct generator**

```javascript
/**
 * Generate mapping for Japanese direct name attributes
 */
function generateJapaneseDirectMapping(fields) {
  const mapping = {};

  const japaneseFieldMap = {
    'お名前': { field: 'name', confidence: 85 },
    '氏名': { field: 'name', confidence: 85 },
    '会社名': { field: 'company', confidence: 90 },
    '企業名': { field: 'company', confidence: 90 },
    'メール': { field: 'email', confidence: 85 },
    'メールアドレス': { field: 'email', confidence: 90 },
    'Eメール': { field: 'email', confidence: 85 },
    '電話': { field: 'phone', confidence: 80 },
    '電話番号': { field: 'phone', confidence: 85 },
    '件名': { field: 'subject', confidence: 85 },
    'お問い合わせ内容': { field: 'message', confidence: 85 },
    'メッセージ': { field: 'message', confidence: 80 },
    '本文': { field: 'message', confidence: 80 },
    '郵便番号': { field: 'zipcode', confidence: 85 },
    '住所': { field: 'address', confidence: 85 }
  };

  fields.forEach(field => {
    const name = field.getAttribute('name') || '';
    if (japaneseFieldMap[name]) {
      const { field: fieldType, confidence } = japaneseFieldMap[name];
      mapping[fieldType] = {
        selector: `[name="${name}"]`,
        confidence: confidence
      };
    }
  });

  return mapping;
}
```

**Step 2: Commit Japanese generator**

```bash
git add goenchan/chrome-extension-v2/content.js
git commit -m "feat: add Japanese direct mapping generator

Generate mappings for Japanese name attributes.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Implement Required Marks Mapping Generator

**Files:**
- Modify: `goenchan/chrome-extension-v2/content.js` (add after generateJapaneseDirectMapping)

**Step 1: Write required marks generator**

```javascript
/**
 * Generate mapping for required marks pattern
 * Strip (必須) from field names and match
 */
function generateRequiredMarksMapping(fields) {
  const mapping = {};
  const requiredRegex = /[（(]必須[)）]/g;

  const keywordMap = {
    '会社名': { field: 'company', confidence: 80 },
    '企業名': { field: 'company', confidence: 80 },
    'お名前': { field: 'name', confidence: 75 },
    '氏名': { field: 'name', confidence: 75 },
    '名前': { field: 'name', confidence: 75 },
    'メール': { field: 'email', confidence: 80 },
    'メールアドレス': { field: 'email', confidence: 85 },
    '電話': { field: 'phone', confidence: 75 },
    '電話番号': { field: 'phone', confidence: 80 },
    '件名': { field: 'subject', confidence: 75 },
    'お問い合わせ内容': { field: 'message', confidence: 75 },
    'メッセージ': { field: 'message', confidence: 70 }
  };

  fields.forEach(field => {
    const name = field.getAttribute('name') || '';
    // Strip required marks
    const cleanName = name.replace(requiredRegex, '').trim();

    if (keywordMap[cleanName]) {
      const { field: fieldType, confidence } = keywordMap[cleanName];
      mapping[fieldType] = {
        selector: `[name="${name}"]`,
        confidence: confidence
      };
    }
  });

  return mapping;
}
```

**Step 2: Commit required marks generator**

```bash
git add goenchan/chrome-extension-v2/content.js
git commit -m "feat: add required marks mapping generator

Strip (必須) markers and generate mappings.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Implement MailForm CGI Mapping Generator

**Files:**
- Modify: `goenchan/chrome-extension-v2/content.js` (add after generateRequiredMarksMapping)

**Step 1: Write MailForm CGI generator**

```javascript
/**
 * Generate mapping for MailForm CGI pattern
 * Uses inference based on field order and Email fields
 */
function generateMailFormCGIMapping(fields) {
  const mapping = {};
  const fFields = [];

  // Collect F-fields in order
  fields.forEach(field => {
    const name = field.getAttribute('name') || '';
    const match = name.match(/^F(\d+)$/);
    if (match) {
      fFields.push({ num: parseInt(match[1]), name: name, field: field });
    }

    // Email fields are usually explicit
    if (name.match(/^Email\d+$/i)) {
      mapping.email = {
        selector: `[name="${name}"]`,
        confidence: 85
      };
    }
  });

  // Sort by field number
  fFields.sort((a, b) => a.num - b.num);

  // Infer field types based on common patterns
  // F1 or F2 is often name or company
  if (fFields.length >= 1 && !mapping.name) {
    mapping.name = {
      selector: `[name="${fFields[0].name}"]`,
      confidence: 65
    };
  }

  if (fFields.length >= 2 && !mapping.company) {
    mapping.company = {
      selector: `[name="${fFields[1].name}"]`,
      confidence: 60
    };
  }

  // Later fields might be phone, address
  if (fFields.length >= 3) {
    mapping.phone = {
      selector: `[name="${fFields[2].name}"]`,
      confidence: 55
    };
  }

  return mapping;
}
```

**Step 2: Commit MailForm generator**

```bash
git add goenchan/chrome-extension-v2/content.js
git commit -m "feat: add MailForm CGI mapping generator

Generate low-confidence mappings using field order inference.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 12: Implement Split Fields Mapping Generator

**Files:**
- Modify: `goenchan/chrome-extension-v2/content.js` (add after generateMailFormCGIMapping)

**Step 1: Write split fields generator**

```javascript
/**
 * Generate mapping for split fields pattern
 * Detect name1/name2, tel1/tel2/tel3, etc.
 */
function generateSplitFieldsMapping(fields) {
  const mapping = {};
  const fieldGroups = {};
  const splitRegex = /^(.+?)(\d+)$/;

  // Group fields by base name
  fields.forEach(field => {
    const name = field.getAttribute('name') || '';
    const match = name.match(splitRegex);
    if (match) {
      const baseName = match[1];
      const number = parseInt(match[2]);

      if (!fieldGroups[baseName]) {
        fieldGroups[baseName] = [];
      }
      fieldGroups[baseName].push({ number, name, field });
    }
  });

  // Identify split patterns
  for (const [baseName, group] of Object.entries(fieldGroups)) {
    if (group.length >= 2) {
      group.sort((a, b) => a.number - b.number);
      const names = group.map(g => g.name);

      // Name splits (name1, name2 or sei, mei)
      if (baseName.match(/name|名前|氏名|sei|mei/i)) {
        mapping.name1 = { selector: `[name="${names[0]}"]`, confidence: 80 };
        if (names[1]) {
          mapping.name2 = { selector: `[name="${names[1]}"]`, confidence: 80 };
        }
      }

      // Kana splits
      if (baseName.match(/kana|カナ|かな|フリガナ/i)) {
        mapping.name_kana1 = { selector: `[name="${names[0]}"]`, confidence: 80 };
        if (names[1]) {
          mapping.name_kana2 = { selector: `[name="${names[1]}"]`, confidence: 80 };
        }
      }

      // Phone splits (tel1, tel2, tel3)
      if (baseName.match(/tel|phone|電話/i)) {
        mapping.phone1 = { selector: `[name="${names[0]}"]`, confidence: 85 };
        if (names[1]) {
          mapping.phone2 = { selector: `[name="${names[1]}"]`, confidence: 85 };
        }
        if (names[2]) {
          mapping.phone3 = { selector: `[name="${names[2]}"]`, confidence: 85 };
        }
      }

      // Zipcode splits
      if (baseName.match(/zip|postal|郵便/i)) {
        mapping.zipcode1 = { selector: `[name="${names[0]}"]`, confidence: 85 };
        if (names[1]) {
          mapping.zipcode2 = { selector: `[name="${names[1]}"]`, confidence: 85 };
        }
      }
    }
  }

  return mapping;
}
```

**Step 2: Commit split fields generator**

```bash
git add goenchan/chrome-extension-v2/content.js
git commit -m "feat: add split fields mapping generator

Detect and map name/phone/zipcode splits.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 13: Integrate Pattern Detection on Page Load

**Files:**
- Modify: `goenchan/chrome-extension-v2/content.js` (modify checkAndAutoFill function around line 71)

**Step 1: Add pattern detection to page load**

Find the `checkAndAutoFill` function and add pattern detection after the profile check (around line 93), before the known site check:

```javascript
    // Check 3: Detect form pattern (new!)
    console.log('🔍 [DEBUG] Detecting form pattern...');
    const detectedPattern = detectFormPattern();

    if (detectedPattern && detectedPattern.score >= 50) {
      const formFields = document.querySelectorAll('input, textarea, select');
      cachedPatternMapping = generatePatternMapping(detectedPattern.name, formFields);
      cachedPatternInfo = detectedPattern;
      console.log('💾 [CACHE] Pattern mapping cached:', cachedPatternMapping);
    } else {
      console.log('ℹ️ [CACHE] No pattern mapping cached (using auto-detection fallback)');
    }

    // Check 4: Is this a known site? (renumber from Check 3)
```

**Step 2: Test pattern detection on test form**

Open test-form.html in browser with extension loaded:
- Expected: Console shows pattern detection logs
- Expected: Pattern scores displayed
- Expected: Best pattern detected (if any)

**Step 3: Commit integration**

```bash
git add goenchan/chrome-extension-v2/content.js
git commit -m "feat: integrate pattern detection on page load

Run pattern detection and cache results during checkAndAutoFill.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 14: Update autoFillForm to Use Pattern Mappings

**Files:**
- Modify: `goenchan/chrome-extension-v2/content.js` (find autoFillForm function, around line 150-200)

**Step 1: Locate the autoFillForm function**

Find the `autoFillForm` function that handles form filling.

**Step 2: Add pattern mapping to priority system**

Find where SITE_MAPPINGS are applied (look for the mapping priority logic). Add pattern mapping as a layer:

```javascript
// Priority 1: SITE_MAPPINGS
const siteMapping = getSiteMappingForUrl(currentUrl);

// Priority 2: Learned mappings (from chrome.storage)
const { learnedMappings } = await chrome.storage.sync.get(['learnedMappings']);
const learnedMapping = learnedMappings?.[currentUrl] || {};

// Priority 3: Pattern mapping (NEW!)
const patternMapping = cachedPatternMapping || {};

// Merge with priority (later overrides earlier)
const mergedMapping = {
  ...patternMapping,      // Base: pattern-detected fields
  ...learnedMapping,      // Override: user-learned fields
  ...siteMapping          // Override: explicit site config
};

console.log('🔀 [MERGE] Final mapping:');
console.log('  - SITE_MAPPINGS fields:', Object.keys(siteMapping || {}).length);
console.log('  - Learned fields:', Object.keys(learnedMapping).length);
console.log('  - Pattern fields:', Object.keys(patternMapping).length);
console.log('  - Total merged fields:', Object.keys(mergedMapping).length);
```

**Step 3: Apply merged mapping**

Use the merged mapping to fill fields before falling back to auto-detection.

**Step 4: Commit integration**

```bash
git add goenchan/chrome-extension-v2/content.js
git commit -m "feat: integrate pattern mappings into autoFillForm

Add pattern mappings as priority layer 3 in merge strategy.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 15: Create Enhanced Test Form

**Files:**
- Create: `goenchan/chrome-extension-v2/test-form-patterns.html`

**Step 1: Create test form with 5 pattern examples**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>Pattern Recognition Test Form</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 1200px;
      margin: 20px auto;
      padding: 20px;
    }
    .pattern-section {
      border: 2px solid #ccc;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
    }
    .pattern-section h2 {
      margin-top: 0;
      color: #333;
    }
    .form-group {
      margin: 10px 0;
    }
    label {
      display: inline-block;
      width: 200px;
      font-weight: bold;
    }
    input, textarea, select {
      width: 300px;
      padding: 5px;
      margin: 5px 0;
    }
    textarea {
      height: 80px;
    }
    .pattern-info {
      background: #f0f0f0;
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 15px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <h1>🧪 Pattern Recognition Test Form</h1>
  <p>This form tests all 5 pattern detection types. Open console (F12) to see detection logs.</p>

  <!-- Pattern 1: WordPress Contact Form 7 -->
  <div class="pattern-section">
    <h2>1. WordPress Contact Form 7 Pattern</h2>
    <div class="pattern-info">
      <strong>Expected:</strong> Pattern "wordpress-cf7" detected (score ≥ 50%)<br>
      <strong>Fields:</strong> your-* naming convention
    </div>
    <form>
      <div class="form-group">
        <label>お名前:</label>
        <input type="text" name="your-name" placeholder="山田太郎">
      </div>
      <div class="form-group">
        <label>メールアドレス:</label>
        <input type="email" name="your-email" placeholder="example@example.com">
      </div>
      <div class="form-group">
        <label>電話番号:</label>
        <input type="tel" name="your-tel" placeholder="03-1234-5678">
      </div>
      <div class="form-group">
        <label>会社名:</label>
        <input type="text" name="your-company" placeholder="株式会社サンプル">
      </div>
      <div class="form-group">
        <label>件名:</label>
        <input type="text" name="your-subject" placeholder="お問い合わせ">
      </div>
      <div class="form-group">
        <label>メッセージ:</label>
        <textarea name="your-message" placeholder="お問い合わせ内容"></textarea>
      </div>
    </form>
  </div>

  <!-- Pattern 2: Japanese Direct -->
  <div class="pattern-section">
    <h2>2. Japanese Direct Name Attributes Pattern</h2>
    <div class="pattern-info">
      <strong>Expected:</strong> Pattern "japanese-direct" detected<br>
      <strong>Fields:</strong> Japanese characters in name attributes
    </div>
    <form>
      <div class="form-group">
        <label>お名前:</label>
        <input type="text" name="お名前" placeholder="山田太郎">
      </div>
      <div class="form-group">
        <label>会社名:</label>
        <input type="text" name="会社名" placeholder="株式会社サンプル">
      </div>
      <div class="form-group">
        <label>メール:</label>
        <input type="email" name="メール" placeholder="example@example.com">
      </div>
      <div class="form-group">
        <label>電話番号:</label>
        <input type="tel" name="電話番号" placeholder="03-1234-5678">
      </div>
      <div class="form-group">
        <label>お問い合わせ内容:</label>
        <textarea name="お問い合わせ内容" placeholder="内容"></textarea>
      </div>
    </form>
  </div>

  <!-- Pattern 3: Required Marks -->
  <div class="pattern-section">
    <h2>3. Required Marks Pattern</h2>
    <div class="pattern-info">
      <strong>Expected:</strong> Pattern "required-marks" detected<br>
      <strong>Fields:</strong> (必須) markers in field names
    </div>
    <form>
      <div class="form-group">
        <label>会社名（必須）:</label>
        <input type="text" name="会社名(必須)" placeholder="株式会社サンプル">
      </div>
      <div class="form-group">
        <label>氏名（必須）:</label>
        <input type="text" name="氏名(必須)" placeholder="山田太郎">
      </div>
      <div class="form-group">
        <label>メールアドレス（必須）:</label>
        <input type="email" name="メールアドレス(必須)" placeholder="example@example.com">
      </div>
      <div class="form-group">
        <label>電話番号:</label>
        <input type="tel" name="電話番号" placeholder="03-1234-5678">
      </div>
      <div class="form-group">
        <label>お問い合わせ内容（必須）:</label>
        <textarea name="お問い合わせ内容(必須)" placeholder="内容"></textarea>
      </div>
    </form>
  </div>

  <!-- Pattern 4: MailForm CGI -->
  <div class="pattern-section">
    <h2>4. MailForm CGI Pattern</h2>
    <div class="pattern-info">
      <strong>Expected:</strong> Pattern "mailform-cgi" detected<br>
      <strong>Fields:</strong> F[digit] and Email[digit] naming
    </div>
    <form>
      <div class="form-group">
        <label>お名前:</label>
        <input type="text" name="F1" placeholder="山田太郎">
      </div>
      <div class="form-group">
        <label>会社名:</label>
        <input type="text" name="F2" placeholder="株式会社サンプル">
      </div>
      <div class="form-group">
        <label>電話:</label>
        <input type="tel" name="F3" placeholder="03-1234-5678">
      </div>
      <div class="form-group">
        <label>メール:</label>
        <input type="email" name="Email6" placeholder="example@example.com">
      </div>
      <div class="form-group">
        <label>内容:</label>
        <textarea name="F10" placeholder="お問い合わせ内容"></textarea>
      </div>
    </form>
  </div>

  <!-- Pattern 5: Split Fields -->
  <div class="pattern-section">
    <h2>5. Split Fields Pattern</h2>
    <div class="pattern-info">
      <strong>Expected:</strong> Pattern "split-fields" detected<br>
      <strong>Fields:</strong> Numbered sequential fields (name1/name2, tel1/tel2/tel3)
    </div>
    <form>
      <div class="form-group">
        <label>姓:</label>
        <input type="text" name="name1" placeholder="山田">
      </div>
      <div class="form-group">
        <label>名:</label>
        <input type="text" name="name2" placeholder="太郎">
      </div>
      <div class="form-group">
        <label>セイ:</label>
        <input type="text" name="kana1" placeholder="ヤマダ">
      </div>
      <div class="form-group">
        <label>メイ:</label>
        <input type="text" name="kana2" placeholder="タロウ">
      </div>
      <div class="form-group">
        <label>電話1:</label>
        <input type="text" name="tel1" placeholder="03" size="5">
      </div>
      <div class="form-group">
        <label>電話2:</label>
        <input type="text" name="tel2" placeholder="1234" size="5">
      </div>
      <div class="form-group">
        <label>電話3:</label>
        <input type="text" name="tel3" placeholder="5678" size="5">
      </div>
      <div class="form-group">
        <label>郵便番号1:</label>
        <input type="text" name="zip1" placeholder="123" size="5">
      </div>
      <div class="form-group">
        <label>郵便番号2:</label>
        <input type="text" name="zip2" placeholder="4567" size="5">
      </div>
      <div class="form-group">
        <label>会社名:</label>
        <input type="text" name="company" placeholder="株式会社サンプル">
      </div>
      <div class="form-group">
        <label>メール:</label>
        <input type="email" name="email" placeholder="example@example.com">
      </div>
    </form>
  </div>

  <script>
    console.log('🧪 Pattern Recognition Test Form Loaded');
    console.log('📋 5 patterns available for testing');
    console.log('👀 Watch the console for pattern detection logs');
  </script>
</body>
</html>
```

**Step 2: Commit test form**

```bash
git add goenchan/chrome-extension-v2/test-form-patterns.html
git commit -m "test: add pattern recognition test form

Add comprehensive test form with all 5 pattern types.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 16: Manual Testing - Pattern Detection

**Files:**
- Test: `goenchan/chrome-extension-v2/test-form-patterns.html`

**Step 1: Load extension in Chrome**

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `goenchan/chrome-extension-v2/` directory

**Step 2: Test each pattern section**

For each of the 5 sections in test-form-patterns.html:

1. Open the file: `file:///Users/taiichiwada/mascodex-2940045/goenchan/chrome-extension-v2/test-form-patterns.html#pattern-N` (where N = 1-5)
2. Open DevTools (F12) → Console
3. Reload page
4. Verify in console:
   - `🔍 [PATTERN DETECTION]` appears
   - All 5 pattern scores displayed
   - Correct pattern detected (e.g., "wordpress-cf7" for section 1)
   - Pattern score >= 50%
   - `💾 [CACHE] Pattern mapping cached` appears

**Expected output example for WordPress CF7:**
```
🔍 [PATTERN DETECTION]
  [CF7] Found 6 'your-*' fields, score: 100
All pattern scores: wordpress-cf7: 100%, japanese-direct: 0%, ...
✅ Pattern detected: wordpress-cf7 (100%)
🗺️ [MAPPING GENERATION] Pattern: wordpress-cf7
Generated mapping: { name: {...}, email: {...}, ... }
  - Mapped 6 field types
💾 [CACHE] Pattern mapping cached
```

**Step 3: Document test results**

Create test results file noting:
- Which patterns detected correctly
- Any false positives/negatives
- Score accuracy

---

## Task 17: Manual Testing - Form Filling with Patterns

**Files:**
- Test: `goenchan/chrome-extension-v2/test-form-patterns.html`

**Step 1: Configure profile in extension**

1. Click extension icon
2. Go to Profile Settings
3. Fill in test data:
   - Name: 山田太郎
   - Company: 株式会社テスト
   - Email: test@example.com
   - Phone: 03-1234-5678
   - Subject: お問い合わせ
   - Message: テストメッセージ
4. Save profile

**Step 2: Test auto-fill on each pattern**

For each pattern section in test-form-patterns.html:

1. Reload page to specific pattern section
2. Wait for pattern detection
3. Click extension → "Auto Fill" button
4. Verify in console:
   - `🔀 [MERGE] Final mapping:` appears
   - Pattern fields count > 0
   - `✅ Filled:` messages appear
5. Verify visually:
   - Correct fields are filled
   - Values are accurate
   - Split fields work correctly

**Expected behavior:**
- WordPress CF7: All your-* fields filled correctly
- Japanese direct: Japanese name fields filled
- Required marks: Fields with (必須) filled correctly
- MailForm CGI: F1, F2, Email6 filled (may be partial)
- Split fields: name1/name2, tel1/tel2/tel3 filled correctly

**Step 3: Test fallback to auto-detection**

1. Remove some fields from a pattern (e.g., remove "your-company" from CF7 form)
2. Reload page
3. Click "Auto Fill"
4. Verify company field still fills via auto-detection fallback

---

## Task 18: Update Version Number

**Files:**
- Modify: `goenchan/chrome-extension-v2/manifest.json`

**Step 1: Update version to 2.11.0**

```json
{
  "manifest_version": 3,
  "name": "Contact Form Auto-Filler Pro",
  "version": "2.11.0",
  "description": "Advanced form auto-filler with AI-powered sales letter generation and pattern recognition",
```

**Step 2: Commit version bump**

```bash
git add goenchan/chrome-extension-v2/manifest.json
git commit -m "chore: bump version to 2.11.0

Release pattern recognition feature.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 19: Create Release Documentation

**Files:**
- Create: `goenchan/chrome-extension-v2/CHANGELOG.md`

**Step 1: Create changelog entry**

```markdown
# Changelog

## [2.11.0] - 2026-02-04

### Added
- **Pattern Recognition System**: Automatically detects 5 common form builder patterns
  - WordPress Contact Form 7 (your-* fields)
  - Japanese Direct Name Attributes
  - Required Marks Pattern (必須)
  - MailForm CGI (F[digit] naming)
  - Split Fields (name1/name2, tel1/tel2/tel3)
- Dynamic mapping generation based on detected patterns
- Pattern-based confidence scoring (60-95% depending on certainty)
- Detailed console logging for pattern detection and mapping generation
- New test form: `test-form-patterns.html` with all 5 pattern examples

### Changed
- Auto-fill priority system now includes pattern mappings (layer 3)
- Pattern detection runs once on page load and caches results
- Mapping merge order: SITE_MAPPINGS → learned → pattern → auto-detection

### Improved
- Form fill accuracy on unknown forms
- Better handling of non-standard field naming conventions
- Reduced reliance on manual SITE_MAPPINGS configuration

## [2.10.2] - [Previous Date]
...
```

**Step 2: Commit changelog**

```bash
git add goenchan/chrome-extension-v2/CHANGELOG.md
git commit -m "docs: add v2.11.0 changelog

Document pattern recognition feature release.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 20: Final Integration Test

**Files:**
- Test: All files

**Step 1: Test on existing 46 sites (regression)**

Pick 5 sites from SITE_MAPPINGS:
1. test-form.html
2. kandacoffee.jp (if accessible)
3. Any 3 others from the list

For each site:
1. Load page
2. Check console for pattern detection (should not interfere)
3. Click "Auto Fill"
4. Verify SITE_MAPPINGS still takes priority
5. Verify no regression (fields fill correctly)

**Step 2: Test on unknown forms**

Find 2-3 real forms in the wild (not in SITE_MAPPINGS):
1. WordPress CF7 form (search "your-email" in HTML)
2. Japanese form with direct naming
3. Any other form

For each:
1. Load page
2. Check if pattern detected
3. Click "Auto Fill"
4. Verify improvement over pure auto-detection

**Step 3: Performance check**

1. Open large form page (50+ fields)
2. Measure pattern detection time in console
3. Ensure < 100ms detection time
4. Verify no lag in page load

**Step 4: Document results**

Note any issues, edge cases, or improvements needed.

---

## Success Criteria

✅ All 5 pattern detectors implemented and working
✅ All 5 mapping generators implemented and working
✅ Pattern detection runs on page load and caches results
✅ Pattern mappings integrate into priority system (layer 3)
✅ Test form with all 5 patterns created and working
✅ Pattern detection logs are clear and actionable
✅ Form fill accuracy improves on unknown forms
✅ No regression on existing 46 sites
✅ Version bumped to 2.11.0
✅ Changelog and documentation updated

---

## Notes

- Pattern detection is opportunistic: if no pattern matches, fall back gracefully
- Confidence levels vary by pattern certainty (CF7 high, MailForm low)
- Pattern results are cached per page load (not re-detected)
- Future: could add pattern learning based on user corrections
- Future: could combine multiple patterns (out of scope for v2.11.0)
