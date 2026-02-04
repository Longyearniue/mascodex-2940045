// Field detection patterns and scoring heuristics
const FIELD_PATTERNS = {
  company: {
    keywords: ['company', '会社', '企業', '法人', '団体', 'corporation', 'organization', '会社名', '企業名'],
    autocomplete: ['organization'],
    weight: { autocomplete: 50, label: 30, name: 20, placeholder: 15, nearby: 10 }
  },
  name: {
    keywords: ['name', '名前', '氏名', 'お名前', 'full name', 'your name', '担当者'],
    autocomplete: ['name', 'given-name', 'family-name'],
    weight: { autocomplete: 50, label: 30, name: 20, placeholder: 15, nearby: 10 }
  },
  name_kana: {
    keywords: ['kana', 'かな', 'カナ', 'フリガナ', 'ふりがな', 'よみがな', 'ヨミガナ'],
    autocomplete: [],
    weight: { autocomplete: 50, label: 40, name: 25, placeholder: 20, nearby: 10 }
  },
  email: {
    keywords: ['email', 'mail', 'メール', 'eメール', 'e-mail', 'メールアドレス'],
    autocomplete: ['email'],
    weight: { autocomplete: 50, label: 30, name: 20, placeholder: 15, nearby: 10 }
  },
  phone: {
    keywords: ['phone', 'tel', '電話', '電話番号', 'telephone', '携帯', 'mobile'],
    autocomplete: ['tel', 'tel-national'],
    weight: { autocomplete: 50, label: 30, name: 20, placeholder: 15, nearby: 10 }
  },
  subject: {
    keywords: ['subject', '件名', 'タイトル', 'title', '用件', '題名'],
    autocomplete: [],
    weight: { autocomplete: 50, label: 35, name: 25, placeholder: 20, nearby: 10 }
  },
  message: {
    keywords: ['message', 'content', 'detail', '内容', 'メッセージ', '本文', 'お問い合わせ内容', '詳細', 'inquiry', 'comment', 'コメント'],
    autocomplete: [],
    weight: { autocomplete: 50, label: 35, name: 25, placeholder: 20, nearby: 10 }
  }
};

let trainingModeActive = false;
let trainingClickHandler = null;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'autoFill') {
    const results = autoFillForm(message.profile);
    sendResponse({ success: true, results });
  } else if (message.action === 'toggleTrainingMode') {
    toggleTrainingMode(message.enabled);
    sendResponse({ success: true });
  }
  return true; // Keep message channel open for async response
});

// Auto-fill form
async function autoFillForm(profile) {
  const domain = window.location.hostname;

  // Get stored mappings for this domain
  const data = await chrome.storage.sync.get(['fieldMappings']);
  const mappings = (data.fieldMappings && data.fieldMappings[domain]) || {};

  const results = [];
  const filledFields = new Set();

  // First, try stored mappings
  for (const [fieldType, selector] of Object.entries(mappings)) {
    try {
      const field = document.querySelector(selector);
      if (field && !filledFields.has(field)) {
        const value = getProfileValue(profile, fieldType);
        if (value) {
          fillField(field, value);
          results.push({
            fieldType,
            selector,
            confidence: 100,
            method: 'stored'
          });
          filledFields.add(field);
        }
      }
    } catch (e) {
      console.log('Stored selector failed:', selector, e);
    }
  }

  // Then, auto-detect remaining fields
  const formFields = getAllFormFields();

  for (const field of formFields) {
    if (filledFields.has(field)) continue;

    const detection = detectFieldType(field);
    if (detection && detection.confidence >= 30) {
      const value = getProfileValue(profile, detection.type);
      if (value) {
        fillField(field, value);
        results.push({
          fieldType: detection.type,
          selector: getSelector(field),
          confidence: detection.confidence,
          method: 'auto'
        });
        filledFields.add(field);
      }
    }
  }

  return results;
}

