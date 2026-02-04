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

// Fetch sales letter from API
async function fetchSalesLetter(companyUrl) {
  try {
    console.log('📧 Fetching sales letter for:', companyUrl);
    const apiUrl = 'https://crawler-worker-teamb.taiichifox.workers.dev/sales-letter';
    console.log('🔗 API endpoint:', apiUrl);

    const requestBody = { company_url: companyUrl };
    console.log('📤 Request body:', JSON.stringify(requestBody));

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📥 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API error response:', errorText);
      return null;
    }

    const data = await response.json();
    console.log('📊 Response data keys:', Object.keys(data));

    if (data.ok && data.sales_letter) {
      console.log('✅ Sales letter fetched successfully');
      console.log('📏 Sales letter length:', data.sales_letter.length);
      return data.sales_letter;
    } else {
      console.error('❌ Sales letter API returned error:', data.error || 'Unknown error');
      console.error('Full response:', data);
      return null;
    }
  } catch (error) {
    console.error('❌ Exception while fetching sales letter:', error);
    console.error('Error details:', error.message, error.stack);
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
// AUTO-FILL ON PAGE LOAD
// =============================================================================

async function checkAndAutoFill() {
  // Skip third-party iframes
  if (shouldSkip) {
    return;
  }

  try {
    console.log(`🔍 [DEBUG] ${frameContext} checkAndAutoFill started`);

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

    // Execute auto-fill if all checks pass
    if (isKnownSite) {
      console.log('🚀 Auto-fill enabled for this site. Starting auto-fill...');
      setTimeout(async () => {
        console.log('⏰ Auto-fill timer triggered, calling autoFillForm...');
        const result = await autoFillForm(profile);
        console.log('📊 Auto-fill result:', result);
        if (result.success && result.results.length > 0) {
          console.log(`✅ Auto-filled ${result.results.length} field(s) automatically`);
        } else {
          console.log('❌ Auto-fill returned no results or failed');
          if (result.debug) {
            console.log('🔍 [DEBUG] Debug info:', result.debug);
          }
        }
      }, 2000); // 2 second delay for DOM readiness and API calls
    } else {
      console.log('ℹ️ Site not in pre-configured list. Auto-detection will be used when you click "Auto Fill" button.');
    }
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

    // Fetch sales letter if message field exists in mapping
    let salesLetter = null;
    if (siteMapping.message) {
      // Use company_url from mapping, or fallback to origin
      const companyUrl = siteMapping.company_url || window.location.origin;
      console.log('🌐 Company URL for API:', companyUrl);
      console.log('⏳ Fetching sales letter from API...');
      salesLetter = await fetchSalesLetter(companyUrl);
      if (salesLetter) {
        console.log('✅ Sales letter received, length:', salesLetter.length);
        console.log('📝 First 100 chars:', salesLetter.substring(0, 100));
      } else {
        console.log('❌ Failed to get sales letter from API');
      }
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
  // Priority 2: Pattern mapping (from cached detection)
  // Priority 3: Learned mappings (from chrome.storage)

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

      if (element && isVisible(element)) {
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
  'www.robakashitsukasa.co.jp/contact': {
    company_url: 'https://www.robakashitsukasa.co.jp/',
    name1: { selector: 'input[name="contact[name][name01]"]', confidence: 100 },
    name2: { selector: 'input[name="contact[name][name02]"]', confidence: 100 },
    name_kana1: { selector: 'input[name="contact[kana][kana01]"]', confidence: 100 },
    name_kana2: { selector: 'input[name="contact[kana][kana02]"]', confidence: 100 },
    zipcode: { selector: 'input[name="contact[postal_code]"]', confidence: 100 },
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
  }
};

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
    'your-tel': { field: 'phone', confidence: 85 },
    'your-phone': { field: 'phone', confidence: 85 },
    'your-company': { field: 'company', confidence: 85 },
    'your-zipcode': { field: 'zipcode', confidence: 85 },
    'your-address': { field: 'address', confidence: 85 }
  };

  fields.forEach(field => {
    const name = field.getAttribute('name') || '';
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
    '本文': { field: 'message', confidence: 80 },
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
  // Handle split name fields (name1=姓, name2=名)
  if (key === 'name1' || key === 'name2') {
    const fullName = profile.name || '';
    const parts = fullName.split(/\s+/);
    if (parts.length >= 2) {
      return key === 'name1' ? parts[0] : parts[1];
    }
    return key === 'name1' ? fullName : '';
  }

  // Handle split name_kana fields
  if (key === 'name_kana1' || key === 'name_kana2') {
    const fullKana = profile.name_kana || '';
    const parts = fullKana.split(/\s+/);
    if (parts.length >= 2) {
      return key === 'name_kana1' ? parts[0] : parts[1];
    }
    return key === 'name_kana1' ? fullKana : '';
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
