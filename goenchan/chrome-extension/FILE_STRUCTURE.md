# Chrome Extension File Structure

## Complete File List

```
chrome-extension/
│
├── 📄 manifest.json              ✅ Core extension config (Manifest V3)
├── 📄 popup.html                 ✅ Extension popup interface
├── 📄 popup.js                   ✅ Popup logic & UI handlers
├── 📄 content.js                 ✅ Field detection & auto-fill logic
├── 📄 content.css                ✅ Content script styles
│
├── 🖼️  icon16.png                 ⚠️  Need to generate (see below)
├── 🖼️  icon48.png                 ⚠️  Need to generate (see below)
├── 🖼️  icon128.png                ⚠️  Need to generate (see below)
│
├── 📘 README.md                  📖 Full documentation
├── 📗 INSTALLATION.md            📖 Quick setup guide
├── 📙 FILE_STRUCTURE.md          📖 This file
└── 🎨 create-icons.html          🛠️  Icon generator tool
```

## File Descriptions

### Core Extension Files (Required)

#### `manifest.json` (289 lines)
- Extension metadata and permissions
- Defines popup, content scripts, and icons
- Manifest V3 compliant
- Permissions: activeTab, storage, scripting

#### `popup.html` (152 lines)
- Extension popup user interface
- Profile editor form (company, name, email, phone, message)
- Action buttons (Auto Fill, Training, Clear Mappings)
- Results display area
- Responsive design with clean styling

#### `popup.js` (160 lines)
- Profile management (load/save from chrome.storage)
- Communication with content script
- Training mode toggle
- Results visualization
- Status messages

#### `content.js` (520+ lines)
- **Field Detection Engine** - Scoring heuristics for 7 field types
- **Auto-Fill Logic** - Smart form filling with stored mappings fallback
- **Training Mode** - Visual field selection and mapping storage
- **Safety Features** - Never auto-submits, never bypasses CAPTCHA

#### `content.css` (5 lines)
- Minimal styles for training mode modal
- Prevents style conflicts with host pages

### Icon Files (Need to Generate)

#### `icon16.png` (16x16 pixels)
- Toolbar icon (small)

#### `icon48.png` (48x48 pixels)
- Extension management icon

#### `icon128.png` (128x128 pixels)
- Chrome Web Store icon (if publishing)

**How to Generate Icons:**
1. Open `create-icons.html` in browser
2. Icons auto-download
3. Move to extension folder

OR create simple placeholder files:
```bash
touch icon16.png icon48.png icon128.png
```

### Documentation Files (Optional)

#### `README.md`
- Complete documentation
- Features, installation, usage guide
- Troubleshooting section

#### `INSTALLATION.md`
- Quick terminal commands
- Copy-paste instructions
- Minimal setup guide

#### `create-icons.html`
- Auto-generates extension icons
- Creates PNG files with "CF" text
- Blue gradient background

## Key Features Implemented

### 1. Field Detection (content.js)
```javascript
FIELD_PATTERNS = {
  company, name, name_kana, email, phone, subject, message
}
```

**Detection Methods:**
- ✅ Autocomplete attribute (50 pts)
- ✅ Label text matching (30-40 pts)
- ✅ Name/ID/Class attributes (20-25 pts)
- ✅ Placeholder text (15-20 pts)
- ✅ Nearby text content (10 pts)

**Supported Keywords:**
- English: company, name, email, phone, subject, message
- Japanese: 会社, 氏名, メール, 電話, 件名, お問い合わせ内容
- Plus many variations and related terms

### 2. Training Mode (content.js)
```javascript
activateTrainingMode()
→ Visual indicators on fields
→ Click to select field type
→ Store selector per domain
→ Auto-use stored mappings
```

**Storage Structure:**
```json
{
  "fieldMappings": {
    "example.com": {
      "email": "#email-field",
      "name": "input[name='customer_name']"
    }
  }
}
```

### 3. Profile Management (popup.js + chrome.storage)
```javascript
profile = {
  company: "株式会社サンプル",
  name: "山田太郎",
  email: "yamada@example.com",
  phone: "03-1234-5678",
  message: "お問い合わせ内容..."
}
```

### 4. Safety Features
- ❌ No CAPTCHA bypass
- ❌ No auto-submit
- ✅ Only fills visible fields
- ✅ Requires user action (button click)
- ✅ Visual feedback on fill

## Message Flow

```
Popup (popup.js)
    ↓
    | chrome.tabs.sendMessage()
    ↓
Content Script (content.js)
    ↓
    | 1. Load stored mappings
    | 2. Detect form fields
    | 3. Calculate scores
    | 4. Fill fields
    ↓
    | sendResponse()
    ↓
Popup (popup.js)
    ↓
Display Results
```

## Storage Usage

### chrome.storage.sync (Syncs across devices)
- `profile` - User profile data
- `fieldMappings` - Per-domain field selectors

### chrome.storage.local (Device-specific)
- `trainingMode` - Current training mode state

## Browser Compatibility

- ✅ Chrome 88+ (Manifest V3 support)
- ✅ Edge 88+ (Chromium-based)
- ✅ Brave, Opera, Vivaldi (Chromium-based)
- ❌ Firefox (uses different manifest format)
- ❌ Safari (different extension system)

## File Sizes (Approximate)

```
manifest.json       1.2 KB
popup.html          5.8 KB
popup.js            6.2 KB
content.js         18.5 KB
content.css         0.2 KB
README.md          12.4 KB
INSTALLATION.md     5.8 KB
create-icons.html   2.1 KB
─────────────────────────
Total (code only)  52.2 KB
```

## Installation Status

✅ All core files created
⚠️  Icons need generation (use create-icons.html)
📋 Ready to load in Chrome

## Quick Start

```bash
# 1. Navigate to folder
cd /Users/taiichiwada/mascodex-2940045/goenchan/chrome-extension

# 2. Generate icons
open create-icons.html
# (move downloaded icons here)

# 3. Load in Chrome
open -a "Google Chrome" "chrome://extensions/"
# Then: Enable Developer mode → Load unpacked → Select this folder

# 4. Test
# Click extension icon → Fill profile → Visit contact form → Auto Fill
```

## Next Steps After Installation

1. ✅ **Save your profile** in the extension popup
2. ✅ **Visit a contact form** (Japanese or English)
3. ✅ **Click "Auto Fill"** to test detection
4. ✅ **Use Training Mode** if needed for specific sites
5. ✅ **Clear Mappings** to reset and try auto-detection again

## Extension Permissions Explained

- `activeTab` - Access current tab content (for form filling)
- `storage` - Save profile and field mappings
- `scripting` - Inject content script if needed
- `<all_urls>` - Work on any website (content forms are everywhere)

## Privacy & Security

- ✅ All data stored locally
- ✅ No external API calls
- ✅ No telemetry or tracking
- ✅ Open source code (all files visible)
- ✅ No background processes
- ✅ Only active when user clicks extension

## Development Notes

To modify and test:
1. Edit any file
2. Go to `chrome://extensions/`
3. Click reload (⟳) on extension card
4. Refresh test pages

Console logs:
- Popup: Right-click extension icon → Inspect popup
- Content: Page DevTools → Console tab
