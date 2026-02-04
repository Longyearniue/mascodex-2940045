# ✨ Chrome Extension - Quick Start

## 📦 What Was Built

A complete Chrome Extension (Manifest V3) for auto-filling contact forms with:
- ✅ Robust field detection with scoring heuristics
- ✅ Japanese & English form support
- ✅ Training mode for per-site customization
- ✅ Safe (no CAPTCHA bypass, no auto-submit)
- ✅ Full source code with documentation

## 📁 Files Delivered

```
✅ manifest.json         - Extension configuration (Manifest V3)
✅ popup.html            - User interface
✅ popup.js              - UI logic & messaging
✅ content.js            - Field detection & auto-fill engine
✅ content.css           - Styling
✅ create-icons.html     - Icon generator tool
✅ README.md             - Full documentation
✅ INSTALLATION.md       - Setup instructions
✅ FILE_STRUCTURE.md     - Technical overview
```

**Location:** `/Users/taiichiwada/mascodex-2940045/goenchan/chrome-extension/`

## ⚡ 3-Step Installation

### Step 1️⃣: Generate Icons (30 seconds)

```bash
# Open icon generator in browser
open /Users/taiichiwada/mascodex-2940045/goenchan/chrome-extension/create-icons.html

# Icons will auto-download, then move them:
mv ~/Downloads/icon*.png /Users/taiichiwada/mascodex-2940045/goenchan/chrome-extension/
```

### Step 2️⃣: Open Chrome Extensions

```bash
# Open Chrome extensions page
open -a "Google Chrome" "chrome://extensions/"
```

### Step 3️⃣: Load Extension (in Chrome)

1. ✅ Toggle "Developer mode" ON (top-right)
2. ✅ Click "Load unpacked"
3. ✅ Select folder: `/Users/taiichiwada/mascodex-2940045/goenchan/chrome-extension`
4. ✅ Done!

## 🎯 First Use

### 1. Configure Profile (One-time)

```
Click extension icon → Fill in:
- Company: 株式会社サンプル
- Name: 山田太郎
- Email: yamada@example.com
- Phone: 03-1234-5678
- Message: お問い合わせ内容...

Click "💾 Save Profile"
```

### 2. Test Auto-Fill

```
1. Visit ANY contact form page
2. Click extension icon
3. Click "✨ Auto Fill"
4. Watch fields magically fill! ✨
```

### 3. Use Training Mode (Optional)

```
For forms where auto-detection isn't perfect:
1. Click "🎯 Training" button
2. On the page, click each form field
3. Select what it represents (name/email/etc)
4. Turn off Training Mode
5. Next time: Stored mappings used automatically!
```

## 🎨 Supported Fields

| Field Type | English | Japanese |
|------------|---------|----------|
| Company | company, organization | 会社名, 企業名 |
| Name | name, full name | 氏名, お名前 |
| Name Kana | kana | フリガナ, カナ |
| Email | email, mail | メール, メールアドレス |
| Phone | phone, tel | 電話, 電話番号 |
| Subject | subject, title | 件名, タイトル |
| Message | message, inquiry | メッセージ, お問い合わせ内容 |

## 🔍 How Field Detection Works

**Scoring System (Multi-factor):**
```
1. Autocomplete attribute      → 50 points
2. Label text                  → 30-40 points
3. Name/ID/Class              → 20-25 points
4. Placeholder text           → 15-20 points
5. Nearby text                → 10 points

Minimum confidence: 30% to fill
```

**Example:**
```html
<label for="email">メールアドレス</label>
<input id="email" name="user_email" placeholder="example@mail.com" autocomplete="email">

Score: 50 (autocomplete) + 30 (label) + 20 (name) + 15 (placeholder) = 115 points
→ Detected as "email" with 100% confidence ✅
```

## 🛡️ Safety Features

- ❌ **NEVER bypasses CAPTCHA** - Extension respects all security measures
- ❌ **NEVER auto-submits** - Only fills fields, user must submit
- ✅ **Only fills visible fields** - Ignores hidden inputs
- ✅ **Visual feedback** - Fields flash green when filled
- ✅ **User control** - Every action requires button click

## 📊 Training Mode Explained

**Problem:** Some sites use non-standard field names
**Solution:** Training Mode lets you teach the extension

