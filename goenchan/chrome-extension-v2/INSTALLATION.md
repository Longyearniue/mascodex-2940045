# Installation & Training Guide

## 🚀 Quick Installation (Copy-Paste Commands)

### Step 1: Generate Icons

```bash
# Navigate to extension directory
cd /Users/taiichiwada/mascodex-2940045/goenchan/chrome-extension-v2

# Open icon generator (auto-downloads icons)
open create-icons.html

# Move downloaded icons to extension folder
mv ~/Downloads/icon*.png .
```

### Step 2: Load Extension in Chrome

```bash
# Open Chrome extensions page
open -a "Google Chrome" "chrome://extensions/"
```

**In Chrome window:**
1. ✅ Enable "Developer mode" (toggle top-right)
2. ✅ Click "Load unpacked"
3. ✅ Select folder: `/Users/taiichiwada/mascodex-2940045/goenchan/chrome-extension-v2`
4. ✅ Click "Select"

**Done!** 🎉

### Step 3: Pin Extension

1. Click puzzle icon (🧩) in Chrome toolbar
2. Find "Contact Form Auto-Filler Pro"
3. Click pin icon (📌)

## 📋 Training Workflow: 0 to 90% Coverage

### Phase 1: Setup Profile (5 minutes)

```
1. Click extension icon
2. Click "▶ Profile Settings" to expand
3. Fill in your information:
   - Company: 株式会社サンプル
   - Name: 山田太郎
   - Email: yamada@example.com
   - Phone: 03-1234-5678
   - Message: お問い合わせの件でご連絡いたしました。
4. Click "💾 Save Profile"
```

### Phase 2: Test Standard Forms (10 minutes)

**Goal:** Verify auto-detection works on standard forms

```
Test Sites:
- https://www.example.com/contact
- Any WordPress contact form
- Google Forms
- HubSpot forms

Steps:
1. Navigate to form
2. Click extension icon
3. Click "✨ Auto Fill"
4. Check results - should show 🤖 Auto detection
5. If 3+ fields filled → Standard form ✅
```

**Expected:** 50% of forms work perfectly without training

### Phase 3: Train Enterprise Forms (30 minutes)

**Goal:** Map complex forms for perfect auto-fill

#### Example 1: Bridgestone Contact Form

**URL:** `https://tokyo.bridgestone.co.jp/webapp/form/15666_oex_2/index.do`

```
1. Navigate to the form
2. Click extension icon
3. Click "🔍 このフォームを解析"

Inspector shows:
┌─────────────────────────────────────────┐
│ Field: 会社名・団体名                     │
│ Type: text                              │
│ Name: company_name                      │
│ [Dropdown: Select key]                  │
└─────────────────────────────────────────┘

4. For each field:
   - Select appropriate key from dropdown
   - Click [Test] to verify
   - Green flash = success ✅

Mapping:
- 会社名・団体名 → company
- お名前 → name
- メールアドレス → email
- 電話番号 → phone
- お問い合わせ内容 → message

5. Check "☑ Use generalized pattern" if form has multiple similar pages

6. Click "💾 Save Mapping for This Form"

7. Test: Click "✨ Auto Fill"
   - Should show 📌 Stored (100%) for all fields
```

#### Example 2: Multi-Step Form

**URL:** `https://example.com/inquiry/step1.php`

```
Step 1 (Customer Info):
1. Inspect form
2. Map: name, email, phone
3. Save mapping (exact path: /inquiry/step1.php)

Navigate to Step 2 → URL changes to /inquiry/step2.php

Step 2 (Inquiry Details):
1. Inspect form again (new URL)
2. Map: company, subject, message
3. Save mapping (exact path: /inquiry/step2.php)

Result: Both steps have separate mappings!
```

### Phase 4: Build Coverage Database (Ongoing)

**Target:** Train 10-20 commonly used forms

Recommended approach:

```
Week 1: Train top 5 forms you use most
Week 2: Train 5 more forms as you encounter them
Week 3: Train 5 more forms
Week 4: Train 5 more forms

Total: 20 trained forms = 70%+ coverage
+ 20% from auto-detection
= 90% total coverage! 🎉
```

### Coverage Tracking

Keep a list of trained forms:

```
✅ Bridgestone (/webapp/form/*/index.do)
✅ Toyota Inquiry (*.do)
✅ Company A Contact (/contact.php)
✅ Company B Form (/inquiry/*)
✅ NEC Support (/support/form.jsp)
... (15 more)
```

## 🎯 Verification Steps

After installation:

```bash
# 1. Check extension is loaded
# Go to chrome://extensions/
# Should see "Contact Form Auto-Filler Pro v2.0" with green "Enabled"

# 2. Test on simple form
# Try: https://www.example.com/contact
# Click Auto Fill → At least 1 field should fill

# 3. Test inspector
# On any form page
# Click "🔍 このフォームを解析"
# Should see field list

# 4. Test mapping save
# Map 1 field → Save
# Refresh page → Auto Fill
# Should use stored mapping (📌 Stored)
```

## 🔍 Testing Checklist

### ✅ Basic Functions
- [ ] Profile saves correctly
- [ ] Auto Fill works on standard forms
- [ ] Inspector detects fields
- [ ] Dropdown shows all keys
- [ ] Test button fills field

