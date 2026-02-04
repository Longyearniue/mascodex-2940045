# Test Instructions for Japanese Contact Forms

## 🎯 Target Forms

### 1. Hokuden Kogyo Contact Form
**URL:** https://www.hokudenkogyo.co.jp/contact.html

**Expected Fields:**
- 会社名 (Company)
- お名前 (Name)
- メールアドレス (Email)
- 電話番号 (Phone)
- お問い合わせ内容 (Message)

**Pre-configured Selectors:**
```javascript
{
  company: '#company',
  name: '#your-name',
  email: '#your-email',
  phone: '#your-tel',
  message: '#your-message'
}
```

### 2. Lomilomi Salon Oluolu Contact Form
**URL:** https://lomilomisalon-oluolu.com/contact/

**Expected Fields:**
- お名前 (Name)
- メールアドレス (Email)
- 電話番号 (Phone)
- お問い合わせ内容 (Message)

**Pre-configured Selectors:**
```javascript
{
  name: 'input[name*="your-name"]',
  email: 'input[name*="your-email"]',
  phone: 'input[name*="tel"]',
  message: 'textarea[name*="your-message"]'
}
```

### 3. LSI Medience Contact Form
**URL:** https://www.medience.co.jp/contact/index.php?Id=007

**Expected Fields:**
- 勤務先名 (Company)
- お名前 (Name)
- フリガナ (Name Kana)
- E-mail (Email)
- TEL (Phone)
- 所属部署名 (Department)
- お問い合わせ事項／ご意見 (Message)

**Pre-configured Selectors:**
```javascript
{
  company: 'input[name="勤務先名"]',
  name: 'input[name="お名前"]',
  name_kana: 'input[name="フリガナ"]',
  email: 'input[name="E-mail"]',
  phone: 'input[name="TEL"]',
  department: 'input[name="所属部署名"]',
  message: 'textarea[name="お問い合わせ事項／ご意見"]'
}
```

## 🧪 Testing Procedure

### Step 1: Setup Extension

1. Navigate to extension directory:
```bash
cd /Users/taiichiwada/mascodex-2940045/goenchan/chrome-extension-v2
```

2. Reload extension in Chrome:
- Go to `chrome://extensions/`
- Find "Contact Form Auto-Filler Pro"
- Click reload icon (⟳)

3. Configure profile:
- Click extension icon
- Expand "Profile Settings"
- Fill in test data:
  - Company: テスト株式会社
  - Name: 山田太郎
  - Name Kana: ヤマダタロウ
  - Email: test@example.com
  - Phone: 090-1234-5678 (or 09012345678)
  - Zipcode: 294-0045 (or 2940045)
  - Department: 営業部
  - Subject: お問い合わせ
  - Message: お問い合わせのテストメッセージです。
- Click "Save Profile"

**Note:** Phone and Zipcode will be automatically split if form has separate fields:
- Zipcode: 294-0045 → 294 + 0045 (2 fields)
- Phone: 090-1234-5678 → 090 + 1234 + 5678 (3 fields)

### Step 2: Test Hokuden Kogyo Form

1. Open form:
```
https://www.hokudenkogyo.co.jp/contact.html
```

2. Open Developer Console (F12) to see debug logs

3. Click extension icon

4. Click "✨ Auto Fill"

5. **Expected Results:**
```
Console logs:
🎯 Using pre-configured mapping for: www.hokudenkogyo.co.jp/contact.html
✅ Filled company using #company
✅ Filled name using #your-name
✅ Filled email using #your-email
✅ Filled phone using #your-tel
✅ Filled message using #your-message
📊 Site mapping filled 5 fields

Extension popup shows:
- company [📌 Stored (100%)]
- name [📌 Stored (100%)]
- email [📌 Stored (100%)]
- phone [📌 Stored (100%)]
- message [📌 Stored (100%)]
```

6. **Verify in form:**
- [ ] 会社名 field shows: テスト株式会社
- [ ] お名前 field shows: 山田太郎
- [ ] メールアドレス field shows: test@example.com
- [ ] 電話番号 field shows: 03-1234-5678
- [ ] お問い合わせ内容 field shows: お問い合わせのテストメッセージです。

7. Click "📋 Copy Debug JSON"

