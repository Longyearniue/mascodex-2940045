# Quick Reference Guide - Chrome Extension v2.0

## ⚡ Installation (30 seconds)

```bash
cd /Users/taiichiwada/mascodex-2940045/goenchan/chrome-extension-v2
open create-icons.html
mv ~/Downloads/icon*.png .
open -a "Google Chrome" "chrome://extensions/"
```

Then in Chrome: Developer mode ON → Load unpacked → Select folder

## 🎯 Core Features

### 1. Auto Fill (For Standard Forms)
```
Click icon → ✨ Auto Fill → Done!
Works on 50% of forms without training.
```

### 2. Form Inspector (For Enterprise Forms)
```
Click icon → 🔍 このフォームを解析 →
Map fields → 💾 Save →
Next time: Perfect auto-fill!
```

### 3. Debug Output
```
Click icon → 📋 Copy Debug JSON →
Paste to Claude or save for troubleshooting
```

## 📋 5-Minute Training Workflow

**Example: Bridgestone Form**

```
URL: https://tokyo.bridgestone.co.jp/webapp/form/15666_oex_2/index.do

Step 1: Open form → Click extension icon
Step 2: Click "🔍 このフォームを解析"
Step 3: Map fields:
   - 会社名 → company
   - お名前 → name
   - メール → email
   - 電話 → phone
   - 内容 → message
Step 4: Click each [Test] button to verify
Step 5: Check "☑ Use generalized pattern" (optional)
Step 6: Click "💾 Save Mapping for This Form"
Step 7: Test: Click "✨ Auto Fill" → All fields fill perfectly!

Done! This form is now trained forever. 🎉
```

## 🔑 Standard Keys

| Key | Japanese | Type |
|-----|----------|------|
| company | 会社名 | text |
| name | 氏名 | text |
| name_kana | フリガナ | text |
| email | メール | email |
| phone | 電話 | tel |
| subject | 件名 | text |
| message | メッセージ | textarea |
| department | 部署 | text |
| position | 役職 | text |
| zipcode | 郵便番号 | text |
| address | 住所 | text |
| consent | 同意 | checkbox |
| category | カテゴリ | select |

## 🎨 UI Elements

### Popup Sections
- **Profile Settings** - Your default information
- **Actions** - Main buttons
- **Form Inspector** - Field mapping interface
- **Auto-Fill Results** - What was filled
- **Debug Output** - Technical details

### Buttons
- `✨ Auto Fill` - Fill form automatically
- `🔍 このフォームを解析` - Inspect and map fields
- `🗑️ Clear Mappings` - Delete saved mappings for this domain
- `📋 Copy Debug JSON` - Copy technical details
- `💾 Save Profile` - Save your default info
- `💾 Save Mapping` - Save field mappings for this form

### Badges
- `📌 Stored (100%)` - From saved mapping
- `🤖 Auto (50-80%)` - From auto-detection
- `*` - Required field

## 🔍 Label Detection Sources

The inspector checks these sources:
1. `<label for="...">`
2. Wrapping `<label>`
3. `aria-label`
4. `aria-labelledby`
5. `placeholder`
6. Table header `<th>`
7. Definition list `<dt>`
8. Previous sibling text
9. Parent container text

## 📊 Mapping Storage

```
Key Format: hostname + pathname
Example: tokyo.bridgestone.co.jp/webapp/form/15666_oex_2/index.do

With generalized pattern:
Example: tokyo.bridgestone.co.jp/webapp/form/*/index.do
         (matches all numeric IDs)
```

## 🎯 Selector Priority

1. **ID** - `#email_address` (most stable)
2. **Form + Name** - `form[action*="..."] [name="email"]`
3. **Data attrs** - `[data-field="email"]`
4. **Nth-of-type** - `form input[type="email"]:nth-of-type(2)`

## 🐛 Quick Troubleshooting

| Issue | Fix |
|-------|-----|
| "Could not connect" | Refresh the page |
| Fields not detected | Wait for page load, try inspector |
| Mapping not working | Check Debug JSON, re-inspect if needed |
| Test fill fails | Selector changed, re-save mapping |

