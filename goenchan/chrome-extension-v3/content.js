// =============================================================================
// AUTO-FILL ON PAGE LOAD
// =============================================================================

// Check if auto-fill should run on page load
async function checkAndAutoFill() {
  try {
    // Get settings from storage
    const { autoFillEnabled = true, profile } = await chrome.storage.sync.get(['autoFillEnabled', 'profile']);

    // If auto-fill is disabled, do nothing
    if (!autoFillEnabled) {
      console.log('⏸️ Auto-fill is disabled in settings');
      return;
    }

    // Check if profile exists
    if (!profile || Object.keys(profile).length === 0) {
      console.log('⚠️ No profile found. Please configure your profile first.');
      return;
    }

    // Check if current URL matches any pre-configured site
    const currentUrl = window.location.href;
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    const urlKey = hostname + pathname;

    // Check if URL matches SITE_MAPPINGS (defined below)
    let isKnownSite = false;
    for (const key of Object.keys(SITE_MAPPINGS)) {
      if (urlKey.includes(key)) {
        isKnownSite = true;
        break;
      }
    }

    if (isKnownSite) {
      console.log('🚀 Auto-fill enabled for this site. Starting auto-fill...');
      // Wait a bit for form to fully load
      setTimeout(async () => {
        const result = await autoFillForm(profile);
        if (result.success && result.results.length > 0) {
          console.log(`✅ Auto-filled ${result.results.length} field(s) automatically`);
        }
      }, 1000); // 1 second delay to ensure form is loaded
    } else {
      console.log('ℹ️ This site is not in the pre-configured list. Use the extension popup to fill manually.');
    }
  } catch (error) {
    console.error('❌ Auto-fill error:', error);
  }
}