8. **Expected Debug JSON:**
```json
{
  "url": "https://www.hokudenkogyo.co.jp/contact.html",
  "timestamp": 1706578800000,
  "mappingUsed": null,
  "siteMapping": "www.hokudenkogyo.co.jp/contact.html",
  "fieldsProcessed": 5,
  "fieldsFilled": 5,
  "errors": [],
  "detailedResults": [
    {
      "fieldType": "company",
      "selector": "#company",
      "confidence": 100,
      "method": "site-preconfigured",
      "label": "会社名",
      "value": "テスト株式会社",
      "elementFound": true
    },
    ...
  ]
}
```

### Step 3: Test Lomilomi Salon Form

1. Open form:
```
https://lomilomisalon-oluolu.com/contact/
```

2. Open Developer Console (F12)

3. Click extension icon

4. Click "✨ Auto Fill"

5. **Expected Results:**
```
Console logs:
🎯 Using pre-configured mapping for: lomilomisalon-oluolu.com/contact/
✅ Filled name using input[name*="your-name"]
✅ Filled email using input[name*="your-email"]
✅ Filled phone using input[name*="tel"]
✅ Filled message using textarea[name*="your-message"]
📊 Site mapping filled 4 fields

Extension popup shows:
- name [📌 Stored (100%)]
- email [📌 Stored (100%)]
- phone [📌 Stored (100%)]
- message [📌 Stored (100%)]
```

6. **Verify in form:**
- [ ] お名前 field shows: 山田太郎
- [ ] メールアドレス field shows: test@example.com
- [ ] 電話番号 field shows: 03-1234-5678
- [ ] お問い合わせ内容 field shows: お問い合わせのテストメッセージです。

7. Click "📋 Copy Debug JSON"

8. Verify detailedResults includes WordPress-style selectors

### Step 4: Test Medience Form

1. Open form:
```
https://www.medience.co.jp/contact/index.php?Id=007
```

2. Open Developer Console (F12)

3. Click extension icon

4. Click "✨ Auto Fill"

5. **Expected Results:**
```
Console logs:
🎯 Using pre-configured mapping for: www.medience.co.jp/contact/index.php
✅ Filled company using input[name="勤務先名"]
✅ Filled name using input[name="お名前"]
✅ Filled name_kana using input[name="フリガナ"]
✅ Filled email using input[name="E-mail"]
✅ Filled phone using input[name="TEL"]
✅ Filled department using input[name="所属部署名"]
✅ Filled message using textarea[name="お問い合わせ事項／ご意見"]
📊 Site mapping filled 7 fields

Extension popup shows:
- company [📌 Stored (100%)]
- name [📌 Stored (100%)]
- name_kana [📌 Stored (100%)]
- email [📌 Stored (100%)]
- phone [📌 Stored (100%)]
- department [📌 Stored (100%)]
- message [📌 Stored (100%)]
```

6. **Verify in form:**
- [ ] 勤務先名 field shows: テスト株式会社
- [ ] お名前 field shows: 山田太郎
- [ ] フリガナ field shows: ヤマダタロウ
- [ ] E-mail field shows: test@example.com
- [ ] TEL field shows: 03-1234-5678
- [ ] 所属部署名 field shows: 営業部
- [ ] お問い合わせ事項／ご意見 field shows: お問い合わせのテストメッセージです。

7. Click "📋 Copy Debug JSON"

8. Verify detailedResults includes all 7 fields with Japanese name attributes

### Step 5: Test with Form Inspector (Optional)

If pre-configured mapping doesn't work:

1. Click "🔍 このフォームを解析"

2. Review detected fields:
- Check if all fields are detected
- Verify label text matches expectations
- Check field types (text, email, textarea)

3. Manually map any missed fields

4. Save mapping

5. Test Auto Fill again

## 🐛 Troubleshooting

### Issue: No fields filled

**Check:**
1. Console shows "🎯 Using pre-configured mapping"?
   - Yes → Selectors might be wrong
   - No → URL pattern doesn't match

2. Console shows selector errors?
   ```
   ❌ Could not find company with selector: #company
   ```
   - Selector is incorrect or field doesn't exist