### ✅ Mapping Functions
- [ ] Can map individual fields
- [ ] Can save mapping
- [ ] Saved mapping loads on next visit
- [ ] Generalized pattern works
- [ ] Can clear mappings

### ✅ Advanced Functions
- [ ] Debug JSON copies to clipboard
- [ ] Results show confidence scores
- [ ] Method badges (📌 🤖) display
- [ ] Fingerprint fallback works

## 🐛 Common Issues & Fixes

### Issue: "Could not connect to page"

```bash
# Fix: Refresh the page
# Extension needs page reload after installation
```

### Issue: Inspector shows 0 fields

```bash
# Possible causes:
# 1. Page not fully loaded → Wait and try again
# 2. Form is in iframe → Not supported (security)
# 3. Fields are hidden → Check visibility

# Debug:
# Open DevTools Console
# Run: document.querySelectorAll('input, textarea, select').length
# Should show count > 0
```

### Issue: Mapping not working after save

```bash
# Debug steps:
# 1. Click "📋 Copy Debug JSON"
# 2. Check "mappingUsed" field
# 3. If null → Mapping key doesn't match URL
# 4. Check "errors" array for details

# Fix:
# - Re-inspect form
# - Check URL pattern matches
# - Try exact path (uncheck generalized)
```

### Issue: Test fill doesn't work

```bash
# Possible causes:
# 1. Selector changed → Re-inspect form
# 2. Field is disabled → Can't fill disabled fields
# 3. Wrong value type → Check field type

# Debug:
# Open DevTools Console
# Run: document.querySelector('[name="email"]')
# Should return the element
```

## 📊 Training Progress Tracker

Use this template to track your training:

```
Form Coverage Log
==================

Date: 2024-01-30

Standard Forms (Auto-Detection):
- [ ] WordPress Contact Form 7
- [ ] Google Forms
- [ ] HubSpot Forms
- [ ] Mailchimp Signup
- [ ] Simple HTML Forms

Enterprise Forms (Need Training):
- [ ] Bridgestone (/webapp/form/*/index.do)
- [ ] Toyota Inquiry (*.do)
- [ ] Company A (/contact.php)
- [ ] Company B (/inquiry/*)
- [ ] NEC Support (/support/form.jsp)
- [ ] Hitachi (/form/index.html)
- [ ] SAP Contact (*.sap)
- [ ] Oracle Forms (*.ora)
- [ ] Salesforce Web-to-Lead
- [ ] Microsoft Dynamics (/form/*)

Coverage:
- Standard: 5/5 (100%)
- Trained: 3/10 (30%)
- Total: 8/15 (53%)

Next to train:
1. Company A contact form (high priority)
2. NEC support form (medium priority)
3. Hitachi inquiry (low priority)
```

## 🎓 Advanced Training Techniques

### Technique 1: Batch Training

Train similar forms together:

```
1. Open all similar forms in tabs
2. Train first form completely
3. For subsequent forms:
   - If structure is same → Use generalized pattern
   - If different → Train individually
```

### Technique 2: Fingerprint Reliance

For frequently changing forms:

```
1. Train form with detailed labels
2. Strong fingerprints are created
3. Even if selectors break, fingerprints work
4. Extension auto-heals selectors
```

### Technique 3: Pattern Libraries

Build reusable patterns:

```
Pattern: /webapp/form/*/index.do
Covers:
- /webapp/form/12345/index.do
- /webapp/form/67890/index.do
- /webapp/form/abc/index.do

Result: One training session = Many forms covered!
```

## 📈 Success Metrics

After 1 month of usage, you should have:

- ✅ **Profile:** Fully configured with all details
- ✅ **Standard forms:** 50-70% auto-fill without training
- ✅ **Trained forms:** 10-20 complex forms mapped
- ✅ **Total coverage:** 85-95% of forms you encounter
- ✅ **Time saved:** 5-10 minutes per form × 20 forms/month = 100-200 min/month

## 🔄 Maintenance

### Monthly Review (10 minutes)

```bash
# 1. Check mappings still work
# Visit top 5 forms → Auto Fill → Verify

# 2. Update profile if info changed
# Phone number, company name, etc.

# 3. Clear unused mappings
# Click "🗑️ Clear Mappings" on old domains

# 4. Export backup
# Copy Debug JSON from all important forms
# Save to text file
```

### Troubleshooting Log

Keep track of issues:

```
Date: 2024-01-30
Form: Bridgestone contact
Issue: Email field not filling
Solution: Re-inspected, selector changed, re-saved
Status: ✅ Fixed
```

## 🎯 90% Coverage Roadmap

**Week 1:** Foundation
- ✅ Install extension
- ✅ Configure profile
- ✅ Test on 3 standard forms

**Week 2:** Core Training
- ✅ Train top 5 enterprise forms
- ✅ Test generalized patterns
- ✅ Build pattern library

**Week 3:** Expansion
- ✅ Train 5 more forms as encountered
- ✅ Optimize mappings
- ✅ Document patterns

**Week 4:** Maintenance
- ✅ Review all mappings
- ✅ Fix broken selectors
- ✅ Train final 5 forms

**Result:** 90%+ coverage achieved! 🎉

## 📞 Next Steps

1. **Complete installation** (follow steps above)
2. **Configure profile** (5 minutes)
3. **Test on standard form** (2 minutes)
4. **Train first enterprise form** (5 minutes)
5. **Build coverage** (ongoing)

Ready to save hours of form filling time! 🚀