## 📈 Coverage Goals

- **Week 1:** 5 trained forms
- **Week 2:** 10 trained forms
- **Week 3:** 15 trained forms
- **Week 4:** 20 trained forms

**Result:** 90%+ coverage! 🎉

## 🔄 Common Patterns

### Pattern 1: Java Struts Forms
```
URL: /webapp/form/12345/index.do
Generalized: /webapp/form/*/index.do
Coverage: All similar forms
```

### Pattern 2: Multi-Step Forms
```
Step 1: /inquiry/step1.php (map customer info)
Step 2: /inquiry/step2.php (map inquiry details)
Each step stored separately
```

### Pattern 3: Table-Based Layouts
```
Field detection via <th> headers
Automatically detected
No special handling needed
```

## 💡 Pro Tips

1. **Use generalized patterns** for forms with IDs in URLs
2. **Test before saving** to catch selector issues early
3. **Copy debug JSON** when reporting issues
4. **Train as you go** - map forms when you encounter them
5. **Review monthly** - check mappings still work

## 🎓 Example Training Session

**Target:** Train 3 forms in 15 minutes

```
Form 1: Bridgestone (5 min)
- Inspect → Map 5 fields → Save
- Pattern: /webapp/form/*/index.do

Form 2: Company A (4 min)
- Inspect → Map 4 fields → Save
- Pattern: /contact.php

Form 3: Company B (6 min)
- Inspect → Map 6 fields → Save
- Pattern: /inquiry/*

Total: 3 forms trained
Coverage increase: +15-20%
```

## 📱 Keyboard Shortcuts

None - all actions require explicit clicks for safety.

## 🔐 Privacy

- All data stored locally in Chrome sync storage
- No external API calls
- No telemetry
- Syncs across your Chrome devices only

## 📦 File Structure

```
chrome-extension-v2/
├── manifest.json          (Extension config)
├── popup.html            (UI)
├── popup.js              (UI logic)
├── content.js            (Detection engine)
├── content.css           (Styles)
├── create-icons.html     (Icon generator)
├── README.md             (Full docs)
├── INSTALLATION.md       (Setup guide)
└── QUICK_REFERENCE.md    (This file)
```

## 🚀 Getting Started Checklist

- [ ] Install extension (3 steps above)
- [ ] Generate and move icons
- [ ] Configure profile
- [ ] Test on simple form (Auto Fill)
- [ ] Train first enterprise form (Inspector)
- [ ] Verify mapping works (Auto Fill again)
- [ ] Train 4 more forms this week

## 🎯 Success Criteria

After setup:
- ✅ Profile saved with all your info
- ✅ Auto Fill works on at least 1 form
- ✅ Inspector shows field list
- ✅ Can map and save at least 1 form
- ✅ Saved mapping auto-fills perfectly

## 📞 Quick Help

**Where is my data?**
```javascript
// View in Chrome DevTools Console:
chrome.storage.sync.get(null, console.log);
```

**Export mappings:**
```javascript
// Copy this in Console:
chrome.storage.sync.get(['formMappings'], (data) => {
  console.log(JSON.stringify(data.formMappings, null, 2));
});
```

**Clear all data:**
```javascript
// WARNING: Deletes everything!
chrome.storage.sync.clear();
```

## 🔗 Related Files

- **Full Documentation:** `README.md`
- **Installation Guide:** `INSTALLATION.md`
- **This Reference:** `QUICK_REFERENCE.md`

## 📝 Command Cheat Sheet

```bash
# Install
cd /Users/taiichiwada/mascodex-2940045/goenchan/chrome-extension-v2
open create-icons.html
mv ~/Downloads/icon*.png .
open -a "Google Chrome" "chrome://extensions/"

# Reload after changes
# Go to chrome://extensions/ → Click reload icon

# View files
ls -la

# Edit files
nano popup.js  # or use any editor
```

## 🎉 You're Ready!

1. ✅ Extension installed
2. ✅ Icons generated
3. ✅ Profile configured
4. ✅ Understand training workflow
5. ✅ Ready to achieve 90% coverage

**Start training your first form now!** 🚀