**How it works:**
```
1. Enable Training Mode
   → Fields highlighted with orange dashed border

2. Click any field
   → Modal appears with field type options

3. Select correct type (e.g., "email")
   → Selector stored for this domain

4. Next visit
   → Stored mapping used (100% confidence)
   → Fallback to auto-detection for unmapped fields
```

**Storage:**
```json
{
  "fieldMappings": {
    "example.com": {
      "email": "#contact_email",
      "name": "input[name='fullname']"
    }
  }
}
```

## 🎓 Example Use Cases

### Japanese Contact Forms
```
Visit: https://example.co.jp/contact
Fields detected:
- 会社名 → Filled with your company
- お名前 → Filled with your name
- メールアドレス → Filled with your email
- お問い合わせ内容 → Filled with message template
```

### English Inquiry Forms
```
Visit: https://example.com/inquiry
Fields detected:
- Company Name → Auto-filled
- Your Name → Auto-filled
- Email Address → Auto-filled
- Message → Auto-filled with template
```

### Complex Custom Forms
```
First visit: Use Training Mode
1. Click company field → Select "company"
2. Click email field → Select "email"
3. Click message textarea → Select "message"

Next visit: All mappings remembered! 🎉
```

## 🐛 Troubleshooting

### "Could not connect to page"
```bash
# Solution: Refresh the page
# Extension requires page reload after installation
```

### Extension icon not showing
```bash
# Solution: Pin the extension
1. Click puzzle icon (🧩) in toolbar
2. Find "Contact Form Auto-Filler"
3. Click pin icon (📌)
```

### Fields not detected
```bash
# Solution: Use Training Mode
1. Click extension icon
2. Enable Training Mode
3. Manually map each field
4. Saved for next time!
```

### Need to see what's happening
```bash
# Open Developer Tools
Right-click page → Inspect → Console tab

# Look for extension logs:
- "Saved mapping: ..."
- "Auto-fill results: ..."
- "Field detection score: ..."
```

## 📱 Where to Test

**Japanese Forms:**
- お問い合わせフォーム (Contact forms)
- 資料請求フォーム (Document request)
- 見積もりフォーム (Quote request)

**English Forms:**
- Contact Us pages
- Support inquiry forms
- Newsletter signups

## 🔄 Update Extension Code

```bash
# 1. Edit any file in the extension folder
cd /Users/taiichiwada/mascodex-2940045/goenchan/chrome-extension
nano content.js  # or use any editor

# 2. Reload extension
open -a "Google Chrome" "chrome://extensions/"
# Click reload icon (⟳) on extension card

# 3. Refresh test pages
# Extension changes now active!
```

## 📚 Documentation Files

```bash
# Quick reference (this file)
cat QUICK_START.md

# Full documentation
cat README.md

# Installation guide
cat INSTALLATION.md

# Technical details
cat FILE_STRUCTURE.md
```

## ⚙️ Advanced: Storage Management

```javascript
// View stored data in Chrome DevTools Console
chrome.storage.sync.get(null, (data) => console.log(data));

// Clear all data
chrome.storage.sync.clear();

// Export profile
chrome.storage.sync.get(['profile'], (data) => {
  console.log(JSON.stringify(data.profile, null, 2));
});
```

## 🎉 Success Checklist

- [ ] Icons generated and moved to folder
- [ ] Extension loaded in Chrome (visible in chrome://extensions/)
- [ ] Extension icon pinned to toolbar
- [ ] Profile saved with your information
- [ ] Tested auto-fill on at least one form
- [ ] Tried training mode on a complex form
- [ ] Verified fields fill correctly

## 🚀 You're Ready!

Your Chrome Extension is installed and ready to use. Every time you encounter a contact form:

1. Click the extension icon
2. Click "Auto Fill"
3. Enjoy saved time! ⏰💨

For detailed information, see `README.md` in the same folder.

## 📞 Quick Reference

| Action | Button |
|--------|--------|
| Fill form automatically | ✨ Auto Fill |
| Teach extension field mapping | 🎯 Training |
| Reset mappings for site | 🗑️ Clear Mappings |
| Save profile changes | 💾 Save Profile |

**Keyboard shortcuts:** None (for safety - all actions require explicit clicks)

**Storage sync:** Profile and mappings sync across your Chrome devices automatically!

---

**Extension Location:**
`/Users/taiichiwada/mascodex-2940045/goenchan/chrome-extension/`

**Status:** ✅ Ready to install
**Version:** 1.0.0
**Manifest:** V3 (Chrome 88+)