// Get all form fields
function getAllFormFields() {
  const fields = [];

  // Input fields
  const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input:not([type])');
  fields.push(...inputs);

  // Textareas
  const textareas = document.querySelectorAll('textarea');
  fields.push(...textareas);

  // Filter out hidden fields and buttons
  return Array.from(fields).filter(field => {
    const style = window.getComputedStyle(field);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

// Detect field type using scoring heuristics
function detectFieldType(field) {
  let bestMatch = null;
  let bestScore = 0;

  for (const [fieldType, pattern] of Object.entries(FIELD_PATTERNS)) {
    const score = calculateFieldScore(field, pattern);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = fieldType;
    }
  }

  if (bestScore > 0) {
    return {
      type: bestMatch,
      confidence: Math.min(100, bestScore)
    };
  }

  return null;
}

// Calculate score for a field
function calculateFieldScore(field, pattern) {
  let score = 0;

  // Check autocomplete attribute
  const autocomplete = field.getAttribute('autocomplete');
  if (autocomplete && pattern.autocomplete.includes(autocomplete)) {
    score += pattern.weight.autocomplete;
  }

  // Check label text
  const label = getFieldLabel(field);
  if (label && matchesKeywords(label, pattern.keywords)) {
    score += pattern.weight.label;
  }

  // Check aria-label
  const ariaLabel = field.getAttribute('aria-label');
  if (ariaLabel && matchesKeywords(ariaLabel, pattern.keywords)) {
    score += pattern.weight.label;
  }

  // Check name, id, class
  const nameIdClass = [
    field.getAttribute('name'),
    field.getAttribute('id'),
    field.getAttribute('class')
  ].filter(Boolean).join(' ');

  if (matchesKeywords(nameIdClass, pattern.keywords)) {
    score += pattern.weight.name;
  }

  // Check placeholder
  const placeholder = field.getAttribute('placeholder');
  if (placeholder && matchesKeywords(placeholder, pattern.keywords)) {
    score += pattern.weight.placeholder;
  }

  // Check nearby text (parent or siblings)
  const nearbyText = getNearbyText(field);
  if (nearbyText && matchesKeywords(nearbyText, pattern.keywords)) {
    score += pattern.weight.nearby;
  }

  // Special case: textarea is likely message field
  if (field.tagName === 'TEXTAREA' && pattern === FIELD_PATTERNS.message) {
    score += 20;
  }

  return score;
}

// Get label text for field
function getFieldLabel(field) {
  // Try <label> with for attribute
  if (field.id) {
    const label = document.querySelector(`label[for="${field.id}"]`);
    if (label) return label.textContent;
  }

  // Try parent <label>
  const parentLabel = field.closest('label');
  if (parentLabel) return parentLabel.textContent;

  return null;
}

// Get nearby text (within parent or siblings)
function getNearbyText(field) {
  const texts = [];

  // Check parent
  if (field.parentElement) {
    texts.push(field.parentElement.textContent);
  }

  // Check previous sibling
  if (field.previousElementSibling) {
    texts.push(field.previousElementSibling.textContent);
  }

  return texts.join(' ');
}

// Check if text matches any keywords
function matchesKeywords(text, keywords) {
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

// Get profile value by field type
function getProfileValue(profile, fieldType) {
  const mapping = {
    company: profile.company,
    name: profile.name,
    name_kana: '', // Not in profile, user can add if needed
    email: profile.email,
    phone: profile.phone,
    subject: '', // Could add default subject
    message: profile.message
  };

  return mapping[fieldType] || '';
}

// Fill a field with value
function fillField(field, value) {
  // Set value
  field.value = value;

  // Trigger events to notify the page
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

// Get CSS selector for element
function getSelector(element) {
  if (element.id) return `#${element.id}`;
  if (element.name) return `[name="${element.name}"]`;

  // Generate unique selector
  let path = [];
  let current = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.className) {
      const classes = current.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        selector += '.' + classes[0];
      }
    }

    path.unshift(selector);
    current = current.parentElement;

    if (path.length >= 3) break; // Limit depth
  }

  return path.join(' > ');
}

// Training Mode
function toggleTrainingMode(enabled) {
  trainingModeActive = enabled;

  if (enabled) {
    activateTrainingMode();
  } else {
    deactivateTrainingMode();
  }
}

function activateTrainingMode() {
  const fields = getAllFormFields();

  fields.forEach(field => {
    // Add visual indicator
    field.style.outline = '2px dashed #fbbc04';
    field.style.cursor = 'pointer';
  });

  // Add click handler
  trainingClickHandler = (e) => {
    if (e.target.matches('input, textarea')) {
      e.preventDefault();
      e.stopPropagation();
      showFieldTypeSelector(e.target);
    }
  };

  document.addEventListener('click', trainingClickHandler, true);
}

function deactivateTrainingMode() {
  const fields = getAllFormFields();

  fields.forEach(field => {
    field.style.outline = '';
    field.style.cursor = '';
  });

  if (trainingClickHandler) {
    document.removeEventListener('click', trainingClickHandler, true);
    trainingClickHandler = null;
  }

  // Remove any existing modal
  const modal = document.getElementById('cf-training-modal');
  if (modal) modal.remove();
}

function showFieldTypeSelector(field) {
  // Remove existing modal
  const existingModal = document.getElementById('cf-training-modal');
  if (existingModal) existingModal.remove();

  // Create modal
  const modal = document.createElement('div');
  modal.id = 'cf-training-modal';
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 999999;
    min-width: 300px;
  `;

  modal.innerHTML = `
    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">
      Select Field Type
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${Object.keys(FIELD_PATTERNS).map(type => `
        <button class="cf-field-type-btn" data-type="${type}" style="
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          text-align: left;
          font-size: 14px;
          transition: all 0.2s;
        ">
          ${type}
        </button>
      `).join('')}
    </div>
    <button id="cf-cancel-btn" style="
      width: 100%;
      padding: 10px;
      margin-top: 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      background: #f5f5f5;
      cursor: pointer;
      font-size: 14px;
    ">
      Cancel
    </button>
  `;

  document.body.appendChild(modal);

  // Add hover effect
  const buttons = modal.querySelectorAll('.cf-field-type-btn');
  buttons.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#e8f0fe';
      btn.style.borderColor = '#1a73e8';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'white';
      btn.style.borderColor = '#ddd';
    });
    btn.addEventListener('click', () => {
      saveFieldMapping(field, btn.dataset.type);
      modal.remove();
    });
  });

  // Cancel button
  document.getElementById('cf-cancel-btn').addEventListener('click', () => {
    modal.remove();
  });

  // Click outside to close
  setTimeout(() => {
    document.addEventListener('click', function closeModal(e) {
      if (!modal.contains(e.target)) {
        modal.remove();
        document.removeEventListener('click', closeModal);
      }
    });
  }, 100);
}

async function saveFieldMapping(field, fieldType) {
  const domain = window.location.hostname;
  const selector = getSelector(field);

  // Get existing mappings
  const data = await chrome.storage.sync.get(['fieldMappings']);
  const mappings = data.fieldMappings || {};

  if (!mappings[domain]) {
    mappings[domain] = {};
  }

  mappings[domain][fieldType] = selector;

  // Save back
  await chrome.storage.sync.set({ fieldMappings: mappings });

  // Visual feedback
  field.style.outline = '2px solid #34a853';
  setTimeout(() => {
    field.style.outline = '2px dashed #fbbc04';
  }, 1000);

  // Notify popup
  chrome.runtime.sendMessage({
    action: 'trainingFieldSelected',
    fieldType,
    selector
  });

  console.log('Saved mapping:', domain, fieldType, selector);
}
