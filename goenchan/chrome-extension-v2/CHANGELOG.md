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

## [2.10.2] - 2025-01-XX
Previous version with basic auto-fill functionality and 46 site mappings.
