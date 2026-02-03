# Changelog

## [2.11.0] - 2026-02-04

### Added - Pattern Recognition System
- **Intelligent Form Pattern Detection**: New pattern recognition engine analyzes form structures and naming conventions
- **5 Common Japanese Form Patterns**:
  1. WordPress Contact Form 7 (`your-name`, `your-email`, `your-message`)
  2. Japanese Direct Naming (氏名, メールアドレス, 電話番号)
  3. Required Marks Pattern (必須, *, ※ in labels)
  4. MailForm CGI Style (`name1`, `email1`, `tel1`, `contents1`)
  5. Split Name Fields (姓/名, セイ/メイ separate inputs)
- **Smart Field Mapping**: Automatically maps form fields to user data based on detected patterns
- **Pattern Scoring System**: Confidence scores for each detected pattern (shown in console)
- **Enhanced Logging**: Detailed console output for debugging pattern detection

### Improved
- **Field Detection Accuracy**: Better handling of Japanese form naming conventions
- **Auto-Fill Intelligence**: Prioritizes pattern-based mapping over generic field detection
- **Split Name Support**: Properly fills separate 姓(last name) and 名(first name) fields
- **Furigana Handling**: Correctly populates セイ/メイ kana fields when available

### Technical
- Refactored field detection logic into modular pattern system
- Added `detectFormPattern()` function with scoring mechanism
- Pattern detection runs before field mapping for optimal results
- Backward compatible with existing SITE_MAPPINGS (46 sites)

### Testing
- New comprehensive test form: `test-form-patterns.html`
- Test results template: `TEST_RESULTS_v2.11.0.md`
- Integration test checklist included

### Files Modified
- `content.js`: Added pattern recognition engine
- `manifest.json`: Version bump to 2.11.0

## [2.10.2] - 2025-01-XX
Previous version with basic auto-fill functionality and 46 site mappings.
