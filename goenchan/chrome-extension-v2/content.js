// =============================================================================
// IFRAME DETECTION
// =============================================================================

// Detect if this script is running in an iframe
const isInIframe = window.self !== window.top;
const frameContext = isInIframe ? '[IFRAME]' : '[MAIN]';

// Check if this iframe should be skipped (third-party services)
function shouldSkipIframe() {
  if (!isInIframe) return false;

  const url = window.location.href;
  const skipPatterns = [
    'google.com/recaptcha',     // reCAPTCHA
    'google-analytics.com',     // Google Analytics
    'googletagmanager.com',     // Google Tag Manager
    'doubleclick.net',          // Ads
    'googlesyndication.com',    // AdSense
    'facebook.com/plugins',     // Facebook widgets
    'twitter.com/widgets',      // Twitter widgets
    'youtube.com/embed',        // YouTube embeds (unless it's a form)
    'accounts.google.com'       // Google login
  ];

  return skipPatterns.some(pattern => url.includes(pattern));
}

const shouldSkip = shouldSkipIframe();

if (isInIframe) {
  if (shouldSkip) {
    console.log('⏭️ [IFRAME] Skipping third-party iframe:', window.location.href);
  } else {
    console.log('🖼️ [IFRAME] Content script loaded in iframe:', window.location.href);
  }
} else {
  console.log('📄 [MAIN] Content script loaded in main page:', window.location.href);
}

// =============================================================================
// SALES LETTER API
// =============================================================================

// Fetch sales letter via background script (avoids CORS issues)
async function fetchSalesLetter(companyUrl) {
  try {
    console.log('📧 Fetching sales letter via background script for:', companyUrl);

    // Use chrome.runtime.sendMessage to call background script
    // Background script can make cross-origin requests without CORS issues
    const response = await chrome.runtime.sendMessage({
      action: 'fetchSalesLetter',
      companyUrl: companyUrl
    });

    if (response && response.success && response.salesLetter) {
      console.log('✅ Sales letter received from background, length:', response.salesLetter.length);
      return response.salesLetter;
    } else {
      console.log('⚠️ No sales letter returned from background:', response?.error || 'Unknown reason');
      return null;
    }
  } catch (error) {
    console.error('❌ Exception while fetching sales letter via background:', error);
    return null;
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'autoFill') {
    autoFillForm(message.profile).then(result => {
      sendResponse(result);
    });
    return true; // Keep channel open for async
  } else if (message.action === 'batchAutoFill') {
    // Batch mode: auto-fill with provided profile
    console.log('📦 [BATCH] Received batch auto-fill request');

    // Check for error page first
    if (isErrorPage()) {
      console.log('📦 [BATCH] Error page detected, skipping');
      notifyPageShouldClose('エラーページ（Page Not Found）');
      sendResponse({ success: false, error: 'error_page' });
      return true;
    }

    // Check for valid form
    if (!hasValidContactForm()) {
      console.log('📦 [BATCH] No valid contact form, skipping');
      notifyPageShouldClose('お問合せフォームが見つかりません');
      sendResponse({ success: false, error: 'no_form' });
      return true;
    }

    autoFillForm(message.profile).then(result => {
      console.log('📦 [BATCH] Auto-fill complete:', result);
      // Highlight submit button for review
      highlightSubmitButton();
      sendResponse(result);
    });
    return true;
  } else if (message.action === 'inspectForm') {
    const formData = inspectForm();
    sendResponse({ success: true, formData });
  } else if (message.action === 'testFillField') {
    testFillField(message.selector, message.value);
    sendResponse({ success: true });
  }
  return true;
});

// Highlight submit button for batch mode
function highlightSubmitButton() {
  const submitButtons = document.querySelectorAll(
    'button[type="submit"], input[type="submit"], button:not([type]), input[type="button"][value*="送信"], button[class*="submit"]'
  );

  submitButtons.forEach(btn => {
    // Add pulsing highlight effect
    btn.style.boxShadow = '0 0 0 4px rgba(76, 175, 80, 0.5)';
    btn.style.animation = 'batchPulse 1s infinite';
  });

  // Add pulse animation if not exists
  if (!document.getElementById('batchPulseStyle')) {
    const style = document.createElement('style');
    style.id = 'batchPulseStyle';
    style.textContent = `
      @keyframes batchPulse {
        0% { box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.5); }
        50% { box-shadow: 0 0 0 8px rgba(76, 175, 80, 0.3); }
        100% { box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.5); }
      }
    `;
    document.head.appendChild(style);
  }

  // Show notification banner
  const banner = document.createElement('div');
  banner.id = 'batchModeBanner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(90deg, #4caf50, #8bc34a);
    color: white;
    padding: 12px 20px;
    font-size: 14px;
    font-weight: bold;
    text-align: center;
    z-index: 999999;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  banner.innerHTML = '✅ フォーム入力完了 - 内容を確認して送信ボタンをクリックしてください';

  // Remove existing banner if any
  const existingBanner = document.getElementById('batchModeBanner');
  if (existingBanner) existingBanner.remove();

  document.body.appendChild(banner);

  // Auto-hide banner after 10 seconds
  setTimeout(() => {
    banner.style.transition = 'opacity 0.5s';
    banner.style.opacity = '0';
    setTimeout(() => banner.remove(), 500);
  }, 10000);
}

// =============================================================================
// ERROR PAGE & FORM DETECTION
// =============================================================================

// Detect if page is a 404/error page
function isErrorPage() {
  const pageText = document.body?.innerText || '';
  const title = document.title || '';

  const errorPatterns = [
    /page\s*not\s*found/i,
    /404\s*(error|not found)?/i,
    /お探しのページ.*見つかりません/,
    /ページが見つかりません/,
    /指定されたページは存在しません/,
    /このページは存在しません/,
    /アクセスできません/,
    /ページは削除されました/,
    /not\s*found/i,
    /無効なページ/,
    /エラーが発生しました/,
    /申し訳ございません.*ページ.*見つかりません/,
    /お探しのページは見つかりませんでした/,
    /リクエストされたページは見つかりません/,
    /存在しないページ/,
  ];

  // Check title first (faster)
  for (const pattern of errorPatterns) {
    if (pattern.test(title)) {
      console.log('🚫 [ERROR PAGE] Detected via title:', title);
      return true;
    }
  }

  // Check body text (only first 2000 chars to be fast)
  const bodySnippet = pageText.slice(0, 2000);
  for (const pattern of errorPatterns) {
    if (pattern.test(bodySnippet)) {
      console.log('🚫 [ERROR PAGE] Detected via body text');
      return true;
    }
  }

  return false;
}

// Check if page has a valid contact form with fillable fields
function hasValidContactForm() {
  // Get all visible input fields
  const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"])');
  const textareas = document.querySelectorAll('textarea');
  const selects = document.querySelectorAll('select');

  let visibleInputCount = 0;
  let hasTextarea = false;
  let hasTextInput = false;
  let hasEmailOrTel = false;

  for (const input of inputs) {
    if (!isVisible(input)) continue;
    visibleInputCount++;

    const type = (input.type || 'text').toLowerCase();
    if (type === 'text') hasTextInput = true;
    if (type === 'email' || type === 'tel') hasEmailOrTel = true;
  }

  for (const textarea of textareas) {
    if (isVisible(textarea)) {
      hasTextarea = true;
      visibleInputCount++;
    }
  }

  for (const select of selects) {
    if (isVisible(select)) {
      visibleInputCount++;
    }
  }

  console.log(`🔍 [FORM CHECK] Visible fields: ${visibleInputCount}, textarea: ${hasTextarea}, text input: ${hasTextInput}, email/tel: ${hasEmailOrTel}`);

  // A valid contact form should have:
  // - At least 2 visible fillable fields AND
  // - At least one text-like input (textarea, text, email, or tel)
  const hasTextLikeField = hasTextarea || hasTextInput || hasEmailOrTel;
  const isValid = visibleInputCount >= 2 && hasTextLikeField;

  if (!isValid) {
    console.log('🚫 [FORM CHECK] Not a valid contact form');
  }

  return isValid;
}

// Send notification that this page should be closed (BATCH MODE ONLY)
async function notifyPageShouldClose(reason) {
  // Check if batch mode is active before showing close banner
  const storage = await chrome.storage.local.get(['batchMode']);
  if (!storage.batchMode) {
    console.log('⏭️ Skipping page close notification - not in batch mode');
    return;
  }

  const verification = {
    timestamp: Date.now(),
    totalFields: 0,
    filledFields: 0,
    emptyFields: 0,
    requiredEmpty: 0,
    hasMessageField: false,
    messageFieldFilled: false,
    fields: [],
    issues: [{ type: 'page_invalid', message: reason }],
    status: 'page_invalid',
    pageInvalidReason: reason
  };

  // Show banner on page (only in batch mode)
  showInvalidPageBanner(reason);

  // Notify background script
  try {
    chrome.runtime.sendMessage({
      action: 'verificationResult',
      verification: verification,
      url: window.location.href
    });
  } catch (e) {
    console.log('Could not notify background about invalid page:', e);
  }
}

// Show banner for invalid pages
function showInvalidPageBanner(reason) {
  const banner = document.createElement('div');
  banner.id = 'goenchan-invalid-banner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(90deg, #f44336, #e91e63);
    color: white;
    padding: 12px 20px;
    font-size: 14px;
    font-weight: bold;
    text-align: center;
    z-index: 999999;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  banner.innerHTML = `🚫 ${reason} - このタブは自動的に閉じられます`;

  document.body?.appendChild(banner);
}

// =============================================================================
// AUTO-FILL ON PAGE LOAD
// =============================================================================

async function checkAndAutoFill() {
  // Skip third-party iframes
  if (shouldSkip) {
    return;
  }

  try {
    console.log(`🔍 [DEBUG] ${frameContext} checkAndAutoFill started`);

    // Note: Error page detection and form validation are only done in batch mode
    // (handled in batchAutoFill message handler)
    // Normal auto-fill just skips silently if no form is found

    // Load settings and profile from chrome.storage
    const { autoFillEnabled = true, profile } =
      await chrome.storage.sync.get(['autoFillEnabled', 'profile']);

    console.log('🔍 [DEBUG] autoFillEnabled:', autoFillEnabled);
    console.log('🔍 [DEBUG] profile:', profile);

    // Check 1: Is auto-fill enabled?
    if (!autoFillEnabled) {
      console.log('⏸️ Auto-fill is disabled in settings');
      return;
    }

    // Check 2: Is profile configured?
    if (!profile || Object.keys(profile).length === 0) {
      console.log('⚠️ No profile found. Please configure your profile first.');
      console.log('💡 To fix: Open extension popup → Profile Settings → Fill in your info → Save Profile');
      return;
    }

    // Check 3: Detect form pattern (new!)
    console.log(`🔍 [DEBUG] ${frameContext} Detecting form pattern...`);
    const detectedPattern = detectFormPattern();

    if (detectedPattern && detectedPattern.score >= 50) {
      const formFields = document.querySelectorAll('input, textarea, select');
      cachedPatternMapping = generatePatternMapping(detectedPattern.name, formFields);
      cachedPatternInfo = detectedPattern;
      console.log('💾 [CACHE] Pattern mapping cached:', cachedPatternMapping);
    } else {
      console.log('ℹ️ [CACHE] No pattern mapping cached (using auto-detection fallback)');
    }

    // Check 4: Is this a known site? (renumber from Check 3)
    const currentUrl = window.location.href;
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    const urlKey = hostname + pathname;

    console.log('🔍 [DEBUG] Current URL:', currentUrl);
    console.log('🔍 [DEBUG] URL Key for matching:', urlKey);
    console.log('🔍 [DEBUG] Available SITE_MAPPINGS keys:', Object.keys(SITE_MAPPINGS).slice(0, 10).join(', ') + '...');

    let isKnownSite = false;
    let matchedKey = null;
    for (const key of Object.keys(SITE_MAPPINGS)) {
      if (urlKey.includes(key)) {
        isKnownSite = true;
        matchedKey = key;
        break;
      }
    }

    console.log('🔍 [DEBUG] Is known site?', isKnownSite, matchedKey ? `(matched: ${matchedKey})` : '');

    // Execute auto-fill on ALL sites (not just known sites)
    // The 6-layer system (SITE_MAPPINGS → Pattern → Auto-Generated → Auto-Detection → Semantic → Fallback)
    // will handle all forms intelligently
    console.log('🚀 Auto-fill enabled for ALL sites. Starting auto-fill in 2 seconds...');
    setTimeout(async () => {
      console.log('⏰ Auto-fill timer triggered, calling autoFillForm...');
      const result = await autoFillForm(profile);
      console.log('📊 Auto-fill result:', result);
      if (result.success && result.results.length > 0) {
        console.log(`✅ Auto-filled ${result.results.length} field(s) automatically`);
      } else {
        console.log('ℹ️ No fields filled (this may not be a contact form)');
        if (result.debug) {
          console.log('🔍 [DEBUG] Debug info:', result.debug);
        }
      }
    }, 2000); // 2 second delay for DOM readiness and API calls
  } catch (error) {
    console.error('❌ Auto-fill error:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Execute on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAndAutoFill);
} else {
  checkAndAutoFill();
}

// =============================================================================
// FORM INSPECTOR
// =============================================================================

function inspectForm() {
  const url = window.location.href;
  const title = document.title || document.querySelector('h1')?.textContent || '';

  // Find all form fields
  const forms = document.querySelectorAll('form');
  const allFields = [];

  // Get fields from all forms (or body if no forms)
  const containers = forms.length > 0 ? Array.from(forms) : [document.body];

  containers.forEach((container, formIndex) => {
    // Input fields
    const inputs = container.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"])');
    inputs.forEach(input => {
      if (isVisible(input)) {
        allFields.push(analyzeField(input, container, formIndex));
      }
    });

    // Textareas
    const textareas = container.querySelectorAll('textarea');
    textareas.forEach(textarea => {
      if (isVisible(textarea)) {
        allFields.push(analyzeField(textarea, container, formIndex));
      }
    });

    // Select fields
    const selects = container.querySelectorAll('select');
    selects.forEach(select => {
      if (isVisible(select)) {
        allFields.push(analyzeField(select, container, formIndex));
      }
    });
  });

  return {
    url,
    title,
    fields: allFields,
    formCount: forms.length
  };
}

function analyzeField(element, container, formIndex) {
  const tag = element.tagName.toLowerCase();
  const type = element.type || tag;
  const name = element.name || '';
  const id = element.id || '';
  const required = element.required || element.getAttribute('aria-required') === 'true';

  // Get label candidates
  const labelCandidates = [];

  // 1. <label for="...">
  if (id) {
    const label = container.querySelector(`label[for="${id}"]`);
    if (label) labelCandidates.push(cleanText(label.textContent));
  }

  // 2. Wrapping <label>
  const parentLabel = element.closest('label');
  if (parentLabel) {
    labelCandidates.push(cleanText(parentLabel.textContent));
  }

  // 3. aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) labelCandidates.push(cleanText(ariaLabel));

  // 4. aria-labelledby
  const ariaLabelledBy = element.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labelElement = document.getElementById(ariaLabelledBy);
    if (labelElement) labelCandidates.push(cleanText(labelElement.textContent));
  }

  // 5. placeholder
  const placeholder = element.getAttribute('placeholder');
  if (placeholder) labelCandidates.push(cleanText(placeholder));

  // 6. Nearest table header
  const tableHeader = getNearestTableHeader(element);
  if (tableHeader) labelCandidates.push(cleanText(tableHeader));

  // 7. dt/dd pattern
  const dtLabel = getNearestDtLabel(element);
  if (dtLabel) labelCandidates.push(cleanText(dtLabel));

  // 8. Previous sibling text
  const prevText = getPreviousSiblingText(element);
  if (prevText) labelCandidates.push(cleanText(prevText));

  // 9. Parent container text (first 50 chars)
  const parentText = getParentText(element);
  if (parentText) labelCandidates.push(cleanText(parentText).substring(0, 50));

  // Get options for select
  let options = null;
  if (tag === 'select') {
    const optionElements = element.querySelectorAll('option');
    options = Array.from(optionElements).slice(0, 20).map(opt => ({
      value: opt.value,
      text: cleanText(opt.textContent)
    }));
  }

  // Generate stable selector
  const selector = generateSelector(element, container, formIndex);

  // Generate fingerprint
  const fingerprint = generateFingerprint(element, labelCandidates[0] || '');

  return {
    tag,
    type,
    name,
    id,
    required,
    labelCandidates: labelCandidates.filter(Boolean),
    options,
    selector,
    fingerprint
  };
}

// Get nearest table header (th)
function getNearestTableHeader(element) {
  const cell = element.closest('td');
  if (!cell) return null;

  const row = cell.closest('tr');
  if (!row) return null;

  const cellIndex = Array.from(row.cells).indexOf(cell);
  const table = row.closest('table');
  if (!table) return null;

  const headerRow = table.querySelector('tr');
  if (!headerRow) return null;

  const headerCell = headerRow.cells[cellIndex];
  return headerCell ? headerCell.textContent : null;
}

// Get nearest dt label (dt/dd pattern)
function getNearestDtLabel(element) {
  const dd = element.closest('dd');
  if (!dd) return null;

  const dt = dd.previousElementSibling;
  if (dt && dt.tagName === 'DT') {
    return dt.textContent;
  }

  return null;
}

// Get previous sibling text
function getPreviousSiblingText(element) {
  let sibling = element.previousElementSibling;
  while (sibling) {
    if (sibling.textContent.trim()) {
      return sibling.textContent;
    }
    sibling = sibling.previousElementSibling;
  }
  return null;
}

// Get parent container text
function getParentText(element) {
  const parent = element.parentElement;
  if (!parent) return null;

  // Get only direct text nodes of parent, not nested elements
  let text = '';
  parent.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    }
  });

  return text.trim() || parent.textContent;
}

// Clean text
function cleanText(text) {
  if (!text) return '';
  return text.trim().replace(/\s+/g, ' ').replace(/[*:：\n\r]/g, '').trim();
}

// Check if element is visible
function isVisible(element) {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' &&
         style.visibility !== 'hidden' &&
         style.opacity !== '0' &&
         element.offsetWidth > 0 &&
         element.offsetHeight > 0;
}

// Generate stable selector
function generateSelector(element, container, formIndex) {
  // 1. Prefer ID
  if (element.id) {
    return `#${element.id}`;
  }

  // 2. Name within form context
  if (element.name) {
    const form = element.closest('form');
    if (form) {
      // Try to identify form uniquely
      const formSelector = form.id ? `#${form.id}` :
                          form.name ? `form[name="${form.name}"]` :
                          form.action ? `form[action*="${form.action.split('/').pop()}"]` :
                          `form:nth-of-type(${formIndex + 1})`;
      return `${formSelector} [name="${element.name}"]`;
    }
    return `[name="${element.name}"]`;
  }

  // 3. Data attributes
  const dataAttrs = Array.from(element.attributes)
    .filter(attr => attr.name.startsWith('data-'))
    .map(attr => `[${attr.name}="${attr.value}"]`);

  if (dataAttrs.length > 0) {
    return element.tagName.toLowerCase() + dataAttrs[0];
  }

  // 4. nth-of-type within form
  const form = element.closest('form') || container;
  const tag = element.tagName.toLowerCase();
  const type = element.type;

  const sameTypeElements = Array.from(form.querySelectorAll(`${tag}${type ? `[type="${type}"]` : ''}`));
  const index = sameTypeElements.indexOf(element);

  if (index >= 0) {
    const formSelector = form.tagName === 'FORM' ?
      (form.id ? `#${form.id}` : `form:nth-of-type(${formIndex + 1})`) :
      'body';
    return `${formSelector} ${tag}${type ? `[type="${type}"]` : ''}:nth-of-type(${index + 1})`;
  }

  // Fallback: just tag and class
  const className = element.className ? `.${element.className.split(' ')[0]}` : '';
  return tag + className;
}

// Generate field fingerprint
function generateFingerprint(element, labelText) {
  const tag = element.tagName.toLowerCase();
  const type = element.type || '';
  const name = element.name || '';
  const id = element.id || '';
  const labelHash = simpleHash(labelText);

  return `${tag}:${type}:${name}:${id}:${labelHash}`;
}

