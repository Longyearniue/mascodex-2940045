# Contact Form Auto-Filler - Chrome Extension

A Chrome Extension that automatically detects and fills contact/inquiry forms with robust field detection and per-site training mode.

## Features

✅ **One-Click Auto Fill** - Automatically detect and fill form fields
✅ **Robust Detection** - Uses scoring heuristics with autocomplete, labels, names, placeholders
✅ **Japanese Support** - Full support for Japanese contact forms
✅ **Training Mode** - Manually map fields for specific sites
✅ **Safe** - Never bypasses CAPTCHA or auto-submits

## Supported Fields

- Company / 会社名
- Name / 氏名
- Name (Kana) / フリガナ
- Email / メールアドレス
- Phone / 電話番号
- Subject / 件名
- Message / メッセージ

## Installation Instructions

### Step 1: Generate Icons

1. Open `create-icons.html` in your browser
2. Icons will auto-download (icon16.png, icon48.png, icon128.png)
3. Move the downloaded icons to the `chrome-extension` folder

**OR** manually create placeholder icons:
- Create 3 PNG files: icon16.png (16x16), icon48.png (48x48), icon128.png (128x128)
- Any simple colored square will work

### Step 2: Load Extension in Chrome

#### Terminal Commands (macOS/Linux):

```bash
# Navigate to the extension directory
cd /Users/taiichiwada/mascodex-2940045/goenchan/chrome-extension

# Open Chrome Extensions page
open -a "Google Chrome" "chrome://extensions/"
```

#### Manual Steps:

1. **Open Chrome Extensions Page:**
   - Open Chrome browser
   - Go to: `chrome://extensions/`
   - Or: Menu (⋮) → Extensions → Manage Extensions

2. **Enable Developer Mode:**
   - Toggle "Developer mode" switch (top-right corner)

3. **Load Unpacked Extension:**
   - Click "Load unpacked" button
   - Navigate to: `/Users/taiichiwada/mascodex-2940045/goenchan/chrome-extension`
   - Click "Select" or "Open"

4. **Verify Installation:**
   - You should see "Contact Form Auto-Filler" in your extensions list
   - Pin the extension icon to your toolbar (click puzzle icon → pin)

## Usage Guide

### 1. Setup Your Profile

1. Click the extension icon in your toolbar
2. Fill in your profile information:
   - Company / 会社名
   - Name / 氏名
   - Email
   - Phone / 電話番号
   - Message Template
3. Click "💾 Save Profile"

### 2. Auto-Fill Forms

1. Navigate to any contact form page
2. Click the extension icon
3. Click "✨ Auto Fill" button
4. Review the detection results showing:
   - Which fields were filled
   - Confidence score for each field
   - Detection method (stored/auto)

### 3. Training Mode (Optional)

For sites where auto-detection doesn't work perfectly:

1. Click the extension icon
2. Click "🎯 Training" to enable Training Mode
3. On the page, click any form field
4. Select what type of field it is from the popup
5. The mapping is saved for this domain
6. Turn off Training Mode when done

Next time you visit this site, stored mappings will be used automatically!

### 4. Clear Mappings

To reset stored mappings for a site:

1. Visit the site
2. Click extension icon
3. Click "🗑️ Clear Mappings"

## Field Detection Logic

The extension uses a scoring system to detect field types:

1. **Autocomplete Attribute** (50 points) - `autocomplete="email"`
2. **Label Text** (30-40 points) - Associated `<label>` text
3. **Name/ID/Class** (20-25 points) - Element attributes
4. **Placeholder** (15-20 points) - Placeholder text
5. **Nearby Text** (10 points) - Parent or sibling text

**Minimum Confidence:** 30% to fill a field

## Example Japanese Forms Supported

- お問い合わせフォーム (Inquiry forms)
- 資料請求フォーム (Document request forms)
- 見積もりフォーム (Quote request forms)
- 採用応募フォーム (Job application forms)

## Safety Features

- ❌ **Never bypasses CAPTCHA**
- ❌ **Never auto-submits forms**
- ✅ **Only fills detected fields**
- ✅ **Visual feedback when filling**
- ✅ **User control over all actions**

## Troubleshooting

### Extension Icon Not Showing
- Check if extension is enabled in `chrome://extensions/`
- Pin the extension icon (puzzle icon in toolbar)

### "Could not connect to page" Error
- Refresh the page and try again
- Extension requires page reload after installation

### Fields Not Detected
- Use Training Mode to manually map fields
- Check if fields are visible (not hidden by CSS)

### Profile Not Saving
- Check Chrome's storage permissions
- Try clearing browser cache

## Files Structure

```
chrome-extension/
├── manifest.json        # Extension configuration
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic
├── content.js          # Field detection & filling
├── content.css         # Content script styles
├── icon16.png          # 16x16 icon
├── icon48.png          # 48x48 icon
├── icon128.png         # 128x128 icon
├── create-icons.html   # Icon generator
└── README.md           # This file
```

## Development

### Testing Changes

1. Make changes to any file
2. Go to `chrome://extensions/`
3. Click "Reload" icon (⟳) for this extension
4. Refresh any pages you're testing on

### Debugging

- **Popup debugging:** Right-click extension icon → Inspect popup
- **Content script debugging:** Open page Developer Tools (F12) → Console
- **Check logs:** Look for console messages prefixed with extension info

## Privacy

- ✅ All data stored locally in Chrome sync storage
- ✅ No data sent to external servers
- ✅ Works completely offline
- ✅ Per-site mappings sync across your Chrome devices

## Support

For issues or questions:
1. Check the Troubleshooting section
2. Verify all files are present in the extension folder
3. Check Chrome Developer Console for errors

## License

MIT License - Feel free to modify and distribute!