// Run auto-fill check when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAndAutoFill);
} else {
  // DOM already loaded
  checkAndAutoFill();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'autoFill') {
    autoFillForm(message.profile).then(result => {
      sendResponse(result);
    });
    return true; // Keep channel open for async
  } else if (message.action === 'inspectForm') {
    const formData = inspectForm();
    sendResponse({ success: true, formData });
  } else if (message.action === 'testFillField') {
    testFillField(message.selector, message.value);
    sendResponse({ success: true });
  }
  return true;
});

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
// AUTO-FILL
// =============================================================================

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

  // Check for pre-configured site mappings FIRST
  let siteMapping = null;
  let siteMappingKey = null;

  for (const [key, mapping] of Object.entries(SITE_MAPPINGS)) {
    if (url.includes(key)) {
      siteMapping = mapping;
      siteMappingKey = key;
      debugInfo.siteMapping = key;
      break;
    }
  }

  // Use pre-configured site mapping if found
  if (siteMapping) {
    console.log('🎯 Using pre-configured mapping for:', siteMappingKey);

    for (const [key, fieldConfig] of Object.entries(siteMapping)) {
      const value = getProfileValue(profile, key);
      if (!value) continue;

      debugInfo.fieldsProcessed++;

      try {
        const element = document.querySelector(fieldConfig.selector);
        if (element && isVisible(element)) {
          fillField(element, value, element.type);
          filledFields.add(element);
          debugInfo.fieldsFilled++;

          const resultInfo = {
            fieldType: key,
            selector: fieldConfig.selector,
            confidence: fieldConfig.confidence,
            method: 'site-preconfigured',
            label: getFieldLabel(element) || key
          };

          results.push(resultInfo);
          debugInfo.detailedResults.push({
            ...resultInfo,
            value: value.substring(0, 20) + (value.length > 20 ? '...' : ''),
            elementFound: true
          });

          console.log(`✅ Filled ${key} using ${fieldConfig.selector}`);

          // Special handling for email confirmation fields (e.g., mail2)
          if (key === 'email' && siteMappingKey.includes('hokudenkogyo')) {
            const confirmElement = document.querySelector('input[name="mail2"]');
            if (confirmElement && isVisible(confirmElement)) {
              fillField(confirmElement, value, confirmElement.type);
              filledFields.add(confirmElement);
              debugInfo.fieldsFilled++;
              console.log(`✅ Filled email confirmation using input[name="mail2"]`);
            }
          }
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

    // Return early if site mapping handled all fields
    if (results.length > 0) {
      console.log(`📊 Site mapping filled ${results.length} fields`);
      return {
        success: true,
        results,
        debug: debugInfo
      };
    }
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

  // Use stored mapping if found
  if (bestMapping) {
    for (const [key, fieldInfo] of Object.entries(bestMapping.fields)) {
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

      // Fallback: try to find by fingerprint
      if (!element) {
        element = findElementByFingerprint(fieldInfo.fingerprint, fieldInfo.type);
        if (element) {
          debugInfo.errors.push(`Found ${key} by fingerprint fallback`);
          // Update selector for future use
          const newSelector = generateSelector(element, document.body, 0);
          bestMapping.fields[key].selector = newSelector;
          await chrome.storage.sync.set({ formMappings: allMappings });
        }
      }

      if (element && isVisible(element)) {
        fillField(element, value, fieldInfo.type);
        filledFields.add(element);
        debugInfo.fieldsFilled++;

        results.push({
          fieldType: key,
          selector: fieldInfo.selector,
          confidence: 100,
          method: 'stored',
          label: fieldInfo.labelText
        });
      } else {
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
    if (detection && detection.confidence >= 30) {
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

  console.log(`📊 Total filled: ${debugInfo.fieldsFilled}/${debugInfo.fieldsProcessed} fields`);

  return {
    success: true,
    results,
    debug: debugInfo
  };
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
  'www.hokudenkogyo.co.jp/contact.html': {
    company: { selector: 'input[name="bu_01"]', confidence: 100 },
    department: { selector: 'input[name="bu_02"]', confidence: 100 },
    name: { selector: 'input[name="name"]', confidence: 100 },
    name_kana: { selector: 'input[name="kana"]', confidence: 100 },
    email: { selector: 'input[name="mail"]', confidence: 100 },
    phone: { selector: 'input[name="tel"]', confidence: 100 },
    message: { selector: 'textarea[name="naiyo"]', confidence: 100 }
  },
  'lomilomisalon-oluolu.com/contact/': {
    name: { selector: 'input[name*="your-name"]', confidence: 100 },
    email: { selector: 'input[name*="your-email"]', confidence: 100 },
    phone: { selector: 'input[name*="tel"]', confidence: 100 },
    message: { selector: 'textarea[name*="your-message"]', confidence: 100 }
  },
  'www.medience.co.jp/contact/index.php': {
    company: { selector: 'input[name="勤務先名"]', confidence: 100 },
    name: { selector: 'input[name="お名前"]', confidence: 100 },
    name_kana: { selector: 'input[name="フリガナ"]', confidence: 100 },
    email: { selector: 'input[name="E-mail"]', confidence: 100 },
    phone: { selector: 'input[name="TEL"]', confidence: 100 },
    department: { selector: 'input[name="所属部署名"]', confidence: 100 },
    message: { selector: 'textarea[name="お問い合わせ事項／ご意見"]', confidence: 100 }
  }
};

// Detect field type (enhanced with better Japanese keyword matching)
function detectFieldType(field) {
  const patterns = {
    company: {
      keywords: ['company', '会社', '企業', '法人', '団体', 'corporation', '会社名', '企業名', '貴社名', '御社名', 'organization', '勤務先', '勤務先名'],
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
      keywords: ['phone', 'tel', '電話', '電話番号', 'telephone', 'your-tel', 'tel番号', 'telnumber', '連絡先電話番号', '携帯電話'],
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
    }
  };

  let bestMatch = null;
  let bestScore = 0;
  let bestLabel = '';

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
      else if (label) {
        if (label.match(/前|1|first/i)) {
          bestMatch = 'zipcode1';
        } else if (label.match(/後|2|second|last/i)) {
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
      else if (label) {
        if (label.match(/前|1|first/i)) {
          bestMatch = 'phone1';
        } else if (label.match(/中|2|middle|second/i)) {
          bestMatch = 'phone2';
        } else if (label.match(/後|3|last|third/i)) {
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

// Match keywords
function matchesKeywords(text, keywords) {
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

// Fill field with value
function fillField(field, value, type) {
  if (type === 'checkbox' || type === 'radio') {
    field.checked = !!value;
  } else if (type === 'select' || field.tagName === 'SELECT') {
    // For select, try to find matching option
    const options = Array.from(field.options);
    const matchingOption = options.find(opt =>
      opt.value === value || opt.text === value
    );
    if (matchingOption) {
      field.value = matchingOption.value;
    }
  } else {
    field.value = value;
  }

  // Trigger events
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
  field.dispatchEvent(new Event('blur', { bubbles: true }));

  // Visual feedback
  field.style.transition = 'background-color 0.3s';
  field.style.backgroundColor = '#e8f5e9';
  setTimeout(() => {
    field.style.backgroundColor = '';
  }, 1000);
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
function getProfileValue(profile, key) {
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
          const thirdChar = digits.charAt(2);

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

  const mapping = {
    company: profile.company,
    name: profile.name,
    name_kana: profile.name_kana || '',
    email: profile.email,
    phone: profile.phone,
    subject: profile.subject || '',
    message: profile.message,
    department: profile.department || '',
    position: profile.position || '',
    zipcode: profile.zipcode || '',
    address: profile.address || '',
    prefecture: profile.prefecture || '',
    city: profile.city || '',
    building: profile.building || '',
    website: profile.website || '',
    consent: true,
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