**Fix:**
- Use Inspector mode to find correct selectors
- Update SITE_MAPPINGS in content.js

### Issue: Some fields filled, others not

**Check:**
1. Console logs show which fields succeeded/failed

2. Open DevTools Elements tab:
```javascript
// Test selector manually
document.querySelector('#company')
// Should return element or null
```

**Fix:**
- Update incorrect selectors in SITE_MAPPINGS

### Issue: Fields detected but not filled

**Check:**
1. Console shows "Low confidence" warnings?
2. Field might be disabled or readonly

**Fix:**
- Check field attributes
- Ensure field is visible and enabled

## 📊 Success Criteria

### Hokuden Kogyo Form
- ✅ 5/5 fields auto-filled
- ✅ All fields show correct Japanese text
- ✅ Debug JSON shows "site-preconfigured" method
- ✅ No errors in console
- ✅ Confidence: 100% for all fields

### Lomilomi Salon Form
- ✅ 4/4 fields auto-filled (no company field)
- ✅ All fields show correct Japanese text
- ✅ Debug JSON shows "site-preconfigured" method
- ✅ No errors in console
- ✅ Confidence: 100% for all fields

### Medience Form
- ✅ 7/7 fields auto-filled
- ✅ All fields show correct Japanese text (including フリガナ)
- ✅ Debug JSON shows "site-preconfigured" method
- ✅ No errors in console
- ✅ Confidence: 100% for all fields
- ✅ Handles Japanese characters in name attributes

### General
- ✅ Works without training mode
- ✅ Mappings reused on subsequent visits
- ✅ No CAPTCHA bypass
- ✅ No auto-submit
- ✅ User must click Auto Fill button

## 🎯 Debug Output Examples

### Successful Fill
```json
{
  "fieldType": "email",
  "selector": "#your-email",
  "confidence": 100,
  "method": "site-preconfigured",
  "label": "メールアドレス",
  "value": "test@example.com",
  "elementFound": true
}
```

### Failed Fill
```json
{
  "fieldType": "company",
  "selector": "#company",
  "elementFound": false,
  "reason": "Element not found or not visible"
}
```

## 📝 Test Report Template

```
Test Report: Japanese Contact Forms
Date: [DATE]
Extension Version: 2.2.0
Tester: [YOUR NAME]

Form 1: Hokuden Kogyo
URL: https://www.hokudenkogyo.co.jp/contact.html
Status: [PASS/FAIL]
Fields Filled: [X/5]
Issues: [DESCRIBE ANY ISSUES]

Form 2: Lomilomi Salon
URL: https://lomilomisalon-oluolu.com/contact/
Status: [PASS/FAIL]
Fields Filled: [X/4]
Issues: [DESCRIBE ANY ISSUES]

Form 3: Medience
URL: https://www.medience.co.jp/contact/index.php?Id=007
Status: [PASS/FAIL]
Fields Filled: [X/7]
Issues: [DESCRIBE ANY ISSUES]

Console Logs:
[PASTE RELEVANT CONSOLE OUTPUT]

Debug JSON:
[PASTE DEBUG JSON]

Screenshots:
[ATTACH IF AVAILABLE]

Conclusion:
[SUMMARY OF RESULTS]
```

## 🔄 Retesting After Fixes

If selectors need updating:

1. Edit content.js:
```javascript
const SITE_MAPPINGS = {
  'www.hokudenkogyo.co.jp/contact.html': {
    company: { selector: '#NEW_SELECTOR', confidence: 100 },
    // ... update other selectors
  }
};
```

2. Reload extension (chrome://extensions/ → reload)

3. Refresh form page

4. Test again

## 📞 Support

If issues persist:
1. Copy full console log
2. Copy debug JSON
3. Take screenshot of form
4. Note which fields failed
5. Check if selectors exist:
   ```javascript
   document.querySelector('#your-email')
   ```

## ✅ Final Checklist

Before marking as complete:
- [ ] All three forms tested (Hokuden, Lomilomi, Medience)
- [ ] All expected fields filled
- [ ] Debug output shows correct selectors
- [ ] Console logs show success messages
- [ ] No errors in console
- [ ] Debug JSON copied and verified
- [ ] Test report completed
- [ ] Screenshots captured (optional)