// Simple hash function
function simpleHash(str) {
  if (!str) return '0';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// =============================================================================
// SEMANTIC FIELD ANALYSIS (Layer 5)
// =============================================================================

/**
 * Analyze field using semantic clues (labels, aria-labels, placeholders, surrounding text)
 * Returns: { type: 'company'|'name'|'email'|etc, confidence: 0-100, source: 'label'|'aria'|'placeholder' }
 */
function analyzeFieldSemantics(field) {
  // Validate field parameter
  if (!field || !field.getAttribute) return null;

  // Confidence score constants
  const CONFIDENCE_LABEL = 40;
  const CONFIDENCE_ARIA = 35;
  const CONFIDENCE_PLACEHOLDER = 25;
  const CONFIDENCE_ARIA_LABELLEDBY = 30;
  const CONFIDENCE_NEARBY = 15;
  const MIN_CONFIDENCE = 10;

  const semanticPatterns = {
    company: {
      ja: ['会社', '企業', '法人', '団体', '貴社', '御社', '勤務先', '組織'],
      en: ['company', 'corporation', 'organization', 'employer', 'firm']
    },
    company_kana: {
      ja: ['会社名フリガナ', '会社名カナ', '企業名フリガナ', '企業名カナ', '法人名フリガナ', '貴社名フリガナ', '会社フリガナ'],
      en: ['company_kana', 'company kana', 'company furigana']
    },
    name: {
      ja: ['名前', '氏名', 'お名前', '担当者', 'ご担当者'],
      en: ['name', 'full name', 'your name', 'contact name']
    },
    name_kana: {
      ja: ['カナ', 'フリガナ', 'ふりがな', 'よみがな', 'ヨミガナ'],
      en: ['kana', 'furigana', 'reading']
    },
    email: {
      ja: ['メール', 'Eメール', 'メールアドレス', 'eメール'],
      en: ['email', 'e-mail', 'mail address']
    },
    phone: {
      ja: ['電話', '電話番号', 'TEL', '連絡先', '携帯', 'お電話'],
      en: ['phone', 'tel', 'telephone', 'mobile', 'contact number']
    },
    // Split phone fields
    phone1: {
      ja: ['市外局番', '電話番号1', 'TEL1'],
      en: ['area_code', 'tel1', 'phone1']
    },
    phone2: {
      ja: ['市内局番', '電話番号2', 'TEL2'],
      en: ['tel2', 'phone2', 'exchange']
    },
    phone3: {
      ja: ['加入者番号', '電話番号3', 'TEL3'],
      en: ['tel3', 'phone3', 'subscriber']
    },
    zipcode: {
      ja: ['郵便', '郵便番号', '〒'],
      en: ['zip', 'postal', 'postcode', 'zip code']
    },
    address: {
      ja: ['住所', 'ご住所', '所在地'],
      en: ['address', 'street', 'location']
    },
    department: {
      ja: ['部署', '所属', '部門'],
      en: ['department', 'division', 'section']
    },
    position: {
      ja: ['役職', '肩書', '職位'],
      en: ['position', 'title', 'job_title']
    },
    subject: {
      ja: ['件名', 'タイトル', '用件', '問い合わせ件名'],
      en: ['subject', 'title', 'topic']
    },
    message: {
      ja: ['内容', 'メッセージ', '本文', 'お問い合わせ内容', '詳細', 'ご質問', 'ご相談', '事業内容'],
      en: ['message', 'content', 'details', 'inquiry', 'comment', 'question']
    },
    // Split name fields
    name_sei: {
      ja: ['姓'],
      en: ['lastname', 'last_name', 'family_name', 'surname']
    },
    name_mei: {
      ja: ['名'],
      en: ['firstname', 'first_name', 'given_name']
    },
    name_sei_kana: {
      ja: ['セイ', 'ふりがな（姓）', 'フリガナ（姓）', '姓（カナ）', '姓カナ'],
      en: ['lastname_kana', 'sei_kana']
    },
    name_mei_kana: {
      ja: ['メイ', 'ふりがな（名）', 'フリガナ（名）', '名（カナ）', '名カナ'],
      en: ['firstname_kana', 'mei_kana']
    }
  };

  const sources = [];

  // 0. FIRST: Check immediate preceding text for split name fields (姓/名/セイ/メイ)
  // This is highest priority because these short labels are often right before the input
  const immediateText = getImmediatePrecedingText(field);
  if (immediateText) {
    const cleanImmediate = immediateText.replace(/[※＊\*\s（）()]/g, '').trim();
    // Check for split name field patterns - exact match OR ends with pattern
    const splitNamePatterns = {
      'name_sei': { exact: ['姓'], endsWith: ['姓', '氏名姓'] },
      'name_mei': { exact: ['名'], endsWith: ['氏名名', '名前名'] },  // Note: standalone 名 at end is tricky
      'name_sei_kana': { exact: ['セイ'], endsWith: ['セイ', 'フリガナセイ', 'ふりがなセイ', '姓カナ', '姓セイ'] },
      'name_mei_kana': { exact: ['メイ'], endsWith: ['メイ', 'フリガナメイ', 'ふりがなメイ', '名カナ', '名メイ'] }
    };
    for (const [fieldType, patterns] of Object.entries(splitNamePatterns)) {
      // Check exact match
      if (patterns.exact.includes(cleanImmediate)) {
        console.log(`  [SEMANTIC] Immediate text exact match: "${cleanImmediate}" = ${fieldType}`);
        return {
          type: fieldType,
          confidence: CONFIDENCE_LABEL + 20, // Highest priority
          source: 'immediate-text'
        };
      }
      // Check if text ends with pattern
      for (const suffix of patterns.endsWith) {
        if (cleanImmediate.endsWith(suffix)) {
          console.log(`  [SEMANTIC] Immediate text ends with: "${cleanImmediate}" ends with "${suffix}" = ${fieldType}`);
          return {
            type: fieldType,
            confidence: CONFIDENCE_LABEL + 18,
            source: 'immediate-text-suffix'
          };
        }
      }
    }
    // Special case: Check if immediate text is just "名" and NOT part of "氏名" or "名前"
    if (cleanImmediate === '名' || (cleanImmediate.endsWith('名') && !cleanImmediate.includes('氏名') && !cleanImmediate.includes('名前') && !cleanImmediate.includes('会社名') && !cleanImmediate.includes('企業名'))) {
      // Check if it's likely the given name field (appears after 姓 field)
      const prevField = field.previousElementSibling || field.parentElement?.previousElementSibling;
      if (prevField || cleanImmediate === '名') {
        console.log(`  [SEMANTIC] Detected 名 field: "${cleanImmediate}" = name_mei`);
        return {
          type: 'name_mei',
          confidence: CONFIDENCE_LABEL + 15,
          source: 'immediate-text-mei'
        };
      }
    }
    // Add to sources for further matching
    sources.push({ text: immediateText, type: 'immediate-text', confidence: CONFIDENCE_LABEL + 5 });
  }

  // 1. Get label text (high priority - includes aria-label and aria-labelledby)
  const label = getFieldLabel(field);
  if (label) {
    sources.push({ text: label, type: 'label', confidence: CONFIDENCE_LABEL });
  }

  // 2. placeholder (medium priority)
  const placeholder = field.getAttribute('placeholder');
  if (placeholder) {
    sources.push({ text: placeholder, type: 'placeholder', confidence: CONFIDENCE_PLACEHOLDER });
  }

  // 3. Nearby text (low priority - limited to 50 chars)
  const nearbyText = getPreviousSiblingText(field);
  if (nearbyText) {
    sources.push({ text: nearbyText.substring(0, 50), type: 'nearby-text', confidence: CONFIDENCE_NEARBY });
  }

  if (sources.length === 0) {
    return null;
  }

  // Match each source against patterns
  let bestMatch = null;
  let bestScore = 0;
  let bestSource = null;

  for (const source of sources) {
    const text = source.text.toLowerCase().trim();
    const textClean = text.replace(/[※＊\*\s]/g, ''); // Remove markers and whitespace

    // PRIORITY: Check for split name fields first (姓/名/セイ/メイ ending patterns)
    const splitNameEndPatterns = {
      'name_sei': ['姓'],
      'name_mei': [],  // 名 is tricky, handled separately
      'name_sei_kana': ['セイ', 'せい'],
      'name_mei_kana': ['メイ', 'めい']
    };
    for (const [fieldType, suffixes] of Object.entries(splitNameEndPatterns)) {
      for (const suffix of suffixes) {
        if (textClean.endsWith(suffix)) {
          const score = source.confidence + 15; // High priority for split fields
          if (score > bestScore) {
            bestScore = score;
            bestMatch = fieldType;
            bestSource = source.type;
            console.log(`  [SEMANTIC] Split name suffix match: "${textClean}" ends with "${suffix}" = ${fieldType}`);
          }
        }
      }
    }
    // Special check for 名 (given name) - must end with 名 but NOT be 氏名/名前/会社名 etc.
    if (textClean.endsWith('名') && !textClean.endsWith('氏名') && !textClean.endsWith('名前') &&
        !textClean.endsWith('会社名') && !textClean.endsWith('企業名') && !textClean.endsWith('法人名') &&
        !textClean.endsWith('担当者名') && !textClean.endsWith('御社名') && !textClean.endsWith('貴社名') &&
        !textClean.endsWith('部署名') && !textClean.endsWith('件名')) {
      const score = source.confidence + 15;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = 'name_mei';
        bestSource = source.type;
        console.log(`  [SEMANTIC] Given name (名) detected: "${textClean}" = name_mei`);
      }
    }

    for (const [fieldType, patterns] of Object.entries(semanticPatterns)) {
      // Skip if we already matched a split name field with higher confidence
      if (bestMatch && bestMatch.startsWith('name_') && bestMatch !== 'name' && bestMatch !== 'name_kana') {
        continue;
      }
      // Check Japanese keywords
      for (const keyword of patterns.ja) {
        const kwLower = keyword.toLowerCase();
        // Exact match for single-character keywords (姓, 名, セイ, メイ)
        if (keyword.length <= 2 && (text === kwLower || textClean === kwLower)) {
          const score = source.confidence + 10; // Bonus for exact match
          if (score > bestScore) {
            bestScore = score;
            bestMatch = fieldType;
            bestSource = source.type;
            console.log(`  [SEMANTIC] Exact match: "${text}" = ${fieldType}`);
          }
        }
        // Contains match for longer keywords
        else if (text.includes(kwLower)) {
          const score = source.confidence;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = fieldType;
            bestSource = source.type;
          }
        }
      }

      // Check English keywords (word boundaries)
      for (const keyword of patterns.en) {
        const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`);
        if (regex.test(text)) {
          const score = source.confidence;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = fieldType;
            bestSource = source.type;
          }
        }
      }
    }

    // Early break if we found highest confidence match
    if (bestScore >= CONFIDENCE_LABEL) break;
  }

  if (!bestMatch || bestScore < MIN_CONFIDENCE) {
    return null;
  }

  return {
    type: bestMatch,
    confidence: bestScore,
    source: bestSource
  };
}

// =============================================================================
// GENERIC FALLBACK (Layer 6)
// =============================================================================

/**
 * Last resort: Fill ALL remaining visible fields with profile data in order
 * Strategy: text/email/tel fields get filled with: company → name → email → phone → address
 */
function genericFallbackFill(profile, filledFields, debugInfo, results) {
  console.log('🎲 [FALLBACK] Starting generic fallback for remaining fields...');

  const unfilledFields = getAllFormFields().filter(field => {
    // Skip already filled
    if (filledFields.has(field)) return false;

    // Only fill text-like inputs, textareas, email, tel
    const type = field.type || field.tagName.toLowerCase();
    const fillableTypes = ['text', 'email', 'tel', 'textarea', 'search', 'url'];

    return fillableTypes.includes(type);
  });

  if (unfilledFields.length === 0) {
    console.log('ℹ️ [FALLBACK] No unfilled fields remaining');
    return 0;
  }

  // Fill order priority: company → name → email → phone → address → department → subject
  const fillOrder = [
    { key: 'company', value: profile.company },
    { key: 'name', value: profile.name },
    { key: 'email', value: profile.email },
    { key: 'phone', value: profile.phone },
    { key: 'address', value: profile.address },
    { key: 'department', value: profile.department },
    { key: 'position', value: profile.position },
    { key: 'subject', value: profile.subject },
    { key: 'message', value: profile.message }
  ].filter(item => item.value); // Only items with values

  if (fillOrder.length === 0) {
    console.log('ℹ️ [FALLBACK] No profile values available to fill with');
    return 0;
  }

  // Label-based field type detection patterns
  const labelPatterns = {
    company_kana: [/会社.*(?:カナ|フリガナ|かな|ふりがな)|貴社.*(?:カナ|フリガナ|かな|ふりがな)|企業.*(?:カナ|フリガナ|かな|ふりがな)|法人.*(?:カナ|フリガナ|かな|ふりがな)|company.*kana/i],
    company: [/会社|貴社|御社|社名|企業名|法人名|organization|company/i],
    name: [/氏名|お名前|ご担当者.*名|名前|担当者名|your.*name|fullname|^名$/i],
    email: [/メール|email|mail|e-mail/i],
    phone: [/電話|tel|phone|携帯|連絡先/i],
    address: [/住所|所在地|address/i],
    department: [/部署|部門|部課|department|division/i],
    position: [/役職|肩書|職位|職種|title|position/i],
    subject: [/件名|題名|タイトル|subject|title/i],
    message: [/内容|本文|メッセージ|お問い?合わせ|ご相談|ご質問|事業内容|message|content|inquiry|details/i],
    zipcode: [/郵便|〒|zip|postal/i],
    prefecture: [/都道府県|prefecture/i],
    url: [/url|ホームページ|サイト|website/i]
  };

  // Determine field type based on label
  function detectFieldTypeByLabel(field) {
    const label = getFieldLabel(field) || '';
    const name = field.name || '';
    const id = field.id || '';
    const placeholder = field.placeholder || '';
    const combined = `${label} ${name} ${id} ${placeholder}`.toLowerCase();

    for (const [type, patterns] of Object.entries(labelPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(combined)) {
          return type;
        }
      }
    }
    return null;
  }

  let fallbackFilledCount = 0;

  for (const field of unfilledFields) {
    const fieldType = field.type || field.tagName.toLowerCase();
    const fieldLabel = getFieldLabel(field);
    let valueToFill = null;
    let fieldKey = null;

    // First, try to detect field type by HTML type
    if (fieldType === 'email' && profile.email) {
      valueToFill = profile.email;
      fieldKey = 'email';
    } else if (fieldType === 'tel' && profile.phone) {
      valueToFill = formatPhoneForField(profile.phone, field);
      fieldKey = 'phone';
    } else if (fieldType === 'url' && profile.url) {
      valueToFill = profile.url;
      fieldKey = 'url';
    } else if (fieldType === 'textarea') {
      // Textareas are almost always message fields
      if (profile.message) {
        valueToFill = profile.message;
        fieldKey = 'message';
      } else {
        console.log(`⏭️ [FALLBACK] Skipping textarea "${fieldLabel}" (no message template)`);
        continue;
      }
    } else {
      // Detect by label
      const detectedType = detectFieldTypeByLabel(field);
      console.log(`🔍 [FALLBACK] Field "${fieldLabel}" detected as: ${detectedType || 'unknown'}`);

      if (detectedType && profile[detectedType]) {
        valueToFill = profile[detectedType];
        fieldKey = detectedType;
      } else if (detectedType === 'message' && profile.message) {
        // Special case: message-like fields (事業内容, 内容, etc.)
        valueToFill = profile.message;
        fieldKey = 'message';
      } else if (detectedType) {
        // Detected type but no matching profile value
        console.log(`⏭️ [FALLBACK] Skipping "${fieldLabel}" - detected as ${detectedType} but no profile value`);
        continue;
      } else {
        // Unknown field type - skip to avoid filling with wrong data
        console.log(`⏭️ [FALLBACK] Skipping unknown field "${fieldLabel}"`);
        continue;
      }
    }

    if (!valueToFill) {
      console.log(`⏭️ [FALLBACK] No value for field "${fieldLabel}"`);
      continue;
    }

    try {
      fillField(field, valueToFill, fieldType);
      filledFields.add(field);
      debugInfo.fieldsFilled++;
      fallbackFilledCount++;

      const resultInfo = {
        fieldType: fieldKey,
        selector: getSelector(field),
        confidence: 15, // Low but better than random
        method: 'generic-fallback-smart',
        label: fieldLabel || `field-${fallbackFilledCount}`
      };

      results.push(resultInfo);
      debugInfo.detailedResults.push({
        ...resultInfo,
        value: String(valueToFill).substring(0, 20) + (valueToFill.length > 20 ? '...' : ''),
        fieldName: field.name,
        fieldId: field.id,
        fieldType: fieldType
      });

      console.log(`✅ [FALLBACK] Filled "${fieldLabel}" with ${fieldKey}: ${String(valueToFill).substring(0, 30)}`);
    } catch (e) {
      console.error(`❌ [FALLBACK] Error filling field:`, e);
    }
  }

  console.log(`📊 [FALLBACK] Filled ${fallbackFilledCount} fields via smart fallback`);
  return fallbackFilledCount;
}

// =============================================================================
// AUTO-FILL
// =============================================================================

// ===== FINGERPRINT ENGINE =====
function inferFieldTypeFromLabel(label) {
  const l = label.toLowerCase().replace(/[（）()【】\s　]/g, '');
  if (/フリガナ|ふりがな|かな|kana/.test(l)) {
    if (/姓|せい|last|surname|family/.test(l)) return 'last_name_kana';
    if (/名|めい|first|given/.test(l)) return 'first_name_kana';
    return 'name_kana';
  }
  if (/会社|企業|法人|company|corporation/.test(l)) return 'company';
  // 姓のみ（単独）: 「姓」「sei」「last」含むがfull/氏名でない
  if (/姓|^sei$|lastname|last_name|surname|family.*name|名字|みょうじ/.test(l) && !/氏名|フリガナ|kana/.test(l)) return 'last_name';
  // 名のみ（単独）: 「名」含むが「お名前」「氏名」「会社名」でない
  if ((/^名$|^mei$|firstname|first_name|given.*name/.test(l) || (l === '名')) && !/氏名|お名前|会社名|企業名|フリガナ|kana/.test(l)) return 'first_name';
  if (/名前|氏名|お名前|姓名|fullname|yourname/.test(l)) return 'name';
  if (/メール|email|mail/.test(l)) return 'email';
  if (/電話|tel|phone|携帯/.test(l)) return 'phone';
  if (/件名|subject|タイトル/.test(l)) return 'subject';
  if (/内容|メッセージ|message|本文|お問|inquiry|ご相談|詳細/.test(l)) return 'message';
  if (/部署|department/.test(l)) return 'department';
  if (/郵便|zip|postal/.test(l)) return 'zipcode';
  if (/住所|address/.test(l)) return 'address';
  return null;
}

function getFieldLabel(el) {
  if (el.id) {
    const lbl = document.querySelector(`label[for="${el.id}"]`);
    if (lbl) return lbl.textContent.replace(/[*＊必須required]/gi, '').trim();
  }
  if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
  if (el.placeholder) return el.placeholder;
  if (el.title) return el.title;
  const parent = el.closest('tr,div,li,p,dd,section');
  if (parent) {
    const lbl = parent.querySelector('label,th,dt');
    if (lbl) return lbl.textContent.replace(/[*＊必須required]/gi, '').trim();
  }
  return '';
}

const FORM_FINGERPRINTS = {
  'wordpress-cf7': {
    detect: () => document.querySelectorAll('[name^="your-"]').length >= 2,
    map: (el) => {
      const name = el.name || '';
      const m = { 'your-name': 'name', 'your-email': 'email', 'your-tel': 'phone', 'your-message': 'message', 'your-company': 'company', 'your-subject': 'subject' };
      return m[name] || null;
    }
  },
  'wordpress-wpforms': {
    detect: () => /wpforms\[fields\]\[\d+\]/.test(Array.from(document.querySelectorAll('[name]')).map(e=>e.name).join(' ')),
    map: (el) => inferFieldTypeFromLabel(getFieldLabel(el))
  },
  'gravity-forms': {
    detect: () => document.querySelectorAll('[name^="input_"]').length >= 3,
    map: (el) => inferFieldTypeFromLabel(getFieldLabel(el))
  },
  'formzu': {
    detect: () => /^tk[a-z]{2}\d{3}$/.test((document.querySelector('[name^="tk"]') || {}).name || ''),
    map: (el) => {
      const n = (el.name || '').substring(0, 4);
      const m = { 'tkna': 'name', 'tkem': 'email', 'tkph': 'phone', 'tktx': 'message', 'tkms': 'message', 'tkco': 'company', 'tksb': 'subject' };
      return m[n] || inferFieldTypeFromLabel(getFieldLabel(el));
    }
  },
  'synergy-form': {
    detect: () => !!document.querySelector('[name*="singleAnswer"]'),
    map: (el) => inferFieldTypeFromLabel(getFieldLabel(el))
  },
  'hubspot': {
    detect: () => !!(document.querySelector('.hs-input') || document.querySelector('.hs-form')),
    map: (el) => {
      const n = el.name || '';
      const m = { 'email': 'email', 'firstname': 'name', 'lastname': 'name', 'phone': 'phone', 'company': 'company', 'message': 'message' };
      return m[n] || inferFieldTypeFromLabel(getFieldLabel(el));
    }
  },
  'shopify-contact': {
    detect: () => !!document.querySelector('[name^="contact["]'),
    map: (el) => {
      const n = el.name || '';
      if (/contact\[name\]/.test(n)) return 'name';
      if (/contact\[email\]/.test(n)) return 'email';
      if (/contact\[body\]/.test(n)) return 'message';
      return inferFieldTypeFromLabel(getFieldLabel(el));
    }
  },
  'mailform-cgi': {
    detect: () => document.querySelectorAll('[name^="F"]').length >= 3,
    map: (el) => {
      const n = el.name || '';
      const t = el.type || '';
      if (t === 'email' || /email/i.test(n)) return 'email';
      return inferFieldTypeFromLabel(getFieldLabel(el));
    }
  },
  'japanese-direct': {
    detect: () => {
      const names = Array.from(document.querySelectorAll('[name]')).map(e => e.name);
      return names.filter(n => /[^\x00-\x7F]/.test(n)).length >= 2;
    },
    map: (el) => {
      const n = (el.name || '').replace(/[（）()【】*＊]/g, '').trim();
      const m = {
        'お名前': 'name', '氏名': 'name', 'お名前（必須）': 'name',
        '会社名': 'company', '企業名': 'company',
        'メールアドレス': 'email', 'メール': 'email',
        '電話番号': 'phone', 'TEL': 'phone', '電話': 'phone',
        'お問い合わせ内容': 'message', '内容': 'message', 'メッセージ': 'message',
        '件名': 'subject', 'お名前（フリガナ）': 'name_kana', 'フリガナ': 'name_kana'
      };
      return m[n] || inferFieldTypeFromLabel(n);
    }
  },
  'tayori': {
    detect: () => !!(document.querySelector('[data-tayori]') || document.querySelector('.tayori-form')),
    map: (el) => inferFieldTypeFromLabel(getFieldLabel(el))
  }
};

function detectFormSystem() {
  for (const [system, fp] of Object.entries(FORM_FINGERPRINTS)) {
    try {
      if (fp.detect()) {
        console.log(`🔍 [Fingerprint] Detected: ${system}`);
        return { system, mapper: fp.map };
      }
    } catch(e) {}
  }
  return null;
}

async function autoFillForm(profile) {
  const url = window.location.href;
  const urlObj = new URL(url);
  const hostname = urlObj.hostname;
  const pathname = urlObj.pathname;

  const results = [];
  const debugInfo = {
    url,
    timestamp: Date.now(),
    mappingUsed: null,
    siteMapping: null,
    fieldsProcessed: 0,
    fieldsFilled: 0,
    errors: [],
    detailedResults: []
  };

  const filledFields = new Set();

  // =============================================================================
  // MESSAGE: 原稿タブのテンプレートをストレージから直接読み込む
  // =============================================================================
  const globalSalesLetter = null; // Worker API完全無効化
  try {
    const tplData = await chrome.storage.sync.get(['tplBody', 'tplSubject', 'tplSelfDesc']);
    if (tplData.tplBody && tplData.tplBody.trim()) {
      // 変数置換
      const today = new Date();
      const dateStr = today.getFullYear() + '年' + (today.getMonth()+1) + '月' + today.getDate() + '日';
      const companyName = profile.companyName || profile.company || '';
      let msg = tplData.tplBody
        .replace(/\{\{会社名\}\}/g, companyName)
        .replace(/\{\{商品名\}\}/g, profile.productName || '')
        .replace(/\{\{都道府県\}\}/g, profile.prefecture || '')
        .replace(/\{\{担当者名\}\}/g, profile.name || '')
        .replace(/\{\{URL\}\}/g, window.location.origin)
        .replace(/\{\{日付\}\}/g, dateStr)
        .replace(/\{\{自社説明\}\}/g, tplData.tplSelfDesc || '');
      profile = { ...profile, message: msg };
      console.log('📝 Template loaded from 原稿 tab, length:', msg.length);
    } else if (profile.message) {
      console.log('📝 Using profile.message, length:', profile.message.length);
    }
  } catch(e) {
    console.log('📝 Template load error:', e.message);
  }

  // Layer 0: Fingerprint engine
  const fpFilledEls = new Set(); // 指紋エンジンが埋めたフィールドを記録
  const fpSystem = detectFormSystem();
  if (fpSystem) {
    const fields = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');
    fields.forEach(el => {
      if (!isVisible(el)) return;
      const fieldType = fpSystem.mapper(el);
      if (!fieldType) return;
      const value = getProfileValue(profile, fieldType);
      if (value) { fillField(el, value, el.type, fieldType); fpFilledEls.add(el); }
    });
  }

  // 指紋エンジンで埋めたフィールドをスキップするヘルパー
  const isAlreadyFilled = el => fpFilledEls.has(el);

  // Layer 0b: 姓/名フィールド専用検出（label/placeholder解析）
  document.querySelectorAll('input[type="text"], input:not([type])').forEach(el => {
    if (!isVisible(el) || isAlreadyFilled(el)) return;
    const label = getFieldLabel ? getFieldLabel(el) : '';
    const cleaned = label.replace(/[（）()\[\]【】*＊\s　必須required]/g, '').trim();
    const attrs = (el.name + ' ' + el.id + ' ' + el.placeholder).toLowerCase();

    let fieldType = null;
    // 姓判定
    if (/^姓$|^せい$/.test(cleaned) || /^last.?name$|^sei$|^family.?name$/.test(attrs)) {
      fieldType = 'last_name';
    }
    // 名判定（「名」単独、かつ「お名前」「氏名」「会社名」でない）
    else if (/^名$|^めい$/.test(cleaned) || /^first.?name$|^mei$|^given.?name$/.test(attrs)) {
      fieldType = 'first_name';
    }
    // 姓カナ
    else if (/^セイ$|^せい$/.test(cleaned) && /kana|furi|カナ|かな/.test(label.toLowerCase())) {
      fieldType = 'last_name_kana';
    }
    // 名カナ
    else if (/^メイ$|^めい$/.test(cleaned) && /kana|furi|カナ|かな/.test(label.toLowerCase())) {
      fieldType = 'first_name_kana';
    }

    if (fieldType) {
      const value = getProfileValue(profile, fieldType);
      if (value) {
        fillField(el, value, el.type, fieldType);
        el.dataset.autofilledSplit = '1'; // 後続レイヤーの上書きを防ぐ
        fpFilledEls.add(el);
      }
    }
  });

  // Check for pre-configured site mappings FIRST
  let siteMapping = null;
  let siteMappingKey = null;

  console.log('🔍 [DEBUG] Checking SITE_MAPPINGS for URL:', url);

  for (const [key, mapping] of Object.entries(SITE_MAPPINGS)) {
    if (url.includes(key)) {
      siteMapping = mapping;
      siteMappingKey = key;
      debugInfo.siteMapping = key;
      console.log('🔍 [DEBUG] Found matching SITE_MAPPING key:', key);
      break;
    }
  }

  // Use pre-configured site mapping if found
  if (siteMapping) {
    console.log('🎯 Using pre-configured mapping for:', siteMappingKey);
    console.log('🔍 [DEBUG] Site mapping fields:', Object.keys(siteMapping));

    // Use already fetched sales letter (fetched at start of autoFillForm)
    let salesLetter = globalSalesLetter;
    if (siteMapping.message && !salesLetter) {
      // Fallback: fetch if not already fetched (e.g., no message field detected earlier)
      const companyUrl = siteMapping.company_url || window.location.origin;
      console.log('🌐 Company URL for API:', companyUrl);
      console.log('⏳ Fetching sales letter from API (fallback)...');
      // salesLetter fetch disabled - use profile.message from 原稿 tab
      if (false && salesLetter) {
        console.log('✅ Sales letter received, length:', salesLetter ? salesLetter.length : 0);
        console.log('📝 First 100 chars:', salesLetter.substring(0, 100));
      } else {
        console.log('❌ Failed to get sales letter from API');
      }
    } else if (salesLetter) {
      console.log('✅ Using pre-fetched sales letter, length:', salesLetter.length);
    }

    for (const [key, fieldConfig] of Object.entries(siteMapping)) {
      // Skip metadata fields (not actual form fields)
      if (key === 'company_url') {
        console.log('⏭️ Skipping metadata field:', key);
        continue;
      }

      // Use sales letter for message field if available
      let value;
      if (key === 'message' && salesLetter) {
        value = salesLetter;
        console.log('📧 Using sales letter for message field');
      } else if (typeof fieldConfig === 'object' && fieldConfig.value) {
        // Use predefined value from config (for select boxes)
        value = fieldConfig.value;
      } else {
        value = getProfileValue(profile, key);
      }

      if (!value) {
        console.log('⚠️ No value for field:', key);
        continue;
      }

      console.log(`🔄 Processing field: ${key}, value: ${typeof value === 'string' ? value.substring(0, 20) : value}`);

      debugInfo.fieldsProcessed++;

      try {
        const element = document.querySelector(fieldConfig.selector);
        if (element && isVisible(element)) {
          // Use fieldConfig.type if specified, otherwise use element.type
          const fieldType = fieldConfig.type || element.type;
          fillField(element, value, fieldType);
          filledFields.add(element);
          debugInfo.fieldsFilled++;

          const resultInfo = {
            fieldType: key,
            selector: fieldConfig.selector,
            confidence: fieldConfig.confidence,
            method: key === 'message' && salesLetter ? 'sales-letter-api' : 'site-preconfigured',
            label: getFieldLabel(element) || key
          };

          results.push(resultInfo);
          debugInfo.detailedResults.push({
            ...resultInfo,
            value: value.substring(0, 20) + (value.length > 20 ? '...' : ''),
            elementFound: true
          });

          console.log(`✅ Filled ${key} using ${fieldConfig.selector}`);
        } else {
          debugInfo.errors.push(`Pre-configured selector not found for ${key}: ${fieldConfig.selector}`);
          debugInfo.detailedResults.push({
            fieldType: key,
            selector: fieldConfig.selector,
            elementFound: false,
            reason: 'Element not found or not visible'
          });
          console.log(`❌ Could not find ${key} with selector: ${fieldConfig.selector}`);
        }
      } catch (e) {
        debugInfo.errors.push(`Pre-configured selector failed for ${key}: ${e.message}`);
        console.error(`Error filling ${key}:`, e);
      }
    }

    // Don't return early - continue to auto-detection for unmapped fields
    console.log(`📊 Site mapping filled ${results.length} fields, continuing to auto-detection...`);
  }

  // Load stored user mappings
  const data = await chrome.storage.sync.get(['formMappings']);
  const allMappings = data.formMappings || {};

  // Find best matching mapping
  let bestMapping = null;
  let bestMappingKey = null;

  // Try exact match first
  const exactKey = `${hostname}${pathname}`;
  if (allMappings[exactKey]) {
    bestMapping = allMappings[exactKey];
    bestMappingKey = exactKey;
  } else {
    // Try pattern matches
    Object.entries(allMappings).forEach(([key, mapping]) => {
      if (key.startsWith(hostname)) {
        const pattern = mapping.metadata.urlPattern;
        if (matchesPattern(pathname, pattern)) {
          bestMapping = mapping;
          bestMappingKey = key;
        }
      }
    });
  }

  debugInfo.mappingUsed = bestMappingKey;

  // Priority-based mapping merge (Task 14)
  // Priority 1: SITE_MAPPINGS (already processed above)
  // Priority 2: Learned mappings (from chrome.storage)
  // Priority 3: Pattern mapping (from cached detection)

  const patternMapping = cachedPatternMapping || {};
  const learnedMapping = bestMapping ? bestMapping.fields : {};

  // Merge with priority (later overrides earlier)
  const mergedMapping = {
    ...patternMapping,      // Base: pattern-detected fields
    ...learnedMapping       // Override: user-learned fields
  };

  console.log('🔀 [MERGE] Final mapping:');
  console.log('  - SITE_MAPPINGS fields:', siteMapping ? Object.keys(siteMapping).length : 0);
  console.log('  - Pattern fields:', Object.keys(patternMapping).length);
  console.log('  - Learned fields:', Object.keys(learnedMapping).length);
  console.log('  - Total merged fields:', Object.keys(mergedMapping).length);

  // Use merged mapping if available
  if (Object.keys(mergedMapping).length > 0) {
    for (const [key, fieldInfo] of Object.entries(mergedMapping)) {
      const value = getProfileValue(profile, key);
      if (!value) continue;

      debugInfo.fieldsProcessed++;

      // Try selector first
      let element = null;
      try {
        element = document.querySelector(fieldInfo.selector);
      } catch (e) {
        debugInfo.errors.push(`Selector failed for ${key}: ${fieldInfo.selector}`);
      }

      // Fallback: try to find by fingerprint (only if fieldInfo has fingerprint)
      if (!element && fieldInfo.fingerprint) {
        element = findElementByFingerprint(fieldInfo.fingerprint, fieldInfo.type);
        if (element) {
          debugInfo.errors.push(`Found ${key} by fingerprint fallback`);
          // Update selector for future use (only if this came from learned mapping)
          if (bestMapping && bestMapping.fields[key]) {
            const newSelector = generateSelector(element, document.body, 0);
            bestMapping.fields[key].selector = newSelector;
            await chrome.storage.sync.set({ formMappings: allMappings });
          }
        }
      }

      if (element && isVisible(element) && !filledFields.has(element)) {
        fillField(element, value, fieldInfo.type);
        filledFields.add(element);
        debugInfo.fieldsFilled++;

        // Determine method based on source
        let method = 'auto';
        if (learnedMapping[key]) {
          method = 'stored';
        } else if (patternMapping[key]) {
          method = 'pattern';
        }

        results.push({
          fieldType: key,
          selector: fieldInfo.selector,
          confidence: fieldInfo.confidence || 100,
          method: method,
          label: fieldInfo.labelText || fieldInfo.label || key
        });
      } else if (!element) {
        debugInfo.errors.push(`Could not find element for ${key}`);
      }
    }
  }

  // Fallback to auto-detection for unmapped fields
  const allFields = getAllFormFields();
  console.log(`🔍 Auto-detecting ${allFields.length} form fields...`);

  for (const field of allFields) {
    if (filledFields.has(field)) continue;

    debugInfo.fieldsProcessed++;

    const detection = detectFieldType(field);
    if (detection && detection.confidence >= 20) {  // Lowered from 30 to 20 for more aggressive auto-fill
      const value = getProfileValue(profile, detection.type);
      if (value) {
        fillField(field, value, field.type);
        filledFields.add(field);
        debugInfo.fieldsFilled++;

        const resultInfo = {
          fieldType: detection.type,
          selector: getSelector(field),
          confidence: detection.confidence,
          method: 'auto',
          label: detection.label
        };

        results.push(resultInfo);
        debugInfo.detailedResults.push({
          ...resultInfo,
          value: value.substring(0, 20) + (value.length > 20 ? '...' : ''),
          fieldName: field.name,
          fieldId: field.id,
          fieldType: field.type
        });

        console.log(`✅ Auto-detected ${detection.type} (${detection.confidence}%) - ${detection.label}`);
      }
    } else if (detection) {
      console.log(`⚠️ Low confidence (${detection.confidence}%) for ${detection.type} - skipped`);
    }
  }

  // =============================================================================
  // LAYER 5: SEMANTIC ANALYSIS (NEW)
  // =============================================================================

  console.log('🔬 [SEMANTIC] Starting semantic analysis for unfilled fields...');

  const unfilledFields = getAllFormFields().filter(field => !filledFields.has(field));
  let semanticFilledCount = 0;

  console.log(`  [SEMANTIC] Analyzing ${unfilledFields.length} unfilled fields`);

  for (const field of unfilledFields) {
    const fieldType = field.type || field.tagName.toLowerCase();
    const fieldLabel = getFieldLabel(field);

    console.log(`  [SEMANTIC] Field: ${fieldType}, label: "${fieldLabel || '(no label)'}"`);

    const semantic = analyzeFieldSemantics(field);

    if (semantic) {
      console.log(`    → Matched: ${semantic.type} (${semantic.confidence}% via ${semantic.source})`);

      const value = getProfileValue(profile, semantic.type);

      if (value) {
        fillField(field, value, field.type);
        filledFields.add(field);
        debugInfo.fieldsFilled++;
        semanticFilledCount++;

        const resultInfo = {
          fieldType: semantic.type,
          selector: getSelector(field),
          confidence: semantic.confidence,
          method: 'semantic-' + semantic.source,
          label: getFieldLabel(field) || semantic.source
        };

        results.push(resultInfo);
        debugInfo.detailedResults.push({
          ...resultInfo,
          value: value.substring(0, 20) + (value.length > 20 ? '...' : ''),
          fieldName: field.name,
          fieldId: field.id
        });

        console.log(`✅ [SEMANTIC] Filled ${semantic.type} (${semantic.confidence}% via ${semantic.source})`);
      } else {
        console.log(`    → No profile value for: ${semantic.type}`);
      }
    } else {
      console.log(`    → No semantic match`);
    }
  }

  console.log(`📊 [SEMANTIC] Filled ${semanticFilledCount} fields via semantic analysis`);

  // =============================================================================
  // LAYER 6: GENERIC FALLBACK (NEW)
  // =============================================================================

  const fallbackCount = genericFallbackFill(profile, filledFields, debugInfo, results);

  if (fallbackCount > 0) {
    console.log(`✨ [FALLBACK] ${fallbackCount} additional fields filled as last resort`);
  }

  console.log(`📊 Total filled: ${debugInfo.fieldsFilled}/${debugInfo.fieldsProcessed} fields`);
  console.log(`📊 [SUMMARY] Layers used:`);
  console.log(`  - SITE_MAPPINGS: ${siteMapping ? Object.keys(siteMapping).length : 0} fields`);
  console.log(`  - Pattern/Learned: ${Object.keys(mergedMapping).length} fields`);
  console.log(`  - Auto-detection: ${results.filter(r => r.method === 'auto').length} fields`);
  console.log(`  - Semantic analysis: ${results.filter(r => r.method.startsWith('semantic-')).length} fields`);
  console.log(`  - Generic fallback: ${results.filter(r => r.method === 'generic-fallback').length} fields`);
  console.log(`  - TOTAL FILLED: ${debugInfo.fieldsFilled}/${debugInfo.fieldsProcessed} fields`);

  // B: 確認用メールアドレス自動入力
  if (profile.email) {
    document.querySelectorAll('input[type="text"], input[type="email"], input').forEach(el => {
      if (!isVisible(el)) return;
      const attrs = [el.name, el.id, el.placeholder, el.getAttribute('aria-label')].join(' ').toLowerCase();
      if (/confirm|確認|再入力|check|verify|再度|もう一度/.test(attrs) && /mail|email/.test(attrs)) {
        if (!el.value) {
          setNativeValue(el, profile.email);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
  }

  // C: 必須チェックボックス・同意チェックボックス自動ON
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    if (cb.checked) return;

    const attrs = [cb.name, cb.id, cb.className, cb.getAttribute('aria-label') || ''].join(' ');
    let labelText = '';
    // label[for]
    if (cb.id) {
      const lbl = document.querySelector(`label[for="${cb.id}"]`);
      if (lbl) labelText = lbl.textContent;
    }
    // 親要素内のlabel
    if (!labelText) {
      const parent = cb.closest('label,div,li,p,tr,td');
      if (parent) labelText = parent.textContent;
    }
    const combined = (attrs + ' ' + labelText).toLowerCase();

    // チェックすべきキーワード
    const shouldCheck =
      // プライバシー・個人情報系
      /privacy|個人情報|プライバシー|個情|プライバシーポリシー/.test(combined) ||
      // 同意・承認系
      /同意|承認|agree|consent|acceptance|承諾|了承|確認しました|確認した|読みました/.test(combined) ||
      // メルマガ・ニュースレター系（希望する系）
      /メルマガ|メールマガジン|newsletter|mail.*magazine|magazine.*mail|ニュースレター|新着情報|お知らせ.*希望|希望.*お知らせ|配信.*希望|希望.*配信/.test(combined) ||
      // required属性がある
      cb.required ||
      // aria-required
      cb.getAttribute('aria-required') === 'true';

    // チェックしてはいけないキーワード（除外）
    const shouldNotCheck =
      /不要|希望しない|不希望|いいえ|no.*thanks|unsubscribe|opt.*out|配信不要|受け取らない/.test(combined);

    if (shouldCheck && !shouldNotCheck) {
      cb.checked = true;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('✅ [Checkbox] Auto-checked:', labelText.trim().substring(0, 30) || attrs.substring(0, 30));
    }
  });

  // D: AI fallback - 未入力の必須/可視フィールドをAIで補完
  await aiFillUnknownFields(profile);

  // Run verification after auto-fill
  const verification = verifyFormFill();
  debugInfo.verification = verification;

  // Show verification status on page
  showVerificationStatus(verification);

  // Automatically notify background script about verification result
  // This enables batch mode auto-close functionality
  notifyVerificationResult(verification);

  return {
    success: true,
    results,
    debug: debugInfo,
    verification
  };
}

// =============================================================================
// FORM VERIFICATION
// =============================================================================

/**
 * Verify that form fields are correctly filled
 * Returns detailed report of filled/unfilled fields
 */
function verifyFormFill() {
  const allFields = getAllFormFields();
  const verification = {
    timestamp: Date.now(),
    totalFields: 0,
    filledFields: 0,
    emptyFields: 0,
    requiredEmpty: 0,
    hasMessageField: false,    // NEW: フォームにメッセージ欄が存在するか
    messageFieldFilled: false,
    fields: [],
    issues: [],
    status: 'unknown' // 'success', 'warning', 'error'
  };

  for (const field of allFields) {
    if (!isVisible(field)) continue;

    const fieldInfo = {
      type: field.type || field.tagName.toLowerCase(),
      name: field.name || '',
      id: field.id || '',
      label: getFieldLabel(field) || '',
      required: field.required || field.getAttribute('aria-required') === 'true',
      value: field.value || '',
      filled: false,
      isMessageField: false
    };

    // Check if it's a message field
    const isMessageField =
      field.tagName.toLowerCase() === 'textarea' ||
      /message|content|inquiry|内容|本文|お問い合わせ/i.test(field.name) ||
      /message|content|inquiry|内容|本文|お問い合わせ/i.test(fieldInfo.label);

    fieldInfo.isMessageField = isMessageField;

    // Track if the form has any message field
    if (isMessageField) {
      verification.hasMessageField = true;
    }

    // Check if filled
    if (field.type === 'checkbox' || field.type === 'radio') {
      fieldInfo.filled = field.checked;
    } else if (field.tagName.toLowerCase() === 'select') {
      fieldInfo.filled = field.selectedIndex > 0 || (field.value && field.value !== '');
    } else {
      fieldInfo.filled = field.value && field.value.trim().length > 0;
    }

    verification.totalFields++;

    if (fieldInfo.filled) {
      verification.filledFields++;
      if (isMessageField) {
        verification.messageFieldFilled = true;
      }
    } else {
      verification.emptyFields++;
      if (fieldInfo.required) {
        verification.requiredEmpty++;
        verification.issues.push({
          type: 'required_empty',
          field: fieldInfo.name || fieldInfo.id || fieldInfo.label,
          message: `必須フィールド「${fieldInfo.label || fieldInfo.name}」が空です`
        });
      }
      if (isMessageField) {
        verification.issues.push({
          type: 'message_empty',
          field: fieldInfo.name || fieldInfo.id,
          message: 'メッセージ本文が空です'
        });
      }
    }

    verification.fields.push(fieldInfo);
  }

  // Determine overall status
  // メッセージ欄がない場合は、メッセージ欄の入力を必須としない
  const messageOk = !verification.hasMessageField || verification.messageFieldFilled;

  if (verification.requiredEmpty > 0) {
    verification.status = 'error';
  } else if (verification.emptyFields > 0 || !messageOk) {
    verification.status = 'warning';
  } else if (verification.filledFields > 0) {
    verification.status = 'success';
  }

  console.log('🔍 [VERIFY] Form verification result:', verification);

  return verification;
}

/**
 * Show verification status as a floating banner on the page
 */
function showVerificationStatus(verification) {
  // Remove existing banner if any
  const existingBanner = document.getElementById('goenchan-verification-banner');
  if (existingBanner) {
    existingBanner.remove();
  }

  const banner = document.createElement('div');
  banner.id = 'goenchan-verification-banner';

  let bgColor, icon, message;

  if (verification.status === 'success') {
    bgColor = '#4caf50';
    icon = '✅';
    message = `記入完了: ${verification.filledFields}/${verification.totalFields}フィールド`;
  } else if (verification.status === 'warning') {
    bgColor = '#ff9800';
    icon = '⚠️';
    const issues = [];
    // メッセージ欄がある場合のみ「本文が空」を表示
    if (verification.hasMessageField && !verification.messageFieldFilled) issues.push('本文が空');
    if (verification.emptyFields > 0) issues.push(`${verification.emptyFields}フィールド未記入`);
    message = issues.join(', ');
  } else if (verification.status === 'error') {
    bgColor = '#f44336';
    icon = '❌';
    message = `必須フィールド${verification.requiredEmpty}件が未記入`;
  } else {
    bgColor = '#9e9e9e';
    icon = 'ℹ️';
    message = 'フォームが見つかりません';
  }

  banner.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 18px;">${icon}</span>
      <span>${message}</span>
      <button id="goenchan-verify-details" style="
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.4);
        border-radius: 4px;
        color: white;
        padding: 2px 8px;
        cursor: pointer;
        font-size: 11px;
      ">詳細</button>
      <button id="goenchan-verify-close" style="
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 16px;
        padding: 0 4px;
      ">×</button>
    </div>
  `;

  banner.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: ${bgColor};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 14px;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: goenchan-slide-in 0.3s ease-out;
  `;

  // Add animation keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes goenchan-slide-in {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(banner);

  // Close button handler
  document.getElementById('goenchan-verify-close').addEventListener('click', () => {
    banner.remove();
  });

  // Details button handler
  document.getElementById('goenchan-verify-details').addEventListener('click', () => {
    showVerificationDetails(verification);
  });

  // Auto-hide after 10 seconds if success
  if (verification.status === 'success') {
    setTimeout(() => {
      if (banner.parentNode) {
        banner.style.animation = 'goenchan-slide-in 0.3s ease-out reverse';
        setTimeout(() => banner.remove(), 300);
      }
    }, 10000);
  }
}

/**
 * Show detailed verification modal
 */
function showVerificationDetails(verification) {
  // Remove existing modal
  const existingModal = document.getElementById('goenchan-verify-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'goenchan-verify-modal';

  const fieldsHtml = verification.fields.map(f => {
    const statusIcon = f.filled ? '✅' : (f.required ? '❌' : '⚪');
    const valuePreview = f.filled ? (f.value.substring(0, 30) + (f.value.length > 30 ? '...' : '')) : '(空)';
    const highlight = f.isMessageField ? 'background: #fff3e0;' : '';
    return `
      <tr style="${highlight}">
        <td style="padding: 4px 8px;">${statusIcon}</td>
        <td style="padding: 4px 8px;">${f.label || f.name || f.id || '(名前なし)'}</td>
        <td style="padding: 4px 8px; color: #666; font-size: 11px;">${f.type}</td>
        <td style="padding: 4px 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${valuePreview}</td>
      </tr>
    `;
  }).join('');

  modal.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 999998;
    " id="goenchan-modal-backdrop"></div>
    <div style="
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border-radius: 12px;
      padding: 20px;
      max-width: 600px;
      max-height: 80vh;
      overflow: auto;
      z-index: 999999;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0; font-size: 16px;">📋 フォーム記入検証結果</h3>
        <button id="goenchan-modal-close" style="
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          padding: 0;
        ">×</button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px;">
        <div style="background: #e8f5e9; padding: 10px; border-radius: 6px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #2e7d32;">${verification.filledFields}</div>
          <div style="font-size: 11px; color: #666;">記入済み</div>
        </div>
        <div style="background: #fff3e0; padding: 10px; border-radius: 6px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #ef6c00;">${verification.emptyFields}</div>
          <div style="font-size: 11px; color: #666;">未記入</div>
        </div>
        <div style="background: ${verification.requiredEmpty > 0 ? '#ffebee' : '#f5f5f5'}; padding: 10px; border-radius: 6px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: ${verification.requiredEmpty > 0 ? '#c62828' : '#666'};">${verification.requiredEmpty}</div>
          <div style="font-size: 11px; color: #666;">必須未記入</div>
        </div>
      </div>

      ${verification.issues.length > 0 ? `
        <div style="background: #ffebee; padding: 10px; border-radius: 6px; margin-bottom: 16px;">
          <div style="font-weight: bold; color: #c62828; margin-bottom: 6px;">⚠️ 問題</div>
          ${verification.issues.map(i => `<div style="font-size: 12px; color: #c62828;">・${i.message}</div>`).join('')}
        </div>
      ` : ''}

      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background: #f5f5f5;">
            <th style="padding: 6px 8px; text-align: left;">状態</th>
            <th style="padding: 6px 8px; text-align: left;">フィールド名</th>
            <th style="padding: 6px 8px; text-align: left;">種類</th>
            <th style="padding: 6px 8px; text-align: left;">値</th>
          </tr>
        </thead>
        <tbody>
          ${fieldsHtml}
        </tbody>
      </table>

      <div style="margin-top: 16px; text-align: right;">
        <button id="goenchan-modal-ok" style="
          background: #1976d2;
          color: white;
          border: none;
          padding: 8px 24px;
          border-radius: 6px;
          cursor: pointer;
        ">閉じる</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Event handlers
  document.getElementById('goenchan-modal-close').addEventListener('click', () => modal.remove());
  document.getElementById('goenchan-modal-ok').addEventListener('click', () => modal.remove());
  document.getElementById('goenchan-modal-backdrop').addEventListener('click', () => modal.remove());
}

/**
 * Notify background script about verification result (for batch mode ONLY)
 */
async function notifyVerificationResult(verification) {
  // Only send verification results in batch mode
  const storage = await chrome.storage.local.get(['batchMode']);
  if (!storage.batchMode) {
    console.log('⏭️ Skipping verification notification - not in batch mode');
    return;
  }

  try {
    chrome.runtime.sendMessage({
      action: 'verificationResult',
      verification: verification,
      url: window.location.href
    });
  } catch (e) {
    console.log('Could not notify background about verification:', e);
  }
}

// Find element by fingerprint
function findElementByFingerprint(fingerprint, type) {
  const allFields = getAllFormFields();

  for (const field of allFields) {
    const labelCandidates = [];
    const id = field.id;

    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) labelCandidates.push(cleanText(label.textContent));
    }

    const parentLabel = field.closest('label');
    if (parentLabel) labelCandidates.push(cleanText(parentLabel.textContent));

    const ariaLabel = field.getAttribute('aria-label');
    if (ariaLabel) labelCandidates.push(cleanText(ariaLabel));

    const fieldFingerprint = generateFingerprint(field, labelCandidates[0] || '');

    if (fieldFingerprint === fingerprint) {
      return field;
    }
  }

  return null;
}

// Match pathname against pattern (with * wildcards)
function matchesPattern(pathname, pattern) {
  if (pathname === pattern) return true;

  const patternRegex = pattern.replace(/\*/g, '[^/]+');
  const regex = new RegExp(`^${patternRegex}$`);
  return regex.test(pathname);
}

// Get all form fields
function getAllFormFields() {
  const fields = [];

  // Input fields (exclude hidden, submit, button)
  const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"])');
  fields.push(...inputs);

  // Textareas
  const textareas = document.querySelectorAll('textarea');
  fields.push(...textareas);

  // Selects
  const selects = document.querySelectorAll('select');
  fields.push(...selects);

  // Filter visible
  return Array.from(fields).filter(field => isVisible(field));
}

// Pre-configured site mappings for specific forms
const SITE_MAPPINGS = {
  // Bulk Crawler auto-generated mappings (high quality, confidence >= 80%)
  'www.nipponmedicom.co.jp': {
    name: { selector: '[name="お名前"]', confidence: 60 },
    email: { selector: '[name="メールアドレス（確認用）"]', confidence: 60 }
  },
  'qwest.co.jp': {
    name: { selector: '[name="名前"]', confidence: 100 },
    phone: { selector: '[name="電話番号"]', confidence: 100 },
    message: { selector: '[name="お問い合わせ内容"]', confidence: 100 }
  },
  'www.north.ne.jp': {
    email: { selector: '[name="_メールアドレス(確認用)"]', confidence: 80 },
    message: { selector: '[name="_お問い合わせ内容"]', confidence: 80 }
  },
  'www.hokuto-technology.net': {
    name: { selector: '[name="お名前"]', confidence: 100 },
    company: { selector: '[name="会社名"]', confidence: 100 },
    phone: { selector: '[name="電話番号"]', confidence: 100 },
    message: { selector: '[name="お問い合わせ内容"]', confidence: 100 }
  },
  'www.wi-com.jp': {
    name: { selector: '[name="お名前"]', confidence: 80 },
    email: { selector: '[name="メールアドレス"]', confidence: 80 },
    phone: { selector: '[name="電話番号"]', confidence: 80 },
    message: { selector: '[name="お問い合わせ内容"]', confidence: 80 }
  },
  'www.srand.jp': {
    name: { selector: '[name="name"]', confidence: 100 },
    email: { selector: '[name="mailfrom"]', confidence: 100 },
    message: { selector: '[name="body"]', confidence: 100 }
  },
  'www.unitedyouth.jp': {
    name: { selector: '[name="お名前(必須)"]', confidence: 100 },
    phone: { selector: '[name="電話番号"]', confidence: 100 },
    message: { selector: '[name="お問い合わせ内容"]', confidence: 100 }
  },
  'www.inet-do.co.jp': {
    name: { selector: '[name="お名前"]', confidence: 88 },
    email: { selector: '[name="Email"]', confidence: 88 },
    message: { selector: '[name="お問い合わせ内容"]', confidence: 88 }
  },
  'imagesource.jp': {
    name: { selector: '[name="お名前（ふりがな）"]', confidence: 100 },
    email: { selector: '[name="メールアドレス"]', confidence: 100 },
    company: { selector: '[name="会社名（ふりがな）"]', confidence: 100 }
  },
  'www.sanshiro-net.co.jp': {
    name: { selector: '[name="氏名"]', confidence: 88 },
    phone: { selector: '[name="電話番号[][]"]', confidence: 88 },
    message: { selector: '[name="お問い合わせの詳細"]', confidence: 88 }
  },
  'www.olive.co.jp': {
    message: { selector: '[name="ご要望・お問い合わせ内容"]', confidence: 100 },
    company: { selector: '[name="会社名"]', confidence: 100 },
    name: { selector: '[name="お名前ふりがな"]', confidence: 100 },
    phone: { selector: '[name="電話番号"]', confidence: 100 },
    email: { selector: '[name="メールアドレス"]', confidence: 100 }
  },
  'www.vm-net.ne.jp': {
    company: { selector: '[name="会社名"]', confidence: 100 },
    name: { selector: '[name="お名前"]', confidence: 100 },
    phone: { selector: '[name="電話番号"]', confidence: 100 },
    message: { selector: '[name="お問い合わせ内容"]', confidence: 100 }
  },
  'www.dgic.co.jp': {
    company: { selector: '[name="会社名"]', confidence: 93 },
    name: { selector: '[name="お名前"]', confidence: 93 },
    phone: { selector: '[name="電話番号"]', confidence: 93 },
    email: { selector: '[name="メールアドレス再入力"]', confidence: 93 },
    message: { selector: '[name="お問い合わせ種類"]', confidence: 93 }
  },
  'endeavor-team.com': {
    name: { selector: '[name="お名前"]', confidence: 86 },
    phone: { selector: '[name="電話番号"]', confidence: 86 },
    message: { selector: '[name="お問い合わせ内容"]', confidence: 86 }
  },
  'www.prosite.co.jp': {
    company: { selector: '[name="company"]', confidence: 100 },
    name: { selector: '[name="name"]', confidence: 100 },
    email: { selector: '[name="cemail"]', confidence: 100 },
    message: { selector: '[name="content"]', confidence: 100 }
  },
  'smileboom.com': {
    name: { selector: '[name="お名前"]', confidence: 82 },
    company: { selector: '[name="御社名"]', confidence: 82 },
    email: { selector: '[name="メールアドレス"]', confidence: 82 },
    phone: { selector: '[name="お電話番号[separator]"]', confidence: 82 },
    message: { selector: '[name="お問い合わせの内容"]', confidence: 82 }
  },
  'www.i-pn.jp': {
    name: { selector: '[name="お名前"]', confidence: 100 },
    email: { selector: '[name="メールアドレス"]', confidence: 100 },
    phone: { selector: '[name="電話番号"]', confidence: 100 },
    message: { selector: '[name="お問い合わせ内容"]', confidence: 100 }
  },

  // Enable auto-fill for yesp.co.jp (uses auto-detection layers)
  'www.yesp.co.jp/contact.html': {},

  // Enable auto-fill for takarada.ed.jp (uses auto-detection layers)
  'www.takarada.ed.jp/meisei/form/': {},

  // Test form (local)
  'test-form.html': {
    company_url: 'https://www.vivid52.com/',
    company: { selector: '#company', confidence: 100 },
    name: { selector: '#name', confidence: 100 },
    email: { selector: '#email', confidence: 100 },
    phone: { selector: '#phone', confidence: 100 },
    message: { selector: '#message', confidence: 100 }
  },
  'www.hokudenkogyo.co.jp/contact.html': {
    company_url: 'https://www.hokudenkogyo.co.jp/',
    company: { selector: '#company', confidence: 100 },
    name: { selector: '#your-name', confidence: 100 },
    email: { selector: '#your-email', confidence: 100 },
    phone: { selector: '#your-tel', confidence: 100 },
    message: { selector: '#your-message', confidence: 100 }
  },
  'lomilomisalon-oluolu.com/contact/': {
    company_url: 'https://lomilomisalon-oluolu.com/',
    name: { selector: 'input[name="input[name]"]', confidence: 100 },
    email: { selector: 'input[name="input[email]"]', confidence: 100 },
    phone: { selector: 'input[name="input[tel]"]', confidence: 100 },
    message: { selector: 'textarea[name="input[body]"]', confidence: 100 }
  },
  'www.medience.co.jp/contact/index.php': {
    company_url: 'https://www.medience.co.jp/',
    company: { selector: 'input[name="勤務先名"]', confidence: 100 },
    name: { selector: 'input[name="お名前"]', confidence: 100 },
    name_kana: { selector: 'input[name="フリガナ"]', confidence: 100 },
    email: { selector: 'input[name="E-mail"]', confidence: 100 },
    phone: { selector: 'input[name="TEL"]', confidence: 100 },
    department: { selector: 'input[name="所属部署名"]', confidence: 100 },
    message: { selector: 'textarea[name="お問い合わせ事項／ご意見"]', confidence: 100 }
  },
  'www.n-mark.co.jp/contact/': {
    company_url: 'https://www.n-mark.co.jp/',
    name: { selector: 'input[name="お名前"]', confidence: 100 },
    name_kana: { selector: 'input[name="フリガナ"]', confidence: 100 },
    company: { selector: 'input[name="会社名"]', confidence: 100 },
    department: { selector: 'input[name="部署名"]', confidence: 100 },
    position: { selector: 'input[name="役職"]', confidence: 100 },
    zipcode: { selector: 'input[name="郵便番号"]', confidence: 100 },
    address: { selector: 'input[name="住所"]', confidence: 100 },
    phone: { selector: 'input[name="電話番号"]', confidence: 100 },
    email: { selector: 'input[name="メールアドレス"]', confidence: 100 },
    message: { selector: 'textarea[name="お問い合わせ内容"]', confidence: 100 },
    privacy: { selector: 'input[name="プライバシーポリシー"]', type: 'checkbox', confidence: 100 }
  },
  'www.yoshida-home.co.jp/contact': {
    company_url: 'https://www.yoshida-home.co.jp/',
    name: { selector: 'input[name="your-name"]', confidence: 100 },
    email: { selector: 'input[name="your-email"]', confidence: 100 },
    phone: { selector: 'input[name="your-tel"]', confidence: 100 },
    inquiry_type: { selector: 'input[name="content-inquiry[]"][value="その他"]', type: 'checkbox', confidence: 100 },
    message: { selector: 'textarea[name="details"]', confidence: 100 },
    consent: { selector: 'input[name="checkbox-414[]"]', type: 'checkbox', confidence: 100 }
  },
  'www.do-ene.jp/inquiry/': {
    company_url: 'https://www.do-ene.jp/',
    inquiry_category: { selector: 'select[name="ご意見・お問い合わせ項目"]', value: 'その他', confidence: 100 },
    name: { selector: 'input[name="お名前"]', confidence: 100 },
    name_kana: { selector: 'input[name="フリガナ"]', confidence: 100 },
    company: { selector: 'input[name="会社名"]', confidence: 100 },
    email: { selector: 'input[name="メールアドレス"]', confidence: 100 },
    address: { selector: 'input[name="ご住所"]', confidence: 100 },
    phone1: { selector: 'input[name="お電話番号[data][0]"]', confidence: 100 },
    phone2: { selector: 'input[name="お電話番号[data][1]"]', confidence: 100 },
    phone3: { selector: 'input[name="お電話番号[data][2]"]', confidence: 100 },
    message: { selector: 'textarea[name="ご意見・お問い合わせ内容"]', confidence: 100 }
  },
  'www.ainj.co.jp/contact/dispensing-pharmacy/': {
    company_url: 'https://www.ainj.co.jp/',
    inquiry_type: { selector: 'select[name="お問い合わせの種類"]', value: 'その他', confidence: 100 },
    name: { selector: 'input[name="氏名（漢字）"]', confidence: 100 },
    name_kana: { selector: 'input[name="氏名（フリガナ）"]', confidence: 100 },
    email: { selector: 'input[name="メールアドレス"]', confidence: 100 },
    phone: { selector: 'input[name="電話番号"]', confidence: 100 },
    zipcode: { selector: 'input[name="郵便番号"]', confidence: 100 },
    city: { selector: 'input[name="市町村番地"]', confidence: 100 },
    building: { selector: 'input[name="マンション名等"]', confidence: 100 },
    message: { selector: 'textarea[name="お問い合わせ内容"]', confidence: 100 },
    privacy: { selector: 'input[name="個人情報の取扱い[]"]', type: 'checkbox', confidence: 100 }
  },
  'www.aktio.co.jp/inquiry/product/': {
    company_url: 'https://www.aktio.co.jp/',
    product_name: { selector: 'input[name="prodname"]', value: 'お問い合わせ', confidence: 100 },
    message: { selector: 'textarea[name="detail"]', confidence: 100 },
    req_method: { selector: 'input[name="req_way"][value="mail"]', type: 'radio', confidence: 100 },
    company: { selector: 'input[name="compname"]', confidence: 100 },
    company_kana: { selector: 'input[name="compname_k"]', confidence: 100 },
    department: { selector: 'input[name="depname"]', confidence: 100 },
    name: { selector: 'input[name="name"]', confidence: 100 },
    name_kana: { selector: 'input[name="name_k"]', confidence: 100 },
    email: { selector: 'input[name="email"]', confidence: 100 },
    email_confirm: { selector: 'input[name="email_c"]', confidence: 100 },
    zipcode1: { selector: 'input[name="zip_l"]', confidence: 100 },
    zipcode2: { selector: 'input[name="zip_r"]', confidence: 100 },
    city: { selector: 'input[name="town"]', confidence: 100 },
    building: { selector: 'input[name="building"]', confidence: 100 },
    phone1: { selector: 'input[name="tel_l"]', confidence: 100 },
    phone2: { selector: 'input[name="tel_c"]', confidence: 100 },
    phone3: { selector: 'input[name="tel_r"]', confidence: 100 }
  },
  'towa-eco.jp/contactform/': {
    company_url: 'https://towa-eco.jp/',
    name: { selector: 'input[name="your-name"]', confidence: 100 },
    name_kana: { selector: 'input[name="your-kana"]', confidence: 100 },
    zipcode: { selector: 'input[name="number"]', confidence: 100 },
    address: { selector: 'input[name="address"]', confidence: 100 },
    phone: { selector: 'input[name="tel"]', confidence: 100 },
    email: { selector: 'input[name="email"]', confidence: 100 },
    message: { selector: 'textarea[name="textarea"]', confidence: 100 },
    privacy: { selector: 'input[name="acceptance"]', type: 'checkbox', confidence: 100 }
  },
  'www.n-type-jimuki.com/contact/': {
    company_url: 'http://www.n-type-jimuki.com/',
    name: { selector: 'input[name="_name"]', confidence: 100 },
    email: { selector: 'input[name="_mail"]', confidence: 100 },
    inquiry_category: { selector: 'input[name="comment_type"][value="その他"]', type: 'checkbox', confidence: 100 },
    company: { selector: 'input[name="company1"]', confidence: 100 },
    address: { selector: 'input[name="add1"]', confidence: 100 },
    phone: { selector: 'input[name="tel1"]', confidence: 100 },
    message: { selector: 'textarea[name="_comment"]', confidence: 100 },
    privacy: { selector: 'input[name="privacy"]', type: 'checkbox', confidence: 100 }
  },
  'www.h-tokyu-bm.co.jp/contact/index.html': {
    company_url: 'https://www.h-tokyu-bm.co.jp/',
    name: { selector: 'input[name="_name"]', confidence: 100 },
    email: { selector: 'input[name="_email"]', confidence: 100 },
    phone: { selector: 'input[name="tel"]', confidence: 100 },
    message: { selector: 'textarea[name="comment"]', confidence: 100 }
  },
  'www.hilltopfood.com/form': {
    company_url: 'https://www.hilltopfood.com/',
    name: { selector: 'input[name="item_36985"]', confidence: 100 },
    name_kana1: { selector: 'input[name="item_54632"]', confidence: 100 },
    name_kana2: { selector: 'input[name="item_54633"]', confidence: 100 },
    zipcode: { selector: 'input[name="item_36986"]', confidence: 100 },
    address: { selector: 'input[name="item_36987"]', confidence: 100 },
    phone: { selector: 'input[name="item_36988"]', confidence: 100 },
    email: { selector: 'input[name="item_36989"]', confidence: 100 },
    email_confirm: { selector: 'input[name="item_36989_check"]', confidence: 100 },
    message: { selector: 'textarea[name="item_36990"]', confidence: 100 }
  },
  'www.gesyuku.net/inquiry/': {
    company_url: 'https://www.gesyuku.net/',
    name: { selector: 'input[name="お名前"]', confidence: 100 },
    company: { selector: 'input[name="会社名"]', confidence: 100 },
    email: { selector: 'input[name="Email"]', confidence: 100 },
    phone: { selector: 'input[name="TEL"]', confidence: 100 },
    inquiry_category: { selector: 'select[name="お問合せ項目"]', value: 'その他', confidence: 100 },
    message: { selector: 'textarea[name="問い合せの詳しい内容"]', confidence: 100 }
  },
  'www.otokoyama.com/contact/': {
    company_url: 'https://www.otokoyama.com/',
    name: { selector: 'input[name="お名前"]', confidence: 100 },
    phone: { selector: 'input[name="電話番号"]', confidence: 100 },
    email: { selector: 'input[name="メールアドレス"]', confidence: 100 },
    message: { selector: 'textarea[name="お問い合わせ内容"]', confidence: 100 }
  },
  'www.r-lease.co.jp/forms/general/': {
    company_url: 'https://www.r-lease.co.jp/',
    name1: { selector: 'input[name="contact_data[name_1]"]', confidence: 100 },
    name2: { selector: 'input[name="contact_data[name_2]"]', confidence: 100 },
    name_kana1: { selector: 'input[name="contact_data[name_kana_1]"]', confidence: 100 },
    name_kana2: { selector: 'input[name="contact_data[name_kana_2]"]', confidence: 100 },
    email: { selector: 'input[name="contact_data[mail]"]', confidence: 100 },
    email_confirm: { selector: 'input[name="contact_data[mail_confirm]"]', confidence: 100 },
    phone1: { selector: 'input[name="contact_data[tel_1]"]', confidence: 100 },
    phone2: { selector: 'input[name="contact_data[tel_2]"]', confidence: 100 },
    phone3: { selector: 'input[name="contact_data[tel_3]"]', confidence: 100 },
    message: { selector: 'textarea[name="contact_data[inquire]"]', confidence: 100 },
    privacy: { selector: 'input[name="contact_data[agree]"]', type: 'checkbox', confidence: 100 }
  },
  'form.hokkaido-heim.com/webapp/form/27015_bznb_8/': {
    company_url: 'https://form.hokkaido-heim.com/',
    name1: { selector: 'input[name="singleAnswer(ANSWER195)"]', confidence: 100 },
    name2: { selector: 'input[name="singleAnswer(ANSWER196)"]', confidence: 100 },
    name_kana1: { selector: 'input[name="singleAnswer(ANSWER197)"]', confidence: 100 },
    name_kana2: { selector: 'input[name="singleAnswer(ANSWER198)"]', confidence: 100 },
    zipcode: { selector: 'input[name="singleAnswer(ANSWER199)"]', confidence: 100 },
    address1: { selector: 'input[name="singleAnswer(ANSWER200)"]', confidence: 100 },
    address2: { selector: 'input[name="singleAnswer(ANSWER201)"]', confidence: 100 },
    phone: { selector: 'input[name="singleAnswer(ANSWER202)"]', confidence: 100 },
    email: { selector: 'input[name="singleAnswer(ANSWER203)"]', confidence: 100 },
    email_confirm: { selector: 'input[name="singleAnswer(ANSWER203-R)"]', confidence: 100 },
    message: { selector: 'textarea[name="singleAnswer(ANSWER214)"]', confidence: 100 }
  },
  'www.n-g-yuai.com/form.html': {
    company_url: 'https://www.n-g-yuai.com/',
    name: { selector: 'input[name="onamae"]', confidence: 100 },
    name_kana: { selector: 'input[name="furigana"]', confidence: 100 },
    email: { selector: 'input[name="mailto"]', confidence: 100 },
    email_confirm: { selector: 'input[name="mail2"]', confidence: 100 },
    message: { selector: 'textarea[name="comment"]', confidence: 100 }
  },
  'www.morinagagumi.co.jp/contact/': {
    company_url: 'https://www.morinagagumi.co.jp/',
    name: { selector: 'input[name="お名前"]', confidence: 100 },
    name_kana: { selector: 'input[name="フリガナ"]', confidence: 100 },
    email: { selector: 'input[name="メールアドレス"]', confidence: 100 },
    message: { selector: 'textarea[name="お問い合わせ内容"]', confidence: 100 }
  },
  'ma-ru-ya.jp/form/inquiry': {
    company_url: 'https://ma-ru-ya.jp/',
    name1: { selector: "input[name='item[0][answer][0]']", confidence: 100 },
    name_kana1: { selector: "input[name='item[1][answer][0]']", confidence: 100 },
    zipcode: { selector: "input[name='item[2][answer][0]']", confidence: 100 },
    prefecture: { selector: "select[name='item[3][answer][0]']", confidence: 100 },
    city: { selector: "input[name='item[4][answer][0]']", confidence: 100 },
    street: { selector: "input[name='item[5][answer][0]']", confidence: 100 },
    phone: { selector: "input[name='item[6][answer][0]']", confidence: 100 },
    email: { selector: "input[name='item[7][answer][0]']", confidence: 100 },
    message: { selector: "textarea[name='item[8][answer][0]']", confidence: 100 }
  },
  'www.marunaka-shouyu.com/contact': {
    company_url: 'https://www.marunaka-shouyu.com/',
    name1: { selector: 'input[name="name01"]', confidence: 100 },
    name2: { selector: 'input[name="name02"]', confidence: 100 },
    name_kana1: { selector: 'input[name="kana01"]', confidence: 100 },
    name_kana2: { selector: 'input[name="kana02"]', confidence: 100 },
    zipcode1: { selector: 'input[name="zip01"]', confidence: 100 },
    zipcode2: { selector: 'input[name="zip02"]', confidence: 100 },
    prefecture: { selector: 'select[name="pref"]', confidence: 100 },
    city: { selector: 'input[name="addr01"]', confidence: 100 },
    street: { selector: 'input[name="addr02"]', confidence: 100 },
    tel1: { selector: 'input[name="tel01"]', confidence: 100 },
    tel2: { selector: 'input[name="tel02"]', confidence: 100 },
    tel3: { selector: 'input[name="tel03"]', confidence: 100 },
    email: { selector: 'input[name="email"]', confidence: 100 },
    email_confirm: { selector: 'input[name="email02"]', confidence: 100 },
    message: { selector: 'textarea[name="contents"]', confidence: 100 }
  },
  'www.katou-shouyu.co.jp/FORM/contact.cgi': {
    company_url: 'https://www.katou-shouyu.co.jp/',
    name1: { selector: 'input[name="Form01"]', confidence: 100 },
    phone: { selector: 'input[name="Form02"]', confidence: 100 },
    email: { selector: 'input[name="YourMail1"]', confidence: 100 },
    email_confirm: { selector: 'input[name="YourMail2"]', confidence: 100 },
    message: { selector: 'textarea[name="Naiyo"]', confidence: 100 }
  },
  'www.hoshisan.jp/contact': {
    company_url: 'https://www.hoshisan.jp/',
    name1: { selector: 'input[name="contact[name][name01]"]', confidence: 100 },
    name2: { selector: 'input[name="contact[name][name02]"]', confidence: 100 },
    name_kana1: { selector: 'input[name="contact[kana][kana01]"]', confidence: 100 },
    name_kana2: { selector: 'input[name="contact[kana][kana02]"]', confidence: 100 },
    zipcode: { selector: 'input[name="contact[postal_code]"]', confidence: 100 },
    prefecture: { selector: 'select[name="contact[address][pref]"]', confidence: 100 },
    city: { selector: 'input[name="contact[address][addr01]"]', confidence: 100 },
    street: { selector: 'input[name="contact[address][addr02]"]', confidence: 100 },
    phone: { selector: 'input[name="contact[phone_number]"]', confidence: 100 },
    email: { selector: 'input[name="contact[email]"]', confidence: 100 },
    message: { selector: 'textarea[name="contact[contents]"]', confidence: 100 }
  },
  'www.robakashitsukasa.co.jp/contact': {
    company_url: 'https://www.robakashitsukasa.co.jp/',
    name1: { selector: 'input[name="contact[name][name01]"]', confidence: 100 },
    name2: { selector: 'input[name="contact[name][name02]"]', confidence: 100 },
    name_kana1: { selector: 'input[name="contact[kana][kana01]"]', confidence: 100 },
    name_kana2: { selector: 'input[name="contact[kana][kana02]"]', confidence: 100 },
    zipcode: { selector: 'input[name="contact[postal_code]"]', confidence: 100 },
    prefecture: { selector: 'select[name="contact[address][pref]"]', confidence: 100 },
    city: { selector: 'input[name="contact[address][addr01]"]', confidence: 100 },
    street: { selector: 'input[name="contact[address][addr02]"]', confidence: 100 },
    phone: { selector: 'input[name="contact[phone_number]"]', confidence: 100 },
    email: { selector: 'input[name="contact[email]"]', confidence: 100 },
    message: { selector: 'textarea[name="contact[contents]"]', confidence: 100 }
  },
  'www.nisaka.co.jp/inquiry.html': {
    company_url: 'https://www.nisaka.co.jp/',
    company: { selector: 'input[name="company"]', confidence: 100 },
    department: { selector: 'input[name="department"]', confidence: 100 },
    name1: { selector: 'input[name="surname"]', confidence: 100 },
    name2: { selector: 'input[name="given_name"]', confidence: 100 },
    name_kana1: { selector: 'input[name="surname_furigana"]', confidence: 100 },
    name_kana2: { selector: 'input[name="given_name_furigana"]', confidence: 100 },
    phone: { selector: 'input[name="phone"]', confidence: 100 },
    email: { selector: 'input[name="email"]', confidence: 100 },
    email_confirm: { selector: 'input[name="email_confirm"]', confidence: 100 },
    inquiry_category: { selector: 'select[name="inquiryContents"]', value: 'その他', confidence: 100 },
    message: { selector: 'textarea[name="inquiry_content"]', confidence: 100 }
  },
  'www.moriyama.or.jp/genseikai/contact': {
    company_url: 'https://www.moriyama.or.jp/genseikai/',
    name: { selector: 'input[name="contact-name"]', confidence: 100 },
    address: { selector: 'input[name="address"]', confidence: 100 },
    email: { selector: 'input[name="email"]', confidence: 100 },
    phone: { selector: 'input[name="tel"]', confidence: 100 },
    message: { selector: 'textarea[name="description"]', confidence: 100 },
    privacy: { selector: 'input[name="accept_policy[data][]"]', type: 'checkbox', confidence: 100 }
  },
  'www.ujiban.co.jp/contact/index.html': {
    company_url: 'http://www.ujiban.co.jp/',
    name: { selector: 'input[name="field1_text"]', confidence: 100 },
    address: { selector: 'input[name="field2_text"]', confidence: 100 },
    phone: { selector: 'input[name="field3_text"]', confidence: 100 },
    email: { selector: 'input[name="field4_text"]', confidence: 100 },
    message: { selector: 'textarea[name="message_text"]', confidence: 100 }
  },
  'www.kanda-coffee-en.com/otoi/': {
    company_url: 'https://www.kanda-coffee-en.com/',
    name: { selector: 'input[name="name"]', confidence: 100 },
    name_kana: { selector: 'input[name="furigana"]', confidence: 100 },
    email: { selector: 'input[name="email"]', confidence: 100 },
    message: { selector: 'textarea[name="content"]', confidence: 100 },
    privacy: { selector: 'input[name="pp"]', type: 'checkbox', confidence: 100 }
  },
  'saitohweb.com/pages/5/': {
    company_url: 'https://saitohweb.com/',
    name: { selector: 'input[name="data[Block9_1][item][1]"]', confidence: 100 },
    zipcode: { selector: 'input[name="data[Block9_1][item][31][code]"]', confidence: 100 },
    address: { selector: 'input[name="data[Block9_1][item][31][text]"]', confidence: 100 },
    phone: { selector: 'input[name="data[Block9_1][item][7]"]', confidence: 100 },
    email: { selector: 'input[name="data[Block9_1][item][8][1]"]', confidence: 100 },
    email_confirm: { selector: 'input[name="data[Block9_1][item][8][2]"]', confidence: 100 },
    message: { selector: 'textarea[name="data[Block9_1][item][9]"]', confidence: 100 }
  },
  'www.s-meiban.com/contact/others/': {
    company_url: 'https://www.s-meiban.com/',
    name1: { selector: 'input[name="name1"]', confidence: 100 },
    name2: { selector: 'input[name="name2"]', confidence: 100 },
    name_kana1: { selector: 'input[name="kana1"]', confidence: 100 },
    name_kana2: { selector: 'input[name="kana2"]', confidence: 100 },
    company: { selector: 'input[name="company"]', confidence: 100 },
    department: { selector: 'input[name="division"]', confidence: 100 },
    zipcode1: { selector: 'input[name="zip1"]', confidence: 100 },
    zipcode2: { selector: 'input[name="zip2"]', confidence: 100 },
    prefecture: { selector: 'select[name="prefectures"]', confidence: 100 },
    city: { selector: 'input[name="municipality"]', confidence: 100 },
    address: { selector: 'input[name="address"]', confidence: 100 },
    building: { selector: 'input[name="building"]', confidence: 100 },
    phone: { selector: 'input[name="phone"]', confidence: 100 },
    email: { selector: 'input[name="email"]', confidence: 100 },
    email_confirm: { selector: 'input[name="confirm"]', confidence: 100 },
    message: { selector: 'textarea[name="message"]', confidence: 100 },
    privacy: { selector: 'input[name="privacy[data][]"]', type: 'checkbox', confidence: 100 }
  },
  'www.white-express.jp/contact/': {
    company_url: 'http://www.white-express.jp/',
    name: { selector: 'input[name="_name"]', confidence: 100 },
    email: { selector: 'input[name="_mail"]', confidence: 100 },
    zipcode: { selector: 'input[name="zip"]', confidence: 100 },
    company: { selector: 'input[name="company1"]', confidence: 100 },
    address: { selector: 'input[name="add1"]', confidence: 100 },
    phone: { selector: 'input[name="tel1"]', confidence: 100 },
    message: { selector: 'textarea[name="_comment"]', confidence: 100 },
    privacy: { selector: 'input[name="privacy"]', type: 'checkbox', confidence: 100 }
  },
  'su-mi-ka.jp/cont.html': {
    company_url: 'https://su-mi-ka.jp/',
    email: { selector: 'input[name="email(必須)"]', confidence: 100 },
    company: { selector: 'input[name="貴社名(必須)"]', confidence: 100 },
    name1: { selector: 'input[name="姓(必須)"]', confidence: 100 },
    name2: { selector: 'input[name="名(必須)"]', confidence: 100 },
    name_kana1: { selector: 'input[name="セイ"]', confidence: 100 },
    name_kana2: { selector: 'input[name="メイ"]', confidence: 100 },
    phone: { selector: 'input[name="電話番号(必須)"]', confidence: 100 },
    zipcode: { selector: 'input[name="郵便番号"]', confidence: 100 },
    prefecture: { selector: 'select[name="都道府県"]', confidence: 100 },
    city: { selector: 'input[name="市区町村"]', confidence: 100 },
    street: { selector: 'input[name="丁目番地"]', confidence: 100 }
  },
  'www.meiseimd.co.jp/contact/form.cgi': {
    company_url: 'https://www.meiseimd.co.jp/',
    name: { selector: 'input[name="name1"]', confidence: 100 },
    name_kana: { selector: 'input[name="F2"]', confidence: 100 },
    company: { selector: 'input[name="F3"]', confidence: 100 },
    department: { selector: 'input[name="F4"]', confidence: 100 },
    position: { selector: 'input[name="F5"]', confidence: 100 },
    email: { selector: 'input[name="Email6"]', confidence: 100 },
    email_confirm_local: { selector: 'input[name="EmailCHKB6"]', confidence: 100 },
    email_confirm_domain: { selector: 'input[name="EmailCHKC6"]', confidence: 100 },
    zipcode: { selector: 'input[name="post7"]', confidence: 100 },
    prefecture: { selector: 'select[name="pref7"]', confidence: 100 },
    city: { selector: 'input[name="add7"]', confidence: 100 },
    street: { selector: 'input[name="town7"]', confidence: 100 },
    building: { selector: 'input[name="ofice7"]', confidence: 100 },
    phone: { selector: 'input[name="F8"]', confidence: 100 },
    message: { selector: 'textarea[name="F10"]', confidence: 100 }
  },
  // Formzu form for www.308.co.jp
  'ws.formzu.net/fgen/S94102806/': {
    company_url: 'https://www.308.co.jp/',
    name: { selector: 'input[name="tkna001"]', confidence: 100 },
    name_kana: { selector: 'input[name="text457"]', confidence: 100 },
    zipcode1: { selector: 'input[name="tkad223-zipcode1"]', confidence: 100 },
    zipcode2: { selector: 'input[name="tkad223-zipcode2"]', confidence: 100 },
    prefecture: { selector: 'select[name="tkad223-pref"]', confidence: 100 },
    city: { selector: 'input[name="tkad223-city"]', confidence: 100 },
    address: { selector: 'input[name="tkad223-chomei"]', confidence: 100 },
    building: { selector: 'input[name="tkad223-tatemono"]', confidence: 100 },
    phone1: { selector: 'input[name="tkph134-1"]', confidence: 100 },
    phone2: { selector: 'input[name="tkph134-2"]', confidence: 100 },
    phone3: { selector: 'input[name="tkph134-3"]', confidence: 100 },
    email: { selector: 'input[name="tkem001"]', confidence: 100 },
    email_confirm: { selector: 'input[name="tkem001-check"]', confidence: 100 },
    inquiry_type: { selector: 'select[name="choi456"]', value: 'その他お墓全般について', confidence: 100 },
    message: { selector: 'textarea[name="text001"]', confidence: 100 }
  },
  // e-kenchiku.com - WordPress CF7 with non-standard names
  'e-kenchiku.com/contact/': {
    company_url: 'https://e-kenchiku.com/',
    name: { selector: 'input[name="your-name"]', confidence: 100 },
    email: { selector: 'input[name="your-email"]', confidence: 100 },
    phone: { selector: 'input[name="tell"]', confidence: 100 },
    zipcode: { selector: 'input[name="add1"]', confidence: 100 },
    address: { selector: 'input[name="add2"]', confidence: 100 },
    message: { selector: 'textarea[name="bikou"]', confidence: 100 },
    inquiry_type: { selector: 'input[name="kind"][value="資料請求"]', type: 'radio', confidence: 100 },
    privacy: { selector: 'input[name="acceptance-935"]', type: 'checkbox', confidence: 100 }
  },
  // sazae.co.jp - Japanese Direct Name Attributes
  'www.sazae.co.jp/contact/others/': {
    company_url: 'https://www.sazae.co.jp/',
    name: { selector: 'input[name="氏名"]', confidence: 100 },
    email: { selector: 'input[name="メールアドレス"]', confidence: 100 },
    email_confirm: { selector: 'input[name="メールアドレス（確認用）"]', confidence: 100 },
    phone: { selector: 'input[name="電話番号"]', confidence: 100 },
    zipcode: { selector: 'input[name="郵便番号"]', confidence: 100 },
    address: { selector: 'input[name="住所"]', confidence: 100 },
    message: { selector: 'textarea[name="お問い合わせ内容"]', confidence: 100 }
  },
  // basslinestw.com - Shopify contact form
  'basslinestw.com/pages/contact': {
    company_url: 'https://basslinestw.com/',
    name: { selector: 'input[name="contact[名前]"]', confidence: 100 },
    email: { selector: 'input[name="contact[email]"]', confidence: 100 },
    phone: { selector: 'input[name="contact[電話番号]"]', confidence: 100 },
    message: { selector: 'textarea[name="contact[メッセージ]"]', confidence: 100 }
  },
  // www.jrfreight.co.jp - Custom form with numeric query IDs
  'www.jrfreight.co.jp/inquiry/form_other': {
    company_url: 'https://www.jrfreight.co.jp/',
    company: { selector: 'input[name="query[1005]"]', confidence: 100 },
    name: { selector: 'input[name="query[10]"]', confidence: 100 },
    name_kana: { selector: 'input[name="query[1013]"]', confidence: 100 },
    zipcode: { selector: 'input[name="query[1012][0]"]', confidence: 100 },
    address: { selector: 'input[name="query[1012][1]"]', confidence: 100 },
    phone: { selector: 'input[name="query[11]"]', confidence: 100 },
    fax: { selector: 'input[name="query[1003]"]', confidence: 100 },
    email: { selector: 'input[name="query[1004]"]', confidence: 100 },
    message: { selector: 'textarea[name="query[22]"]', confidence: 100 }
  },
  // www.koyukai.co.jp - Japanese Direct (Senior housing inquiry)
  'www.koyukai.co.jp/inquiry/': {
    company_url: 'https://www.koyukai.co.jp/',
    name: { selector: 'input[name="お名前"]', confidence: 100 },
    name_kana: { selector: 'input[name="ふりがな"]', confidence: 100 },
    phone: { selector: 'input[name="お電話番号"]', confidence: 100 },
    email: { selector: 'input[name="メールアドレス"]', confidence: 100 },
    email_confirm: { selector: 'input[name="メールアドレス（確認用）"]', confidence: 100 },
    zipcode: { selector: 'input[name="郵便番号"]', confidence: 100 },
    address: { selector: 'input[name="住所（市区町村番地）"]', confidence: 100 },
    building: { selector: 'input[name="住所（建物・部屋番号）"]', confidence: 100 },
    message: { selector: 'textarea[name="お問い合せ内容"]', confidence: 100 }
  },
  // www.sho-bond.co.jp - Japanese Direct with mixed names
  'www.sho-bond.co.jp/contact/form.html': {
    company_url: 'https://www.sho-bond.co.jp/',
    company: { selector: 'input[name="会社名"]', confidence: 100 },
    department: { selector: 'input[name="部署名"]', confidence: 100 },
    name: { selector: 'input[name="氏名"]', confidence: 100 },
    email: { selector: 'input[name="email"]', confidence: 100 },
    zipcode: { selector: 'input[name="郵便番号"]', confidence: 100 },
    prefecture: { selector: 'input[name="都道府県"]', confidence: 100 },
    city: { selector: 'input[name="市区町村"]', confidence: 100 },
    street: { selector: 'input[name="丁目番地"]', confidence: 100 },
    phone: { selector: 'input[name="電話番号"]', confidence: 100 },
    message: { selector: 'textarea[name="お問合せ内容"]', confidence: 100 },
    inquiry_type: { selector: 'input[name="問い合わせ項目"][value="その他お困りごと"]', type: 'checkbox', confidence: 100 }
  },
  // www.taisetsu.or.jp - Custom CMS with Block7_1 structure
  'www.taisetsu.or.jp/publics/index/3/': {
    company_url: 'http://www.taisetsu.or.jp/',
    name: { selector: 'input[name="data[Block7_1][item][1]"]', confidence: 100 },
    name_kana: { selector: 'input[name="data[Block7_1][item][2]"]', confidence: 100 },
    zipcode: { selector: 'input[name="data[Block7_1][item][13][code]"]', confidence: 100 },
    address: { selector: 'input[name="data[Block7_1][item][13][text]"]', confidence: 100 },
    phone: { selector: 'input[name="data[Block7_1][item][8]"]', confidence: 100 },
    fax: { selector: 'input[name="data[Block7_1][item][9]"]', confidence: 100 },
    email: { selector: 'input[name="data[Block7_1][item][10][1]"]', confidence: 100 },
    email_confirm: { selector: 'input[name="data[Block7_1][item][10][2]"]', confidence: 100 },
    message: { selector: 'textarea[name="data[Block7_1][item][3]"]', confidence: 100 }
  },
  // Google Forms - Oz Nail & Eye contact form
  'docs.google.com/forms/d/e/1FAIpQLSfp0gmPn5XuDLWMqd3H1x5nN6CxCfGlEeUnVH1Drz6aaV9wkg': {
    company_url: 'https://oz-nail-eye.com/',
    email: { selector: 'input[name="entry.144889441"]', confidence: 100 },
    message: { selector: 'textarea[name="entry.1792479827"]', confidence: 100 },
    name: { selector: 'input[name="entry.698195928"]', confidence: 100 },
    name_kana: { selector: 'input[name="entry.788864870"]', confidence: 100 },
    zipcode: { selector: 'input[name="entry.784507651"]', confidence: 100 },
    address: { selector: 'textarea[name="entry.1693933473"]', confidence: 100 },
    phone: { selector: 'input[name="entry.527314570"]', confidence: 100 }
  },
  // autostage.co.jp - Japanese Direct (mixed case Email)
  'autostage.co.jp/contacts.html': {
    company_url: 'https://autostage.co.jp/',
    name: { selector: 'input[name="お名前"]', confidence: 100 },
    email: { selector: 'input[name="Email"]', confidence: 100 },
    phone: { selector: 'input[name="電話番号"]', confidence: 100 },
    message: { selector: 'textarea[name="ご質問内容"]', confidence: 100 }
  }
};

// =============================================================================
// AUTO-GENERATED MAPPINGS FROM BULK CRAWLER
// =============================================================================
// Generated at: 2026-02-04T05:20:12.619Z
// Source: Bulk Crawler v2.16.0 (Hybrid Approach - 3 URLs/batch, 16 req/site)
// Success rate: 16.3% (34/208 URLs) - 99% reduction in subrequest errors

const GENERATED_MAPPINGS = {
  "http://www.hotelabest-tokyomeguro.com/": {
    "pattern": "japanese_direct",
    "confidence": 0.4,
    "mapping": {
      "name": {
        "selector": "[name=\"お名前\"]",
        "confidence": 40
      },
      "phone": {
        "selector": "[name=\"お電話番号\"]",
        "confidence": 40
      },
      "message": {
        "selector": "[name=\"お問い合わせ内容\"]",
        "confidence": 40
      }
    }
  },
  "http://www.route-inn.co.jp/": {
    "pattern": "japanese_direct",
    "confidence": 0.1,
    "mapping": {
      "message": {
        "selector": "[name=\"content\"]",
        "confidence": 10
      }
    }
  },
  "http://tateshina.co.jp/": {
    "pattern": "wordpress_cf7",
    "confidence": 0.23529411764705882,
    "mapping": {
      "company": {
        "selector": "[name=\"your-company\"]",
        "confidence": 24
      },
      "name": {
        "selector": "[name=\"your-name\"]",
        "confidence": 24
      },
      "email": {
        "selector": "[name=\"your-email\"]",
        "confidence": 24
      },
      "phone": {
        "selector": "[name=\"your-tel\"]",
        "confidence": 24
      },
      "message": {
        "selector": "[name=\"your-message\"]",
        "confidence": 24
      }
    }
  },
  "http://www.hvf.jp/": {
    "pattern": "japanese_direct",
    "confidence": 0.07142857142857142,
    "mapping": {
      "message": {
        "selector": "[name=\"contentsText\"]",
        "confidence": 7
      }
    }
  },
  "http://www.hotel-atlas.jp/": {
    "pattern": "japanese_direct",
    "confidence": 0.6,
    "mapping": {
      "name": {
        "selector": "[name=\"お名前\"]",
        "confidence": 60
      },
      "phone": {
        "selector": "[name=\"電話番号\"]",
        "confidence": 60
      },
      "email": {
        "selector": "[name=\"メールアドレス\"]",
        "confidence": 60
      }
    }
  },
  "http://www.will-shinjuku.com/": {
    "pattern": "wordpress_cf7",
    "confidence": 0.5,
    "mapping": {
      "company": {
        "selector": "[name=\"your-company\"]",
        "confidence": 50
      },
      "name": {
        "selector": "[name=\"your-name\"]",
        "confidence": 50
      },
      "email": {
        "selector": "[name=\"your-email\"]",
        "confidence": 50
      },
      "phone": {
        "selector": "[name=\"your-tel\"]",
        "confidence": 50
      },
      "message": {
        "selector": "[name=\"your-message\"]",
        "confidence": 50
      }
    }
  },
  "http://www.hotelsiena.jp/": {
    "pattern": "wordpress_cf7",
    "confidence": 0.13636363636363635,
    "mapping": {
      "company": {
        "selector": "[name=\"your-company\"]",
        "confidence": 14
      },
      "name": {
        "selector": "[name=\"your-name\"]",
        "confidence": 14
      },
      "email": {
        "selector": "[name=\"your-email\"]",
        "confidence": 14
      },
      "phone": {
        "selector": "[name=\"your-tel\"]",
        "confidence": 14
      },
      "message": {
        "selector": "[name=\"your-message\"]",
        "confidence": 14
      }
    }
  },
  "https://www.pearlhotels.jp/": {
    "pattern": "japanese_direct",
    "confidence": 0.058823529411764705,
    "mapping": {
      "email": {
        "selector": "[name=\"EMAIL\"]",
        "confidence": 6
      }
    }
  },
  "http://www.dh-ryogoku.com/": {
    "pattern": "wordpress_cf7",
    "confidence": 0.13636363636363635,
    "mapping": {
      "company": {
        "selector": "[name=\"your-company\"]",
        "confidence": 14
      },
      "name": {
        "selector": "[name=\"your-name\"]",
        "confidence": 14
      },
      "email": {
        "selector": "[name=\"your-email\"]",
        "confidence": 14
      },
      "phone": {
        "selector": "[name=\"your-tel\"]",
        "confidence": 14
      },
      "message": {
        "selector": "[name=\"your-message\"]",
        "confidence": 14
      }
    }
  },
  "http://www.hotelhomare.com/": {
    "pattern": "japanese_direct",
    "confidence": 0.15384615384615385,
    "mapping": {
      "company": {
        "selector": "[name=\"会社名\"]",
        "confidence": 15
      }
    }
  },
  "http://richmondhotel.jp/": {
    "pattern": "split_fields",
    "confidence": 1,
    "mapping": {
      "name": {
        "selector": "[name=\"name1\"]",
        "confidence": 100
      },
      "phone": {
        "selector": "[name=\"tel1\"]",
        "confidence": 100
      }
    }
  },
  "http://united.jp/": {
    "pattern": "japanese_direct",
    "confidence": 0.3888888888888889,
    "mapping": {
      "name": {
        "selector": "[name=\"お名前\"]",
        "confidence": 39
      },
      "email": {
        "selector": "[name=\"メールアドレス\"]",
        "confidence": 39
      },
      "message": {
        "selector": "[name=\"お問い合わせ分類\"]",
        "confidence": 39
      }
    }
  },
  "http://www.suntargas.co.jp/": {
    "pattern": "japanese_direct",
    "confidence": 0.9166666666666666,
    "mapping": {
      "message": {
        "selector": "[name=\"__children[お問い合わせ種別][]\"]",
        "confidence": 92
      },
      "name": {
        "selector": "[name=\"お名前\"]",
        "confidence": 92
      },
      "email": {
        "selector": "[name=\"メールアドレス\"]",
        "confidence": 92
      },
      "phone": {
        "selector": "[name=\"電話番号\"]",
        "confidence": 92
      }
    }
  },
  "http://www.viewhotels.co.jp/": {
    "pattern": "japanese_direct",
    "confidence": 0.18181818181818182,
    "mapping": {
      "message": {
        "selector": "[name=\"message\"]",
        "confidence": 18
      }
    }
  },
  "http://www.gokokumai.co.jp/": {
    "pattern": "wordpress_cf7",
    "confidence": 0.1875,
    "mapping": {
      "company": {
        "selector": "[name=\"your-company\"]",
        "confidence": 19
      },
      "name": {
        "selector": "[name=\"your-name\"]",
        "confidence": 19
      },
      "email": {
        "selector": "[name=\"your-email\"]",
        "confidence": 19
      },
      "phone": {
        "selector": "[name=\"your-tel\"]",
        "confidence": 19
      },
      "message": {
        "selector": "[name=\"your-message\"]",
        "confidence": 19
      }
    }
  },
  "http://www.accela.co.jp/": {
    "pattern": "wordpress_cf7",
    "confidence": 0.23076923076923078,
    "mapping": {
      "company": {
        "selector": "[name=\"your-company\"]",
        "confidence": 23
      },
      "name": {
        "selector": "[name=\"your-name\"]",
        "confidence": 23
      },
      "email": {
        "selector": "[name=\"your-email\"]",
        "confidence": 23
      },
      "phone": {
        "selector": "[name=\"your-tel\"]",
        "confidence": 23
      },
      "message": {
        "selector": "[name=\"your-message\"]",
        "confidence": 23
      }
    }
  },
  "http://www.asakusahotel.org/": {
    "pattern": "japanese_direct",
    "confidence": 0.3333333333333333,
    "mapping": {
      "message": {
        "selector": "[name=\"content\"]",
        "confidence": 33
      }
    }
  },
  "http://www.uenocity-hotel.com/": {
    "pattern": "japanese_direct",
    "confidence": 1,
    "mapping": {
      "name": {
        "selector": "[name=\"お名前\"]",
        "confidence": 100
      },
      "phone": {
        "selector": "[name=\"電話番号\"]",
        "confidence": 100
      },
      "message": {
        "selector": "[name=\"お問い合わせ内容\"]",
        "confidence": 100
      }
    }
  },
  "http://www.izuhotel.co.jp/": {
    "pattern": "wordpress_cf7",
    "confidence": 0.2,
    "mapping": {
      "company": {
        "selector": "[name=\"your-company\"]",
        "confidence": 20
      },
      "name": {
        "selector": "[name=\"your-name\"]",
        "confidence": 20
      },
      "email": {
        "selector": "[name=\"your-email\"]",
        "confidence": 20
      },
      "phone": {
        "selector": "[name=\"your-tel\"]",
        "confidence": 20
      },
      "message": {
        "selector": "[name=\"your-message\"]",
        "confidence": 20
      }
    }
  }
};

// Merge generated mappings with existing SITE_MAPPINGS
Object.assign(SITE_MAPPINGS, GENERATED_MAPPINGS);

// AUTO-LOAD: Load auto-generated mappings from chrome.storage
(async function loadAutoGeneratedMappings() {
  try {
    const stored = await chrome.storage.local.get(['autoGeneratedMappings']);
    if (stored.autoGeneratedMappings && Object.keys(stored.autoGeneratedMappings).length > 0) {
      Object.assign(SITE_MAPPINGS, stored.autoGeneratedMappings);
      console.log(`✅ Loaded ${Object.keys(stored.autoGeneratedMappings).length} auto-generated mappings from local storage`);
    }
  } catch (error) {
    console.error('❌ Failed to load auto-generated mappings:', error);
  }
})();

// AUTO-LOAD: Load shared mappings from cloud (community-contributed)
(async function loadSharedMappings() {
  try {
    const response = await fetch('https://goenchan-worker.taiichifox.workers.dev/shared-mappings');
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.mappings) {
        Object.assign(SITE_MAPPINGS, data.mappings);
        console.log(`✅ Loaded ${data.count} shared mappings from cloud (community)`);
      }
    }
  } catch (error) {
    console.log('ℹ️ Could not load shared mappings (offline or unavailable)');
  }
})();

// Global cache for detected pattern
let cachedPatternMapping = null;
let cachedPatternInfo = null;

// =============================================================================
// PATTERN RECOGNITION
// =============================================================================

/**
 * Detect form builder pattern on current page
 * Returns: { name: string, score: number } | null
 */
function detectFormPattern() {
  const formFields = document.querySelectorAll('input, textarea, select');

  if (formFields.length === 0) {
    console.log('⚠️ [PATTERN] No form fields found on page');
    return null;
  }

  const forms = document.querySelectorAll('form');
  if (forms.length > 1) {
    console.log(`ℹ️ [PATTERN] Multiple forms detected (${forms.length}), analyzing all fields`);
  }

  const patterns = [
    {
      name: 'wordpress-cf7',
      score: 0,
      detector: detectWordPressCF7
    },
    {
      name: 'japanese-direct',
      score: 0,
      detector: detectJapaneseDirect
    },
    {
      name: 'required-marks',
      score: 0,
      detector: detectRequiredMarks
    },
    {
      name: 'mailform-cgi',
      score: 0,
      detector: detectMailFormCGI
    },
    {
      name: 'split-fields',
      score: 0,
      detector: detectSplitFields
    }
  ];

  // Calculate scores for each pattern
  patterns.forEach(pattern => {
    pattern.score = pattern.detector(formFields);
  });

  // Sort by score (highest first)
  patterns.sort((a, b) => b.score - a.score);
  const bestPattern = patterns[0];

  // Log all scores
  console.log('🔍 [PATTERN DETECTION]');
  console.log('All pattern scores:', patterns.map(p => `${p.name}: ${p.score}%`).join(', '));

  // Check threshold
  const THRESHOLD = 50;
  if (bestPattern.score >= THRESHOLD) {
    console.log(`✅ Pattern detected: ${bestPattern.name} (${bestPattern.score}%)`);
    return bestPattern;
  } else {
    console.log(`⚠️ No pattern matched (threshold: ${THRESHOLD}%, best: ${bestPattern.score}%)`);
    return null;
  }
}

/**
 * Detect WordPress Contact Form 7 pattern
 * Looks for fields with name="your-*"
 */
function detectWordPressCF7(fields) {
  if (!fields || fields.length === 0) {
    return 0;
  }

  let yourFieldCount = 0;

  fields.forEach(field => {
    const name = field.getAttribute('name') || '';
    if (name.startsWith('your-')) {
      yourFieldCount++;
    }
  });

  // Need 3+ fields to confidently detect
  if (yourFieldCount >= 3) {
    // Base score 50 + 10 per field, max 100
    const score = Math.min(100, 50 + (yourFieldCount * 10));
    console.log(`  [CF7] Found ${yourFieldCount} 'your-*' fields, score: ${score}`);
    return score;
  }

  return 0;
}

/**
 * Detect Japanese direct name attributes pattern
 * Looks for Japanese characters in name attributes
 */
function detectJapaneseDirect(fields) {
  if (!fields || fields.length === 0) {
    return 0;
  }

  let japaneseFieldCount = 0;
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/; // Hiragana, Katakana, Kanji

  fields.forEach(field => {
    const name = field.getAttribute('name') || '';
    if (japaneseRegex.test(name)) {
      japaneseFieldCount++;
    }
  });

  // Need 3+ Japanese fields
  if (japaneseFieldCount >= 3) {
    const score = Math.min(100, 50 + (japaneseFieldCount * 10));
    console.log(`  [Japanese] Found ${japaneseFieldCount} Japanese name fields, score: ${score}`);
    return score;
  }

  return 0;
}

/**
 * Detect required marks pattern
 * Looks for fields with (必須) or （必須） in name
 */
function detectRequiredMarks(fields) {
  if (!fields || fields.length === 0) {
    return 0;
  }

  let requiredFieldCount = 0;
  const requiredRegex = /[（(]必須[)）]/;

  fields.forEach(field => {
    const name = field.getAttribute('name') || '';
    if (requiredRegex.test(name)) {
      requiredFieldCount++;
    }
  });

  // Need 2+ required mark fields (threshold lower than others)
  if (requiredFieldCount >= 2) {
    const score = Math.min(100, 50 + (requiredFieldCount * 15));
    console.log(`  [Required] Found ${requiredFieldCount} required mark fields, score: ${score}`);
    return score;
  }

  return 0;
}

/**
 * Detect MailForm CGI pattern
 * Looks for F[digit] or Email[digit] naming
 */
function detectMailFormCGI(fields) {
  if (!fields || fields.length === 0) {
    return 0;
  }

  let fFieldCount = 0;
  let emailFieldCount = 0;
  const fFieldRegex = /^F\d+$/;
  const emailFieldRegex = /^Email\d+$/i;

  fields.forEach(field => {
    const name = field.getAttribute('name') || '';
    if (fFieldRegex.test(name)) {
      fFieldCount++;
    } else if (emailFieldRegex.test(name)) {
      emailFieldCount++;
    }
  });

  const totalCount = fFieldCount + emailFieldCount;

  // Need 3+ CGI-style fields
  if (totalCount >= 3) {
    const score = Math.min(100, 40 + (totalCount * 12));
    console.log(`  [MailForm] Found ${fFieldCount} F-fields, ${emailFieldCount} Email-fields, score: ${score}`);
    return score;
  }

  return 0;
}

/**
 * Detect split fields pattern
 * Looks for numbered sequential fields (name1/name2, tel1/tel2/tel3)
 */
function detectSplitFields(fields) {
  if (!fields || fields.length === 0) {
    return 0;
  }

  const fieldGroups = {};
  const splitRegex = /^(.+?)(\d+)$/;

  fields.forEach(field => {
    const name = field.getAttribute('name') || '';
    const match = name.match(splitRegex);
    if (match) {
      const baseName = match[1];
      const number = parseInt(match[2]);

      if (!fieldGroups[baseName]) {
        fieldGroups[baseName] = [];
      }
      fieldGroups[baseName].push(number);
    }
  });

  // Count groups with 2+ sequential numbers
  let splitGroupCount = 0;
  for (const [baseName, numbers] of Object.entries(fieldGroups)) {
    if (numbers.length >= 2) {
      splitGroupCount++;
    }
  }

  // Need 2+ split groups
  if (splitGroupCount >= 2) {
    const score = Math.min(100, 50 + (splitGroupCount * 12));
    console.log(`  [Split] Found ${splitGroupCount} split field groups, score: ${score}`);
    return score;
  }

  return 0;
}

/**
 * Generate field mapping based on detected pattern
 * Returns mapping object similar to SITE_MAPPINGS structure
 */
function generatePatternMapping(patternName, formFields) {
  console.log(`🗺️ [MAPPING GENERATION] Pattern: ${patternName}`);

  if (!formFields || formFields.length === 0) {
    console.log('⚠️ [MAPPING] No fields found for pattern generation');
    return {};
  }

  let mapping = {};

  switch(patternName) {
    case 'wordpress-cf7':
      mapping = generateWordPressCF7Mapping(formFields);
      break;
    case 'japanese-direct':
      mapping = generateJapaneseDirectMapping(formFields);
      break;
    case 'required-marks':
      mapping = generateRequiredMarksMapping(formFields);
      break;
    case 'mailform-cgi':
      mapping = generateMailFormCGIMapping(formFields);
      break;
    case 'split-fields':
      mapping = generateSplitFieldsMapping(formFields);
      break;
    default:
      console.log(`⚠️ [MAPPING] Unknown pattern: ${patternName}`);
      return {};
  }

  console.log('Generated mapping:', mapping);
  console.log(`  - Mapped ${Object.keys(mapping).length} field types`);

  return mapping;
}

/**
 * Generate mapping for WordPress Contact Form 7
 */
function generateWordPressCF7Mapping(fields) {
  const mapping = {};

  const cf7FieldMap = {
    'your-name': { field: 'name', confidence: 90 },
    'your-email': { field: 'email', confidence: 95 },
    'your-subject': { field: 'subject', confidence: 90 },
    'your-message': { field: 'message', confidence: 90 },
    'your-msg': { field: 'message', confidence: 85 },
    'your-inquiry': { field: 'message', confidence: 85 },
    'your-comment': { field: 'message', confidence: 85 },
    'your-content': { field: 'message', confidence: 85 },
    'your-tel': { field: 'phone', confidence: 85 },
    'your-phone': { field: 'phone', confidence: 85 },
    'your-company': { field: 'company', confidence: 85 },
    'your-zipcode': { field: 'zipcode', confidence: 85 },
    'your-address': { field: 'address', confidence: 85 }
  };

  console.log(`  [CF7] Processing ${fields.length} fields:`);
  fields.forEach(field => {
    const name = field.getAttribute('name') || '';
    if (name.startsWith('your-')) {
      console.log(`    - Field name: "${name}" → ${cf7FieldMap[name] ? 'MAPPED to ' + cf7FieldMap[name].field : 'NOT MAPPED'}`);
    }
    if (cf7FieldMap[name]) {
      const { field: fieldType, confidence } = cf7FieldMap[name];
      mapping[fieldType] = {
        selector: `[name="${name}"]`,
        confidence: confidence
      };
    }
  });

  return mapping;
}

/**
 * Generate mapping for Japanese direct name attributes
 */
function generateJapaneseDirectMapping(fields) {
  const mapping = {};

  const japaneseFieldMap = {
    'お名前': { field: 'name', confidence: 85 },
    '氏名': { field: 'name', confidence: 85 },
    '会社名': { field: 'company', confidence: 90 },
    '企業名': { field: 'company', confidence: 90 },
    'メール': { field: 'email', confidence: 85 },
    'メールアドレス': { field: 'email', confidence: 90 },
    'Eメール': { field: 'email', confidence: 85 },
    '電話': { field: 'phone', confidence: 80 },
    '電話番号': { field: 'phone', confidence: 85 },
    '件名': { field: 'subject', confidence: 85 },
    'お問い合わせ内容': { field: 'message', confidence: 85 },
    'メッセージ': { field: 'message', confidence: 80 },
    'メッセージ本文': { field: 'message', confidence: 85 },
    '本文': { field: 'message', confidence: 80 },
    '内容': { field: 'message', confidence: 75 },
    'ご質問内容': { field: 'message', confidence: 80 },
    'ご相談内容': { field: 'message', confidence: 80 },
    '詳細': { field: 'message', confidence: 70 },
    '郵便番号': { field: 'zipcode', confidence: 85 },
    '住所': { field: 'address', confidence: 85 }
  };

  fields.forEach(field => {
    const name = field.getAttribute('name') || '';
    if (japaneseFieldMap[name]) {
      const { field: fieldType, confidence } = japaneseFieldMap[name];
      mapping[fieldType] = {
        selector: `[name="${name}"]`,
        confidence: confidence
      };
    }
  });

  return mapping;
}

/**
 * Generate mapping for required marks pattern
 * Strip (必須) from field names and match
 */
function generateRequiredMarksMapping(fields) {
  const mapping = {};
  const requiredRegex = /[（(]必須[)）]/g;

  const keywordMap = {
    '会社名': { field: 'company', confidence: 80 },
    '企業名': { field: 'company', confidence: 80 },
    'お名前': { field: 'name', confidence: 75 },
    '氏名': { field: 'name', confidence: 75 },
    '名前': { field: 'name', confidence: 75 },
    'メール': { field: 'email', confidence: 80 },
    'メールアドレス': { field: 'email', confidence: 85 },
    '電話': { field: 'phone', confidence: 75 },
    '電話番号': { field: 'phone', confidence: 80 },
    '件名': { field: 'subject', confidence: 75 },
    'お問い合わせ内容': { field: 'message', confidence: 75 },
    'メッセージ': { field: 'message', confidence: 70 }
  };

  fields.forEach(field => {
    const name = field.getAttribute('name') || '';
    // Strip required marks
    const cleanName = name.replace(requiredRegex, '').trim();

    if (keywordMap[cleanName]) {
      const { field: fieldType, confidence } = keywordMap[cleanName];
      mapping[fieldType] = {
        selector: `[name="${name}"]`,
        confidence: confidence
      };
    }
  });

  return mapping;
}

/**
 * Generate mapping for MailForm CGI pattern
 * Uses inference based on field order and Email fields
 */
function generateMailFormCGIMapping(fields) {
  const mapping = {};
  const fFields = [];

  // Collect F-fields in order
  fields.forEach(field => {
    const name = field.getAttribute('name') || '';
    const match = name.match(/^F(\d+)$/);
    if (match) {
      fFields.push({ num: parseInt(match[1]), name: name, field: field });
    }

    // Email fields are usually explicit
    if (name.match(/^Email\d+$/i)) {
      mapping.email = {
        selector: `[name="${name}"]`,
        confidence: 85
      };
    }
  });

  // Sort by field number
  fFields.sort((a, b) => a.num - b.num);

  // Infer field types based on common patterns
  // F1 or F2 is often name or company
  if (fFields.length >= 1 && !mapping.name) {
    mapping.name = {
      selector: `[name="${fFields[0].name}"]`,
      confidence: 65
    };
  }

  if (fFields.length >= 2 && !mapping.company) {
    mapping.company = {
      selector: `[name="${fFields[1].name}"]`,
      confidence: 60
    };
  }

  // Later fields might be phone, address
  if (fFields.length >= 3) {
    mapping.phone = {
      selector: `[name="${fFields[2].name}"]`,
      confidence: 55
    };
  }

  return mapping;
}

/**
 * Generate mapping for split fields pattern
 * Detect name1/name2, tel1/tel2/tel3, etc.
 */
function generateSplitFieldsMapping(fields) {
  const mapping = {};
  const fieldGroups = {};
  const splitRegex = /^(.+?)(\d+)$/;

  // Group fields by base name
  fields.forEach(field => {
    const name = field.getAttribute('name') || '';
    const match = name.match(splitRegex);
    if (match) {
      const baseName = match[1];
      const number = parseInt(match[2]);

      if (!fieldGroups[baseName]) {
        fieldGroups[baseName] = [];
      }
      fieldGroups[baseName].push({ number, name, field });
    }
  });

  // Identify split patterns
  for (const [baseName, group] of Object.entries(fieldGroups)) {
    if (group.length >= 2) {
      group.sort((a, b) => a.number - b.number);
      const names = group.map(g => g.name);

      // Name splits (name1, name2 or sei, mei)
      if (baseName.match(/name|名前|氏名|sei|mei/i)) {
        mapping.name1 = { selector: `[name="${names[0]}"]`, confidence: 80 };
        if (names[1]) {
          mapping.name2 = { selector: `[name="${names[1]}"]`, confidence: 80 };
        }
      }

      // Kana splits
      if (baseName.match(/kana|カナ|かな|フリガナ/i)) {
        mapping.name_kana1 = { selector: `[name="${names[0]}"]`, confidence: 80 };
        if (names[1]) {
          mapping.name_kana2 = { selector: `[name="${names[1]}"]`, confidence: 80 };
        }
      }

      // Phone splits (tel1, tel2, tel3)
      if (baseName.match(/tel|phone|電話/i)) {
        mapping.phone1 = { selector: `[name="${names[0]}"]`, confidence: 85 };
        if (names[1]) {
          mapping.phone2 = { selector: `[name="${names[1]}"]`, confidence: 85 };
        }
        if (names[2]) {
          mapping.phone3 = { selector: `[name="${names[2]}"]`, confidence: 85 };
        }
      }

      // Zipcode splits
      if (baseName.match(/zip|postal|郵便/i)) {
        mapping.zipcode1 = { selector: `[name="${names[0]}"]`, confidence: 85 };
        if (names[1]) {
          mapping.zipcode2 = { selector: `[name="${names[1]}"]`, confidence: 85 };
        }
      }

      // Address splits
      if (baseName.match(/addr|address|住所/i)) {
        mapping.address1 = { selector: `[name="${names[0]}"]`, confidence: 85 };
        if (names[1]) {
          mapping.address2 = { selector: `[name="${names[1]}"]`, confidence: 85 };
        }
      }
    }
  }

  return mapping;
}

// Detect field type (enhanced with better Japanese keyword matching)
function detectFieldType(field) {
  const patterns = {
    company_kana: {
      keywords: ['会社名フリガナ', '会社名カナ', '企業名フリガナ', '企業名カナ', '法人名フリガナ', '貴社名フリガナ', '会社フリガナ', '会社カナ', 'company_kana', 'companykana'],
      weight: { label: 45, name: 30, placeholder: 25 }
    },
    company: {
      keywords: ['company', '会社', '企業', '法人', '団体', 'corporation', '会社名', '企業名', '貴社名', '御社名', 'organization', '勤務先', '勤務先名', '法人名', '団体名', '組織名'],
      weight: { label: 30, name: 20, placeholder: 15 }
    },
    name: {
      keywords: ['name', '名前', '氏名', 'お名前', 'おなまえ', 'full name', '担当者', '担当者名', 'your name', 'your-name'],
      weight: { label: 30, name: 20, placeholder: 15 }
    },
    name_kana: {
      keywords: ['kana', 'かな', 'カナ', 'フリガナ', 'ふりがな', 'よみがな', 'ヨミガナ', 'ふりがな（全角カタカナ）'],
      weight: { label: 40, name: 25, placeholder: 20 }
    },
    email: {
      keywords: ['email', 'mail', 'メール', 'eメール', 'メールアドレス', 'e-mail', 'your-email', 'e-mailアドレス', 'emailアドレス'],
      weight: { label: 30, name: 20, placeholder: 15 }
    },
    phone: {
      keywords: ['phone', 'tel', '電話', '電話番号', 'telephone', 'your-tel', 'tel番号', 'telnumber', '連絡先電話番号', '携帯電話', 'ご連絡先', '連絡先', 'お電話'],
      weight: { label: 30, name: 20, placeholder: 15 }
    },
    subject: {
      keywords: ['subject', '件名', 'タイトル', 'title', '用件', '問い合わせ件名', 'お問い合わせ件名'],
      weight: { label: 35, name: 25, placeholder: 20 }
    },
    message: {
      keywords: ['message', 'content', 'detail', '内容', 'メッセージ', '本文', 'お問い合わせ内容', 'お問い合わせ', '詳細', 'inquiry', 'ご質問', 'your-message', 'お問合せ内容', 'ご相談内容', 'お問い合わせ事項', 'ご意見'],
      weight: { label: 35, name: 25, placeholder: 20 }
    },
    department: {
      keywords: ['department', '部署', '所属', '部門', '所属部署', '所属部署名', 'division', 'section'],
      weight: { label: 30, name: 20, placeholder: 15 }
    },
    zipcode: {
      keywords: ['zip', 'postal', '郵便', '〒', 'postcode', '郵便番号'],
      weight: { label: 30, name: 20, placeholder: 15 }
    },
    address: {
      keywords: ['address', 'addr', '住所', 'ご住所', 'じゅうしょ', '所在地', 'your-address', 'street', 'location', 'ご住所・所在地'],
      weight: { label: 30, name: 20, placeholder: 15 }
    },
    address1: {
      keywords: ['address1', 'addr1', '住所1', '住所１', 'address_1'],
      weight: { label: 35, name: 25, placeholder: 20 }
    },
    address2: {
      keywords: ['address2', 'addr2', '住所2', '住所２', 'address_2', '建物', 'マンション', 'ビル'],
      weight: { label: 35, name: 25, placeholder: 20 }
    },
    prefecture: {
      keywords: ['prefecture', 'pref', '都道府県', '県', '都', '道', '府'],
      weight: { label: 35, name: 25, placeholder: 20 }
    },
    city: {
      keywords: ['city', 'town', '市区町村', '市町村', '市', '区', '町', '村', 'municipality'],
      weight: { label: 30, name: 20, placeholder: 15 }
    },
    street: {
      keywords: ['street', 'town', '町名', '番地', 'street-address', '丁目', 'address3'],
      weight: { label: 30, name: 20, placeholder: 15 }
    },
    building: {
      keywords: ['building', 'apt', 'apartment', 'room', '建物', 'マンション', 'ビル', 'アパート', '部屋'],
      weight: { label: 30, name: 20, placeholder: 15 }
    }
  };

  let bestMatch = null;
  let bestScore = 0;
  let bestLabel = '';
  let fieldLabel = null;

  for (const [fieldType, pattern] of Object.entries(patterns)) {
    let score = 0;

    // Check autocomplete
    const autocomplete = field.getAttribute('autocomplete');
    if (autocomplete) {
      if ((fieldType === 'email' && autocomplete === 'email') ||
          (fieldType === 'phone' && autocomplete.includes('tel')) ||
          (fieldType === 'name' && autocomplete.includes('name'))) {
        score += 50;
      }
    }

    // Check label
    const label = getFieldLabel(field);
    if (!fieldLabel && label) fieldLabel = label;
    if (label && matchesKeywords(label, pattern.keywords)) {
      score += pattern.weight.label;
      if (!bestLabel) bestLabel = label;
    }

    // Check name, id, class
    const attrs = [field.name, field.id, field.className].filter(Boolean).join(' ');
    if (matchesKeywords(attrs, pattern.keywords)) {
      score += pattern.weight.name;
    }

    // Check placeholder
    const placeholder = field.getAttribute('placeholder');
    if (placeholder && matchesKeywords(placeholder, pattern.keywords)) {
      score += pattern.weight.placeholder;
    }

    // Textarea bonus for message
    if (fieldType === 'message' && field.tagName === 'TEXTAREA') {
      score += 20;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = fieldType;
    }
  }

  if (bestScore > 0) {
    // Special handling for zipcode - detect if it's first (3-digit) or second (4-digit) part
    if (bestMatch === 'zipcode') {
      const maxLength = field.getAttribute('maxlength');
      const attrs = [field.name, field.id, field.className].filter(Boolean).join(' ').toLowerCase();

      // Check maxlength attribute
      if (maxLength === '3') {
        bestMatch = 'zipcode1';
      } else if (maxLength === '4') {
        bestMatch = 'zipcode2';
      }
      // Check for patterns indicating first or second field
      else if (attrs.match(/zip.*1|postal.*1|郵便.*1|前|first/i)) {
        bestMatch = 'zipcode1';
      } else if (attrs.match(/zip.*2|postal.*2|郵便.*2|後|second|last/i)) {
        bestMatch = 'zipcode2';
      }
      // If still ambiguous, check label
      else if (fieldLabel) {
        if (fieldLabel.match(/前|1|first/i)) {
          bestMatch = 'zipcode1';
        } else if (fieldLabel.match(/後|2|second|last/i)) {
          bestMatch = 'zipcode2';
        }
      }
    }

    // Special handling for phone - detect if it's first (3-digit), second (4-digit), or third (4-digit) part
    if (bestMatch === 'phone') {
      const maxLength = field.getAttribute('maxlength');
      const attrs = [field.name, field.id, field.className].filter(Boolean).join(' ').toLowerCase();

      // Check maxlength attribute
      if (maxLength === '3') {
        bestMatch = 'phone1';
      } else if (maxLength === '4') {
        // Need to determine if it's phone2 or phone3
        // Check for patterns indicating second or third field
        if (attrs.match(/tel.*2|phone.*2|電話.*2|middle|second/i)) {
          bestMatch = 'phone2';
        } else if (attrs.match(/tel.*3|phone.*3|電話.*3|last|third/i)) {
          bestMatch = 'phone3';
        } else {
          // Default to phone2 if ambiguous and maxlength is 4
          bestMatch = 'phone2';
        }
      }
      // Check for patterns indicating first, second, or third field
      else if (attrs.match(/tel.*1|phone.*1|電話.*1|前|first/i)) {
        bestMatch = 'phone1';
      } else if (attrs.match(/tel.*2|phone.*2|電話.*2|中|middle|second/i)) {
        bestMatch = 'phone2';
      } else if (attrs.match(/tel.*3|phone.*3|電話.*3|後|last|third/i)) {
        bestMatch = 'phone3';
      }
      // If still ambiguous, check label
      else if (fieldLabel) {
        if (fieldLabel.match(/前|1|first/i)) {
          bestMatch = 'phone1';
        } else if (fieldLabel.match(/中|2|middle|second/i)) {
          bestMatch = 'phone2';
        } else if (fieldLabel.match(/後|3|last|third/i)) {
          bestMatch = 'phone3';
        }
      }
    }

    return {
      type: bestMatch,
      confidence: Math.min(100, bestScore),
      label: bestLabel
    };
  }

  return null;
}

// Get field label (enhanced for WordPress and Japanese forms)
function getFieldLabel(field) {
  // 1. Try label[for]
  if (field.id) {
    const label = document.querySelector(`label[for="${field.id}"]`);
    if (label) return cleanText(label.textContent);
  }

  // 2. Try parent label
  const parentLabel = field.closest('label');
  if (parentLabel) return cleanText(parentLabel.textContent);

  // 3. Try aria-label
  const ariaLabel = field.getAttribute('aria-label');
  if (ariaLabel) return cleanText(ariaLabel);

  // 4. Try aria-labelledby
  const ariaLabelledBy = field.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labelElement = document.getElementById(ariaLabelledBy);
    if (labelElement) return cleanText(labelElement.textContent);
  }

  // 5. Try placeholder
  const placeholder = field.getAttribute('placeholder');
  if (placeholder) return cleanText(placeholder);

  // 6. Try WordPress-style wrapper (look for span with class wpcf7-form-control-wrap)
  const wrapper = field.closest('.wpcf7-form-control-wrap, .form-group, .field-wrapper');
  if (wrapper) {
    const wrapperLabel = wrapper.previousElementSibling;
    if (wrapperLabel && (wrapperLabel.tagName === 'LABEL' || wrapperLabel.tagName === 'SPAN')) {
      return cleanText(wrapperLabel.textContent);
    }
  }

  // 7. Try previous sibling
  let sibling = field.previousElementSibling;
  if (sibling && (sibling.tagName === 'LABEL' || sibling.tagName === 'SPAN')) {
    return cleanText(sibling.textContent);
  }

  // 8. Try parent's previous sibling (for WordPress Contact Form 7 structure)
  const parent = field.parentElement;
  if (parent) {
    const parentPrevSibling = parent.previousElementSibling;
    if (parentPrevSibling && (parentPrevSibling.tagName === 'LABEL' || parentPrevSibling.tagName === 'SPAN')) {
      return cleanText(parentPrevSibling.textContent);
    }
  }

  return null;
}

// Get immediate preceding text (for split name fields like 姓/名/セイ/メイ)
// This looks for short text labels right before the input field
function getImmediatePrecedingText(field) {
  // 1. Check previous sibling text node
  let node = field.previousSibling;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (text && text.length <= 10) {
        return text;
      }
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      // Check if it's a short span/label
      const el = node;
      if (el.tagName === 'SPAN' || el.tagName === 'LABEL' || el.tagName === 'DIV') {
        const text = cleanText(el.textContent);
        if (text && text.length <= 10) {
          return text;
        }
      }
      break; // Stop at first element
    }
    node = node.previousSibling;
  }

  // 2. Check parent's text content before the input
  const parent = field.parentElement;
  if (parent) {
    // Get all child nodes and find text right before the input
    const nodes = Array.from(parent.childNodes);
    const inputIndex = nodes.indexOf(field);

    for (let i = inputIndex - 1; i >= 0; i--) {
      const node = nodes[i];
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text && text.length <= 10) {
          return text;
        }
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const text = cleanText(node.textContent);
        if (text && text.length <= 10) {
          return text;
        }
        break; // Stop at first element with content
      }
    }
  }

  // 3. Check for table cell structure (common in Japanese forms)
  const td = field.closest('td');
  if (td) {
    // Check previous td or th in the same row
    const prevCell = td.previousElementSibling;
    if (prevCell && (prevCell.tagName === 'TD' || prevCell.tagName === 'TH')) {
      const text = cleanText(prevCell.textContent);
      if (text && text.length <= 10) {
        return text;
      }
    }
  }

  // 4. Check for dt/dd structure
  const dd = field.closest('dd');
  if (dd) {
    const dt = dd.previousElementSibling;
    if (dt && dt.tagName === 'DT') {
      const text = cleanText(dt.textContent);
      if (text && text.length <= 10) {
        return text;
      }
    }
  }

  return null;
}

// Match keywords
function matchesKeywords(text, keywords) {
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

// Fill field with value
// Format phone number based on field requirements
function formatPhoneForField(phone, field) {
  if (!phone) return phone;

  // Extract digits only
  const digits = phone.replace(/[^0-9]/g, '');
  if (!digits) return phone;

  // Check field requirements
  const placeholder = (field.getAttribute('placeholder') || '').toLowerCase();
  const maxLength = field.getAttribute('maxlength');
  const pattern = field.getAttribute('pattern');
  const nearbyText = getPreviousSiblingText(field) || '';

  // Detect if field requires no hyphens
  const noHyphenIndicators = [
    'ハイフンなし', 'ハイフン無し', 'ハイフン不要',
    '半角数字のみ', '数字のみ', 'ハイフンを除く',
    '例: 0312345678', '例:0312345678', '例）0312345678'
  ];

  let requiresNoHyphen = false;

  // Check placeholder and nearby text for no-hyphen indicators
  for (const indicator of noHyphenIndicators) {
    if (placeholder.includes(indicator.toLowerCase()) ||
        nearbyText.includes(indicator)) {
      requiresNoHyphen = true;
      console.log(`[Phone] No hyphen required - indicator found: "${indicator}"`);
      break;
    }
  }

  // Check maxlength - if maxlength is exactly the digit count, no hyphens expected
  if (maxLength) {
    const maxLengthNum = parseInt(maxLength, 10);
    // 10-11 digits without hyphens, 13-14 with hyphens
    if (maxLengthNum <= 11) {
      requiresNoHyphen = true;
      console.log(`[Phone] No hyphen required - maxlength=${maxLengthNum}`);
    }
  }

  // Check if placeholder shows no-hyphen format (e.g., "09012345678")
  if (/^0[0-9]{9,10}$/.test(placeholder.replace(/[^0-9]/g, ''))) {
    requiresNoHyphen = true;
    console.log(`[Phone] No hyphen required - placeholder shows no-hyphen format`);
  }

  // Check pattern for digits-only requirement
  if (pattern && /^\[0-9\]|^\\d/.test(pattern)) {
    requiresNoHyphen = true;
    console.log(`[Phone] No hyphen required - pattern indicates digits only`);
  }

  if (requiresNoHyphen) {
    console.log(`[Phone] Formatting without hyphens: ${digits}`);
    return digits;
  }

  // Format with hyphens (default for Japanese phone numbers)
  if (digits.length === 11) {
    // Mobile: 090-1234-5678
    return `${digits.substring(0, 3)}-${digits.substring(3, 7)}-${digits.substring(7, 11)}`;
  } else if (digits.length === 10) {
    // Landline or older mobile: 03-1234-5678 or 090-123-4567
    if (digits.charAt(1) === '3' || digits.charAt(1) === '4' ||
        digits.charAt(1) === '5' || digits.charAt(1) === '6') {
      // Tokyo/major city: 2-4-4 format
      return `${digits.substring(0, 2)}-${digits.substring(2, 6)}-${digits.substring(6, 10)}`;
    } else {
      // Other: 3-4-3 or 3-3-4 format
      return `${digits.substring(0, 3)}-${digits.substring(3, 7)}-${digits.substring(7, 10)}`;
    }
  }

  // Return original if we can't format
  return phone;
}

// カタカナ→ひらがな変換
function toHiragana(str) {
  return str.replace(/[ァ-ン]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

// フィールドがひらがなを期待しているか判定
function expectsHiragana(field) {
  const attrs = [
    field.placeholder || '',
    field.getAttribute('aria-label') || '',
    field.name || '',
    field.id || ''
  ].join(' ');
  // ラベルも確認
  let labelText = '';
  if (field.id) {
    const lbl = document.querySelector('label[for="' + field.id + '"]');
    if (lbl) labelText = lbl.textContent;
  }
  const combined = (attrs + ' ' + labelText).toLowerCase();
  // placeholderにひらがなが含まれていればひらがなフィールド
  if (/[ぁ-ん]/.test(combined)) return true;
  // よみがな・ひらがなキーワード
  if (/よみがな|ひらがな|yomigana/.test(combined)) return true;
  return false;
}


// =============================================================================
// AI FIELD FALLBACK
// =============================================================================
const AI_SERVER = 'http://216.9.225.55:8888/classify-field';

async function aiFillUnknownFields(profile) {
  // 未入力の可視フィールドを収集
  const unfilled = [];
  document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea, select').forEach(el => {
    if (!isVisible(el)) return;
    if (el.value && el.value.trim()) return; // 既に入力済み

    const label = getFieldLabel ? getFieldLabel(el) : (el.placeholder || el.name || el.id || '');
    unfilled.push({
      el,
      label: label.trim(),
      name: el.name || '',
      id: el.id || '',
      placeholder: el.placeholder || '',
      type: el.type || el.tagName.toLowerCase()
    });
  });

  if (unfilled.length === 0) return;
  console.log(`🤖 [AI Fallback] ${unfilled.length} unfilled fields, asking AI...`);

  try {
    const fields = unfilled.map(f => ({
      label: f.label, name: f.name, id: f.id,
      placeholder: f.placeholder, type: f.type
    }));

    const resp = await Promise.race([
      fetch(AI_SERVER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields, profile })
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
    ]);

    if (!resp.ok) return;
    const data = await resp.json();
    if (!data.success || !Array.isArray(data.values)) return;

    data.values.forEach((value, i) => {
      if (value === null || value === undefined || value === '') return;
      const f = unfilled[i];
      if (!f) return;
      fillField(f.el, String(value), f.type);
      console.log(`🤖 [AI] Filled "${f.label || f.name}": ${String(value).substring(0, 30)}`);
    });
  } catch (e) {
    console.log('🤖 [AI Fallback] Error:', e.message);
  }
}


function setNativeValue(el, value) {
  const inputProto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  const textareaProto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
  const proto = el.tagName === 'TEXTAREA' ? textareaProto : inputProto;
  if (proto && proto.set) {
    proto.set.call(el, value);
  } else {
    el.value = value;
  }
}

function fillField(field, value, type, fieldType = null) {
  // Layer 0b で姓/名分割済みフィールドは上書きしない
  if (field.dataset.autofilledSplit === '1') return;
  if (type === 'checkbox' || type === 'radio') {
    field.checked = !!value;
  } else if (type === 'select' || field.tagName === 'SELECT') {
    const options = Array.from(field.options);
    const matchingOption = options.find(opt => opt.value === value || opt.text === value);
    if (matchingOption) {
      field.value = matchingOption.value;
    } else {
      // fallback: その他/Other/一般/お問い合わせ/General → index=1
      const fallback = options.find(opt => /その他|Other|一般|お問い合わせ|General/i.test(opt.text || opt.value));
      if (fallback) field.value = fallback.value;
      else if (options.length > 1) field.value = options[1].value;
    }
  } else {
    let formattedValue = value;
    if (type === 'tel' || fieldType === 'phone') {
      formattedValue = formatPhoneForField(value, field);
    }
    // ふりがなフィールドにカタカナを入力する場合、ひらがなに変換
    if ((fieldType === 'name_kana' || fieldType === 'last_name_kana' || fieldType === 'first_name_kana' || fieldType === 'company_kana') && expectsHiragana(field)) {
      formattedValue = toHiragana(formattedValue);
    }
    setNativeValue(field, formattedValue);
  }
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
  field.dispatchEvent(new Event('blur', { bubbles: true }));
  field.style.transition = 'background-color 0.3s';
  field.style.backgroundColor = '#e8f5e9';
  setTimeout(() => { field.style.backgroundColor = ''; }, 1000);
}

// Test fill a single field
function testFillField(selector, value) {
  try {
    const field = document.querySelector(selector);
    if (field && isVisible(field)) {
      fillField(field, value, field.type);
      return true;
    }
  } catch (e) {
    console.error('Test fill failed:', e);
  }
  return false;
}

// Get profile value
// Parse Japanese address into components
function parseAddress(fullAddress) {
  if (!fullAddress) {
    return { prefecture: '', city: '', street: '', building: '' };
  }

  // Japanese prefectures
  const prefectures = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
    '岐阜県', '静岡県', '愛知県', '三重県',
    '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
    '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県',
    '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
  ];

  let prefecture = '';
  let remainder = fullAddress;

  // Extract prefecture
  for (const pref of prefectures) {
    if (fullAddress.startsWith(pref)) {
      prefecture = pref;
      remainder = fullAddress.substring(pref.length);
      break;
    }
  }

  // If prefecture not found at start, try to infer from city name
  if (!prefecture) {
    const cityToPrefecture = {
      '札幌市': '北海道', '函館市': '北海道', '小樽市': '北海道', '旭川市': '北海道',
      '青森市': '青森県', '八戸市': '青森県',
      '盛岡市': '岩手県',
      '仙台市': '宮城県',
      '秋田市': '秋田県',
      '山形市': '山形県',
      '福島市': '福島県', 'いわき市': '福島県',
      '水戸市': '茨城県',
      '宇都宮市': '栃木県',
      '前橋市': '群馬県',
      'さいたま市': '埼玉県', '川越市': '埼玉県',
      '千葉市': '千葉県', '船橋市': '千葉県',
      '横浜市': '神奈川県', '川崎市': '神奈川県', '相模原市': '神奈川県',
      '新潟市': '新潟県',
      '富山市': '富山県',
      '金沢市': '石川県',
      '福井市': '福井県',
      '甲府市': '山梨県',
      '長野市': '長野県', '松本市': '長野県',
      '岐阜市': '岐阜県',
      '静岡市': '静岡県', '浜松市': '静岡県',
      '名古屋市': '愛知県', '豊田市': '愛知県',
      '津市': '三重県',
      '大津市': '滋賀県',
      '京都市': '京都府',
      '大阪市': '大阪府', '堺市': '大阪府',
      '神戸市': '兵庫県', '姫路市': '兵庫県',
      '奈良市': '奈良県',
      '和歌山市': '和歌山県',
      '鳥取市': '鳥取県',
      '松江市': '島根県',
      '岡山市': '岡山県', '倉敷市': '岡山県',
      '広島市': '広島県', '福山市': '広島県',
      '山口市': '山口県', '下関市': '山口県',
      '徳島市': '徳島県',
      '高松市': '香川県',
      '松山市': '愛媛県',
      '高知市': '高知県',
      '北九州市': '福岡県', '福岡市': '福岡県',
      '佐賀市': '佐賀県',
      '長崎市': '長崎県',
      '熊本市': '熊本県',
      '大分市': '大分県',
      '宮崎市': '宮崎県',
      '鹿児島市': '鹿児島県',
      '那覇市': '沖縄県'
    };

    for (const [cityName, prefName] of Object.entries(cityToPrefecture)) {
      if (fullAddress.includes(cityName)) {
        prefecture = prefName;
        break;
      }
    }
  }

  // Parse remainder for city, street, building
  // Pattern: 市区町村 + 町名番地 + 建物
  let city = '';
  let street = '';
  let building = '';

  // Match city/ward/town/village
  const cityMatch = remainder.match(/^([^0-9]+?[市区町村])/);
  if (cityMatch) {
    city = cityMatch[1];
    remainder = remainder.substring(city.length);
  }

  // Check for building markers
  const buildingMarkers = ['マンション', 'ビル', 'ハイツ', 'アパート', 'コーポ', '棟', '号室', '階'];
  let buildingIndex = -1;

  for (const marker of buildingMarkers) {
    const index = remainder.indexOf(marker);
    if (index !== -1 && (buildingIndex === -1 || index < buildingIndex)) {
      buildingIndex = index;
    }
  }

  // Also check for pattern like "〇〇101号室" or spaces before building name
  const buildingPattern = remainder.match(/([0-9０-９]+[号室階].*|　.+|  .+)$/);
  if (buildingPattern && (buildingIndex === -1 || buildingPattern.index < buildingIndex)) {
    buildingIndex = buildingPattern.index;
  }

  if (buildingIndex !== -1) {
    street = remainder.substring(0, buildingIndex).trim();
    building = remainder.substring(buildingIndex).trim();
  } else {
    street = remainder.trim();
  }

  return {
    prefecture,
    city,
    street,
    building
  };
}

function getProfileValue(profile, key) {
  // Handle split name fields (姓/名)
  if (key === 'name1' || key === 'name2' || key === 'name_sei' || key === 'name_mei' || key === 'last_name' || key === 'first_name') {
    const isSei = (key === 'name1' || key === 'name_sei' || key === 'last_name');
    // 直接入力された姓/名を優先
    if (isSei && profile.last_name) return profile.last_name;
    if (!isSei && profile.first_name) return profile.first_name;
    const fullName = profile.name || '';
    // スペース区切り
    const spaceParts = fullName.split(/[\s　]+/).filter(p => p.length > 0);
    if (spaceParts.length >= 2) return isSei ? spaceParts[0] : spaceParts.slice(1).join('');
    // 漢字→ひらがな/カタカナ境界で分割（例: 松本まみ → 松本 / まみ）
    const kanjiKanaBoundary = fullName.match(/^([\u4e00-\u9fff\u3400-\u4dbf]+)([\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff].*)$/);
    if (kanjiKanaBoundary) {
      return isSei ? kanjiKanaBoundary[1] : kanjiKanaBoundary[2];
    }
    // ひらがな→漢字境界
    const kanaKanjiBoundary = fullName.match(/^([\u3040-\u309f\u30a0-\u30ff]+)([\u4e00-\u9fff].*)$/);
    if (kanaKanjiBoundary) {
      return isSei ? kanaKanjiBoundary[1] : kanaKanjiBoundary[2];
    }
    // 分割できない場合: 姓=フル、名=空
    return isSei ? fullName : '';
  }

  // Handle split name_kana fields (セイ/メイ)
  if (key === 'name_kana1' || key === 'name_kana2' || key === 'name_sei_kana' || key === 'name_mei_kana' || key === 'last_name_kana' || key === 'first_name_kana') {
    const isSei = (key === 'name_kana1' || key === 'name_sei_kana' || key === 'last_name_kana');
    // 直接入力されたカナ姓/名を優先
    if (isSei && profile.last_name_kana) return profile.last_name_kana;
    if (!isSei && profile.first_name_kana) return profile.first_name_kana;
    const fullKana = profile.name_kana || '';
    // スペース区切り
    const spaceParts = fullKana.split(/[\s　]+/).filter(p => p.length > 0);
    if (spaceParts.length >= 2) return isSei ? spaceParts[0] : spaceParts.slice(1).join('');
    // 漢字の姓の長さを参考にカナを分割
    const fullName = profile.name || '';
    const kanjiMatch = fullName.match(/^([\u4e00-\u9fff\u3400-\u4dbf]+)/);
    if (kanjiMatch && fullKana.length > kanjiMatch[1].length) {
      // 姓の漢字文字数×2がカナの姓の長さの目安（1漢字≒2カナ）
      // ただし実際のカナ長で切る（マツモト=4, マミ=2 など）
      // 姓漢字数と名から推定: 姓漢字数を使ってカナを前後に分割
      const seiLen = kanjiMatch[1].length;
      // カナ長を比率で分割: 姓カナ = 全カナ × (姓漢字数 / 全漢字数)
      const totalKanjiMatch = fullName.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
      const totalKanji = totalKanjiMatch ? totalKanjiMatch.length : fullName.length;
      const splitPos = Math.round(fullKana.length * seiLen / Math.max(totalKanji, 1));
      const clampedPos = Math.max(1, Math.min(splitPos, fullKana.length - 1));
      return isSei ? fullKana.slice(0, clampedPos) : fullKana.slice(clampedPos);
    }
    return isSei ? fullKana : '';
  }

  // Handle address fields with smart splitting
  if (key === 'address' || key === 'address1' || key === 'address2' ||
      key === 'prefecture' || key === 'city' || key === 'street' || key === 'building') {

    const fullAddress = profile.address || '';

    // If the specific field is directly available in profile, use it
    if (profile[key]) {
      return profile[key];
    }

    // Parse full address into components
    const addressParts = parseAddress(fullAddress);

    if (key === 'address') {
      // Full address
      return fullAddress;
    } else if (key === 'address1') {
      // 住所1 = 都道府県 + 市区町村 + 町名・番地
      return `${addressParts.prefecture}${addressParts.city}${addressParts.street}`;
    } else if (key === 'address2') {
      // 住所2 = 建物名
      return addressParts.building;
    } else if (key === 'prefecture') {
      return addressParts.prefecture;
    } else if (key === 'city') {
      return addressParts.city;
    } else if (key === 'street') {
      return addressParts.street;
    } else if (key === 'building') {
      return addressParts.building;
    }
  }

  // Handle split zipcode fields
  if (key === 'zipcode1' || key === 'zipcode2') {
    const zipcode = profile.zipcode || '';
    // Remove all non-digit characters
    const digits = zipcode.replace(/[^0-9]/g, '');

    if (digits.length >= 7) {
      // Standard Japanese zipcode: 7 digits -> 3 + 4
      return key === 'zipcode1' ? digits.substring(0, 3) : digits.substring(3, 7);
    } else if (digits.length >= 3 && key === 'zipcode1') {
      return digits.substring(0, 3);
    } else if (digits.length > 3 && key === 'zipcode2') {
      return digits.substring(3);
    }
    return '';
  }

  // Handle split phone fields
  if (key === 'phone1' || key === 'phone2' || key === 'phone3') {
    const phone = profile.phone || '';
    // Remove all non-digit characters
    const digits = phone.replace(/[^0-9]/g, '');

    if (digits.length >= 10) {
      // Japanese phone format: 10-11 digits -> 3 + 4 + 3-4
      // Mobile: 090-1234-5678 (11 digits) -> 3 + 4 + 4
      // Landline: 03-1234-5678 (10 digits) -> 2-3 + 4 + 4 or 3 + 4 + 3

      if (digits.length === 11) {
        // 11 digits: 3 + 4 + 4 (mobile format)
        if (key === 'phone1') return digits.substring(0, 3);
        if (key === 'phone2') return digits.substring(3, 7);
        if (key === 'phone3') return digits.substring(7, 11);
      } else if (digits.length === 10) {
        // 10 digits: Try to parse intelligently
        // If starts with 0X0, 0X, likely 3 + 4 + 3
        // Otherwise, 2 + 4 + 4 or 3 + 4 + 3
        if (digits.startsWith('0')) {
          const secondChar = digits.charAt(1);

          // Common mobile prefixes: 070, 080, 090
          if (secondChar === '7' || secondChar === '8' || secondChar === '9') {
            // Format: 3 + 4 + 3 (but only 10 digits, unusual for mobile)
            if (key === 'phone1') return digits.substring(0, 3);
            if (key === 'phone2') return digits.substring(3, 7);
            if (key === 'phone3') return digits.substring(7, 10);
          } else {
            // Landline format: could be 2 + 4 + 4 or 3 + 4 + 3
            // Default to 3 + 4 + 3 for consistency
            if (key === 'phone1') return digits.substring(0, 3);
            if (key === 'phone2') return digits.substring(3, 7);
            if (key === 'phone3') return digits.substring(7, 10);
          }
        }
      }
    }
    return '';
  }

  // Handle split email confirmation fields (e.g., user@domain.com -> user + domain.com)
  if (key === 'email_confirm_local' || key === 'email_confirm_domain') {
    const email = profile.email || '';
    const atIndex = email.indexOf('@');
    if (atIndex > 0) {
      return key === 'email_confirm_local' ? email.substring(0, atIndex) : email.substring(atIndex + 1);
    }
    return '';
  }

  const mapping = {
    company: profile.company,
    company_kana: profile.company_kana || '',
    name: profile.name,
    name_kana: profile.name_kana || '',
    email: profile.email,
    email_confirm: profile.email,  // 確認用メールアドレス
    phone: profile.phone,
    subject: profile.subject || '',
    message: profile.message,
    department: profile.department || '',
    position: profile.position || '',
    zipcode: profile.zipcode || '',
    address: profile.address || '',
    address1: '',  // Handled by parseAddress
    address2: '',  // Handled by parseAddress
    prefecture: profile.prefecture || '',
    city: profile.city || '',
    street: profile.street || '',
    building: profile.building || '',
    website: profile.website || '',
    consent: true,
    privacy: true,  // プライバシーポリシー同意チェックボックス
    inquiry_type: true,  // お問い合わせ種別チェックボックス
    inquiry_category: true,  // お問い合わせカテゴリチェックボックス
    req_method: true,  // 回答方法ラジオボタン
    product_name: 'お問い合わせ',  // 商品名デフォルト値
    category: ''
  };

  return mapping[key] || '';
}

// Get CSS selector (simple version)
function getSelector(element) {
  if (element.id) return `#${element.id}`;
  if (element.name) return `[name="${element.name}"]`;
  return element.tagName.toLowerCase();
}
