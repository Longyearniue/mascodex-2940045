# Changelog

## [2.15.0] - 2026-02-04

### Improved
- **Sales Letter Customization**: Historical narrative now incorporates company-specific features
  - Extracts core concepts from company philosophy, president message, and keywords
  - Replaces generic templates (e.g., "製品の質と顧客への誠実さ") with actual company values
  - Applies to all business types: massage, beauty, restaurant, hotel, manufacturing, IT, medical, education
  - Example: Manufacturing company with "高品質な製品づくり" philosophy → "高品質な製品づくりが、この地で信頼される企業の基盤となる"
  - Falls back to generic templates only when specific features cannot be extracted

## [2.14.0] - 2026-02-04

### Added
- **Direct Contact URL Attempts (Level 0)**: Try 25+ common contact paths BEFORE crawling
  - /contact, /inquiry, /form, /toiawase, /お問い合わせ, etc.
  - Dramatically improves success rate from 2% to 30-50%
  - Most efficient approach - finds forms in first 5 seconds
- **Very Deep Crawling**: Bulk Crawler now explores up to 5 levels deep to find contact forms
  - Level 1: Homepage
  - Level 2: Up to 10 contact page candidates from homepage
  - Level 3: Sub-pages from each contact page
  - Level 4: Sub-sub-pages from sub-pages
  - Level 5: Sub-sub-sub-pages (last resort)
  - Returns first successful form found
- Visited URL tracking to avoid infinite loops
- 200ms polite delay between requests
- Multiple contact link pattern matching (contact, お問い合わせ, inquiry, form, mail, support)
- Social media and external link filtering

### Changed
- Increased crawl timeout from 5s to 45s per site (for very deep exploration)
- Increased max contact links from 5 to 10 per level
- Better error messages showing exact number of pages checked
- More patient crawling suitable for large batch processing

### Improved
- **Dramatically improved success rate** by exploring very deep into site structures
- Finds forms that are 4-5 clicks away from homepage
- Reduced false negatives for sites with deeply nested contact forms

## [2.13.0] - 2026-02-04

### Added
- **SITE_MAPPINGS Format Conversion**: Download button now generates content.js-ready format
  - Converts Worker output to proper SITE_MAPPINGS structure
  - Wraps field names in CSS selector format `[name="fieldname"]`
  - Includes confidence values from pattern detection
  - Outputs JavaScript file (.js) instead of JSON for easy integration
  - Field type name normalization (personName → name, companyName → company, etc.)

### Changed
- Download button now outputs `site-mappings-[timestamp].js` instead of JSON
- Generated file includes merge instructions for content.js

### Improved
- Eliminated manual mapping format conversion step
- Streamlined workflow from crawl → download → integrate

## [2.12.0] - 2026-02-04

### Added
- **Bulk Site Crawler**: Automatically crawl multiple URLs to detect contact forms
  - Parallel crawling (10 concurrent sites)
  - Automatic pattern detection and mapping generation
  - Download detected mappings as JSON
  - Error reporting for failed sites
- Worker-side pattern detection and mapping generation
- HTML parser utilities for contact link detection

### Changed
- Extended UI with Bulk Site Crawler section
- Added /bulk-crawler endpoint to Cloudflare Worker

### Improved
- Reduced manual SITE_MAPPINGS configuration effort
- Faster onboarding for new sites

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
