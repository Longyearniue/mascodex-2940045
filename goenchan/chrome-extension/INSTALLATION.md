# Quick Installation Guide

## Terminal Copy-Paste Instructions

### Step 1: Generate Icons (Choose One Method)

#### Method A: Using create-icons.html (Recommended)
```bash
# Navigate to extension directory
cd /Users/taiichiwada/mascodex-2940045/goenchan/chrome-extension

# Open icon generator in browser
open create-icons.html

# Icons will auto-download to your Downloads folder
# Move them to the extension directory:
mv ~/Downloads/icon*.png .
```

#### Method B: Create Simple Placeholder Icons (Quick)
```bash
cd /Users/taiichiwada/mascodex-2940045/goenchan/chrome-extension

# Create placeholder icon files (requires ImageMagick)
# If you don't have ImageMagick, use Method A instead
convert -size 16x16 xc:#1a73e8 -gravity center -pointsize 8 -fill white -annotate +0+0 "CF" icon16.png
convert -size 48x48 xc:#1a73e8 -gravity center -pointsize 24 -fill white -annotate +0+0 "CF" icon48.png
convert -size 128x128 xc:#1a73e8 -gravity center -pointsize 64 -fill white -annotate +0+0 "CF" icon128.png
```

#### Method C: Manual Placeholder (No Tools Required)
```bash
cd /Users/taiichiwada/mascodex-2940045/goenchan/chrome-extension

# Create dummy files (Chrome will show default icon)
touch icon16.png icon48.png icon128.png
```

### Step 2: Open Chrome Extensions

```bash
# Open Chrome extensions page
open -a "Google Chrome" "chrome://extensions/"
```

### Step 3: Load Extension in Chrome

**In the opened Chrome window:**

1. ✅ Enable "Developer mode" (toggle in top-right)
2. ✅ Click "Load unpacked"
3. ✅ Select folder: `/Users/taiichiwada/mascodex-2940045/goenchan/chrome-extension`
4. ✅ Click "Select"

**Done!** 🎉

### Step 4: Pin Extension Icon

1. Click puzzle icon (🧩) in Chrome toolbar
2. Find "Contact Form Auto-Filler"
3. Click pin icon (📌)

## Quick Test

1. **Setup Profile:**
   - Click extension icon
   - Fill in your info
   - Click "Save Profile"

2. **Test Auto-Fill:**
   - Visit any contact form (try: https://www.example.com/contact)
   - Click extension icon
   - Click "Auto Fill"

3. **Test Training Mode:**
   - Click "Training" button
   - Click any form field on page
   - Select field type
   - Click "Auto Fill" again to see stored mapping in action

## Verify Installation

Run this in terminal to check all files exist:

```bash
cd /Users/taiichiwada/mascodex-2940045/goenchan/chrome-extension

echo "Checking files..."
ls -la manifest.json popup.html popup.js content.js content.css icon*.png

echo "✅ All files present!"
```

## Troubleshooting Quick Fixes

### "Could not connect to page" error:
```bash
# Simply refresh the page you're testing on
# The extension needs a page refresh after installation
```

### Extension not showing in toolbar:
```bash
# 1. Go to chrome://extensions/
# 2. Verify "Contact Form Auto-Filler" is enabled
# 3. Click puzzle icon and pin the extension
```

### Need to reload after changes:
```bash
# 1. Go to chrome://extensions/
# 2. Click reload icon (⟳) on the extension card
# 3. Refresh any test pages
```

## File Locations

```
Extension Directory:
/Users/taiichiwada/mascodex-2940045/goenchan/chrome-extension/

Required Files:
✅ manifest.json
✅ popup.html
✅ popup.js
✅ content.js
✅ content.css
✅ icon16.png (or placeholder)
✅ icon48.png (or placeholder)
✅ icon128.png (or placeholder)

Optional Files:
📄 README.md (full documentation)
📄 INSTALLATION.md (this file)
📄 create-icons.html (icon generator)
```

## Next Steps

1. **Configure your profile** - Set your default company, name, email, phone, message
2. **Test on real forms** - Try Japanese contact forms
3. **Use training mode** - Map fields on sites with complex forms
4. **Enjoy auto-filling!** - Save time on repetitive form entry

## Support

Full documentation: See `README.md` in the same folder

Quick commands:
```bash
# View README
cd /Users/taiichiwada/mascodex-2940045/goenchan/chrome-extension
cat README.md

# Or open in default editor
open README.md
```
