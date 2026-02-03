# Form Pattern Recognition Feature Design

**Date:** 2026-02-04
**Version:** v2.11.0
**Status:** Approved

## Overview

Add pattern recognition functionality to automatically detect common form builder patterns and generate accurate field mappings, improving form fill accuracy across multiple sites.

## Goals

- Detect form patterns on page load (WordPress CF7, Japanese direct, MailForm CGI, etc.)
- Generate dynamic field mappings based on detected patterns
- Integrate with existing 3-tier system (SITE_MAPPINGS → learned → auto-detection)
- Improve fill accuracy for unknown forms

## Requirements Summary

### Pattern Detection
- **Timing:** Once on page load, cache result
- **Threshold:** 50% confidence or higher to adopt pattern
- **Strategy:** Use highest-scoring pattern only
- **Scoring:** Prioritize name attribute pattern matching

### Five Pattern Types

1. **WordPress Contact Form 7**
   - Detection: 3+ fields with `name="your-*"`
   - Examples: `your-name`, `your-email`, `your-message`
   - Confidence: 85-95 (high certainty)

2. **Japanese Direct Name Attributes**
   - Detection: 3+ fields with Japanese name attributes
   - Examples: `name="お名前"`, `name="メール"`
   - Confidence: 80-90

3. **Required Marks Pattern**
   - Detection: 2+ fields with parenthetical required markers
   - Examples: `name="会社名(必須)"`, `name="氏名（必須）"`
   - Confidence: 70-85

4. **MailForm CGI**
   - Detection: 3+ fields matching `F[digit]` or `Email[digit]`
   - Examples: `F1`, `F2`, `Email6`
   - Confidence: 60-75 (requires inference)

5. **Split Fields Pattern**
   - Detection: 2+ sets of numbered sequential fields
   - Examples: name1/name2, tel1/tel2/tel3
   - Confidence: 75-90

### Mapping Generation
- Dynamic mapping objects (same structure as SITE_MAPPINGS)
- Per-field confidence levels based on certainty
- Fallback to auto-detection for unmatched fields

### Integration
Priority order:
1. SITE_MAPPINGS (confidence: 100)
2. Learned mappings (chrome.storage)
3. **Pattern mappings (confidence: 60-95)** ← NEW
4. Auto-detection fallback

### Logging
Detailed console output:
- All pattern scores
- Detected pattern and score
- Generated mapping
- Merge statistics (sources and field counts)
- Fill results with confidence and source

## Architecture

### Data Flow

```
Page Load
  ↓
detectFormPattern()
  ↓
Calculate scores for 5 patterns
  ↓
Best score >= 50%?
  ↓ YES                        ↓ NO
generatePatternMapping()       Use existing auto-detection
  ↓
Cache dynamic mapping
  ↓
On fill button click:
Merge mappings (SITE → learned → pattern → auto)
  ↓
Fill form with merged mapping
```

### New Functions

```javascript
// Main detection function
detectFormPattern() → { name: string, score: number } | null

// Pattern-specific detectors
detectWordPressCF7(fields) → score
detectJapaneseDirect(fields) → score
detectRequiredMarks(fields) → score
detectMailFormCGI(fields) → score
detectSplitFields(fields) → score

// Mapping generators
generatePatternMapping(patternName, fields) → mapping
generateWordPressCF7Mapping(fields) → mapping
generateJapaneseDirectMapping(fields) → mapping
generateRequiredMarksMapping(fields) → mapping
generateMailFormCGIMapping(fields) → mapping
generateSplitFieldsMapping(fields) → mapping

// Integration
fillFormWithPriority(profileData) → void
```

### Global State

```javascript
let cachedPatternMapping = null; // Cache pattern result
```

## Implementation Details

### 1. Pattern Detection Logic

**Score Calculation:**
- Count matching fields for each pattern
- Threshold: 3+ matches for most patterns (2+ for required-marks)
- Score formula: `min(100, baseScore + (matchCount * bonusPerMatch))`
- Base scores vary by pattern certainty

**Example: WordPress CF7**
```javascript
function detectWordPressCF7(fields) {
  let yourFieldCount = 0;
  fields.forEach(field => {
    const name = field.getAttribute('name') || '';
    if (name.startsWith('your-')) yourFieldCount++;
  });

  if (yourFieldCount >= 3) {
    return Math.min(100, 50 + (yourFieldCount * 10));
  }
  return 0;
}
```

### 2. Mapping Generation

**WordPress CF7 Mapping:**
```javascript
const cf7FieldMap = {
  'your-name': { field: 'name', confidence: 90 },
  'your-email': { field: 'email', confidence: 95 },
  'your-subject': { field: 'subject', confidence: 90 },
  'your-message': { field: 'message', confidence: 90 },
  'your-tel': { field: 'phone', confidence: 85 },
  'your-company': { field: 'company', confidence: 85 }
};
```

**MailForm CGI Mapping (Inference-based):**
- Lower confidence (60-70) due to ambiguous field names
- Use field order and type hints to infer purpose
- Email fields often explicitly named (`Email6`)

### 3. Integration Points

**Initialization:**
```javascript
document.addEventListener('DOMContentLoaded', function() {
  const pattern = detectFormPattern();
  if (pattern && pattern.score >= 50) {
    const fields = document.querySelectorAll('input, textarea, select');
    cachedPatternMapping = generatePatternMapping(pattern.name, fields);
  }
});
```

**Merge Strategy:**
```javascript
const mergedMapping = {
  ...patternMapping,    // Base layer
  ...learnedMapping,    // Override with learned
  ...siteMapping        // Override with explicit site config
};
```

### 4. Error Handling

- Multiple forms: Analyze all fields together
- No forms found: Log warning, skip pattern detection
- Tied scores: Use definition order (priority order)
- Invalid selectors: Try-catch with fallback
- Missing fields: Return empty mapping, rely on auto-detection

### 5. Logging Format

```
🔍 [PATTERN DETECTION]
All pattern scores: wordpress-cf7: 80%, japanese-direct: 20%, ...
✅ Pattern detected: wordpress-cf7 (80%)
🗺️ [MAPPING GENERATION] Pattern: wordpress-cf7
Generated mapping: { name: {...}, email: {...} }
💾 [CACHE] Pattern mapping cached
🔀 [MERGE] Final mapping:
  - SITE_MAPPINGS fields: 0
  - Learned fields: 1
  - Pattern fields: 3
✅ Filled: name (confidence: 90, source: pattern)
```

## Testing Strategy

1. **Unit Testing:**
   - Test each detector function with sample HTML
   - Verify score calculations
   - Test mapping generation for each pattern

2. **Integration Testing:**
   - Add 5 pattern examples to test-form.html
   - Verify correct pattern detection
   - Verify correct field filling

3. **Regression Testing:**
   - Test existing 46 sites to ensure no breakage
   - Verify SITE_MAPPINGS still take priority

4. **Real-world Testing:**
   - Test on unknown forms in the wild
   - Collect success/failure data
   - Iterate on detection logic

## Version Update

- **Current:** v2.10.2
- **Target:** v2.11.0 (new feature)

## Success Metrics

- Pattern detection accuracy > 80% for known pattern types
- Form fill success rate improvement on unknown forms
- No regression on existing 46 sites
- Clear, actionable debug logs

## Future Enhancements (Out of Scope)

- Pattern learning (user-corrected mappings)
- Pattern combinations (detect multiple patterns)
- MutationObserver for dynamic forms
- Pattern confidence tuning based on usage data

---

**Design approved for implementation.**
