# Bulk Crawler Usage Guide

## Overview

The Bulk Crawler feature automatically crawls multiple company URLs, detects contact forms, identifies patterns, and generates SITE_MAPPINGS for content.js integration.

## Workflow

### 1. Prepare URL List

Collect company URLs you want to crawl. You can process up to 100+ URLs at once.

Example:
```
https://www.example.co.jp/
https://www.company.com/
https://www.business.jp/
...
```

### 2. Run Bulk Crawler

1. Open the extension popup
2. Expand "Bulk Site Crawler" section
3. Paste URLs into the text area (one per line)
4. Click "🚀 Start Crawl"

**What happens:**
- URLs are split into batches of 50
- Each batch is processed in parallel (10 concurrent sites)
- Real-time progress shows per-URL status (⏳ processing, ✓ success, ✗ failed)
- 1 second delay between batches to avoid rate limiting

### 3. Review Results

After crawling completes, you'll see:
- **Total**: Number of URLs processed
- **Success**: URLs where forms were detected and patterns identified
- **Failed**: URLs where no forms were found or errors occurred
- **Mappings**: Number of SITE_MAPPINGS generated
- **Error list**: Details of failed URLs (if any)

### 4. Download Mappings

Click "📥 Download Mappings JSON" to download a JavaScript file:
- Filename: `site-mappings-[timestamp].js`
- Format: content.js-ready SITE_MAPPINGS structure

**Downloaded file contains:**
```javascript
// Auto-generated SITE_MAPPINGS from Bulk Crawler
// Generated at: 2026-02-04T12:00:00.000Z
// Add this to your content.js SITE_MAPPINGS object

const GENERATED_MAPPINGS = {
  "https://www.example.co.jp/": {
    "pattern": "japanese_direct",
    "confidence": 0.85,
    "mapping": {
      "name": {
        "selector": "[name=\"お名前\"]",
        "confidence": 85
      },
      "email": {
        "selector": "[name=\"メールアドレス\"]",
        "confidence": 85
      },
      "phone": {
        "selector": "[name=\"電話番号\"]",
        "confidence": 85
      },
      "message": {
        "selector": "[name=\"お問い合わせ内容\"]",
        "confidence": 85
      }
    }
  },
  // ... more mappings
};

// To use: merge with existing SITE_MAPPINGS
// Object.assign(SITE_MAPPINGS, GENERATED_MAPPINGS);
```

### 5. Integrate into content.js

1. Open the downloaded `site-mappings-[timestamp].js` file
2. Copy the `GENERATED_MAPPINGS` object
3. Open `content.js` in your extension
4. Find the `SITE_MAPPINGS` object
5. Add this line at the end of the SITE_MAPPINGS initialization:
   ```javascript
   // Merge generated mappings from bulk crawler
   Object.assign(SITE_MAPPINGS, GENERATED_MAPPINGS);
   ```
6. Reload the extension

**Alternative:** Copy individual mappings manually if you want to review/modify them first.

## Pattern Detection

The bulk crawler automatically detects 5 common form patterns:

### 1. WordPress Contact Form 7
- Fields: `your-name`, `your-email`, `your-tel`, `your-message`
- Confidence: High (85-95%)

### 2. Japanese Direct Names
- Japanese characters in field names: `お名前`, `メールアドレス`, `電話番号`
- Confidence: High (80-90%)

### 3. Required Marks Pattern
- Fields with (必須) markers in labels
- Confidence: Medium-High (70-80%)

### 4. MailForm CGI
- Fields: `F1`, `F2`, `Email1`, `Email2`
- Confidence: Medium (60-70%)

### 5. Split Fields
- Numbered fields: `name1`, `name2`, `tel1`, `tel2`, `tel3`
- Confidence: Medium (60-75%)

## Field Type Mapping

The converter automatically maps Worker field types to content.js field types:

| Worker Field Type | content.js Field Type |
|-------------------|----------------------|
| `personName`      | `name`              |
| `personNameKana`  | `nameKana`          |
| `companyName`     | `company`           |
| `email`           | `email`             |
| `phone`           | `phone`             |
| `inquiry`         | `message`           |
| `subject`         | `subject`           |
| `zipcode`         | `zipcode`           |
| `address`         | `address`           |
| `department`      | `department`        |

## Troubleshooting

### Common Issues

**1. "Failed to fetch" error**
- Check internet connection
- Verify Worker is deployed: https://goenchan-worker.taiichifox.workers.dev/
- Check browser console for CORS errors

**2. Many URLs failing**
- Some sites block automated access
- Some sites don't have contact forms
- Some sites use non-standard form structures
- Check error list for specific failure reasons

**3. Low confidence mappings**
- Pattern detection couldn't match with high certainty
- May need manual verification before use
- Consider adding to SITE_MAPPINGS manually with adjusted selectors

**4. No forms detected**
- Site might use JavaScript-rendered forms (Worker can't execute JS)
- Contact page might be behind login/authentication
- Site might not have a contact form

### Best Practices

1. **Start small**: Test with 5-10 URLs first to verify it works
2. **Review mappings**: Check downloaded mappings before integrating
3. **Test after integration**: Visit a few sites from the list to verify forms fill correctly
4. **Iterate**: If forms don't fill, use Form Inspector to refine mappings
5. **Keep originals**: Don't delete SITE_MAPPINGS - merge new ones in

## Performance

- **Speed**: ~5 seconds per URL (including fetch, parse, pattern detection)
- **Batch size**: 50 URLs per batch
- **Concurrent**: 10 sites processed in parallel per batch
- **Timeout**: 5 seconds per site (then marked as failed)
- **Rate limiting**: 1 second delay between batches

## Example Use Case

**Scenario**: You have 100 company URLs and want to auto-fill contact forms

1. Paste 100 URLs into Bulk Crawler
2. Click "Start Crawl" → ~2 minutes processing time
3. Results: 75 successful, 25 failed
4. Download mappings → `site-mappings-1738675200000.js`
5. Copy GENERATED_MAPPINGS to content.js
6. Reload extension
7. Visit any of the 75 successful sites → forms auto-fill instantly!

## Version History

- **v2.13.0** (2026-02-04): Added SITE_MAPPINGS format conversion
- **v2.12.0** (2026-02-04): Initial Bulk Crawler release with batch processing
