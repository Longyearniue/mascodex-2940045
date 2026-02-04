// Global state
let currentFormData = null;
let currentUrl = null;
let fieldMappings = {};
let debugData = null;
window.crawlMappings = null;

// Helper function to send message to all frames (including iframes)
async function sendMessageToAllFrames(tabId, message) {
  try {
    // Try to get all frames using webNavigation API
    const frames = await chrome.webNavigation.getAllFrames({ tabId: tabId });

    const responses = [];
    for (const frame of frames) {
      try {
        const response = await chrome.tabs.sendMessage(tabId, message, { frameId: frame.frameId });
        if (response) {
          responses.push(response);
        }
      } catch (error) {
        // Frame might not have content script loaded, ignore
        console.log(`Frame ${frame.frameId} did not respond:`, error.message);
      }
    }

    // Return the first successful response, or combine all responses
    return responses.length > 0 ? responses[0] : null;
  } catch (error) {
    // Fallback to sending to main frame only
    console.log('Could not query frames, sending to main frame only:', error.message);
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        resolve(response);
      });
    });
  }
}

// Load profile and initialize on popup open
document.addEventListener('DOMContentLoaded', async () => {
  loadProfile();
  await loadCurrentUrl();
  setupCollapsibles();
});

// Setup collapsible sections
function setupCollapsibles() {
  document.getElementById('profileToggle').addEventListener('click', () => {
    const content = document.getElementById('profileContent');
    const toggle = document.getElementById('profileToggle');
    content.classList.toggle('show');
    toggle.textContent = content.classList.contains('show') ? '▼ Profile Settings' : '▶ Profile Settings';
  });

  document.getElementById('bulkCrawlerToggle').addEventListener('click', () => {
    const content = document.getElementById('bulkCrawlerContent');
    const toggle = document.getElementById('bulkCrawlerToggle');
    content.classList.toggle('show');
    toggle.textContent = content.classList.contains('show') ? '▼ Bulk Site Crawler' : '▶ Bulk Site Crawler';
  });
}

// Load current tab URL
async function loadCurrentUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentUrl = tab.url;
}

// Load profile data
async function loadProfile() {
  const data = await chrome.storage.sync.get(['profile', 'autoFillEnabled']);
  if (data.profile) {
    document.getElementById('company').value = data.profile.company || '';
    document.getElementById('name').value = data.profile.name || '';
    document.getElementById('name_kana').value = data.profile.name_kana || '';
    document.getElementById('email').value = data.profile.email || '';
    document.getElementById('phone').value = data.profile.phone || '';
    document.getElementById('zipcode').value = data.profile.zipcode || '';
    document.getElementById('address').value = data.profile.address || '';
    document.getElementById('department').value = data.profile.department || '';
    document.getElementById('subject').value = data.profile.subject || '';
    document.getElementById('message').value = data.profile.message || '';
  }

  // Load auto-fill setting (default: enabled)
  const autoFillEnabled = data.autoFillEnabled !== undefined ? data.autoFillEnabled : true;
  document.getElementById('autoFillEnabled').checked = autoFillEnabled;
}

// Save profile
document.getElementById('saveProfile').addEventListener('click', async () => {
  const profile = {
    company: document.getElementById('company').value,
    name: document.getElementById('name').value,
    name_kana: document.getElementById('name_kana').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    zipcode: document.getElementById('zipcode').value,
    address: document.getElementById('address').value,
    department: document.getElementById('department').value,
    subject: document.getElementById('subject').value,
    message: document.getElementById('message').value
  };

  // Get auto-fill setting
  const autoFillEnabled = document.getElementById('autoFillEnabled').checked;

  await chrome.storage.sync.set({ profile, autoFillEnabled });
  showStatus('✅ プロフィールを保存しました！', 'success');
});

// Auto Fill button
document.getElementById('autoFill').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Get profile
  const data = await chrome.storage.sync.get(['profile']);
  const profile = data.profile || {};

  // Send message to all frames (including iframes)
  const response = await sendMessageToAllFrames(tab.id, {
    action: 'autoFill',
    profile: profile
  });

  if (!response) {
    showStatus('Error: Could not connect to page. Please refresh the page.', 'error');
    return;
  }

  if (response && response.success) {
    displayResults(response.results);
    debugData = response.debug;
    showStatus(`Filled ${response.results.length} field(s)!`, 'success');

    // Show debug section if available
    if (debugData) {
      document.getElementById('debugSection').classList.add('show');
      document.getElementById('debugOutput').textContent = JSON.stringify(debugData, null, 2);
    }
  } else {
    showStatus('No form fields detected on this page.', 'info');
  }
});

// Form Inspector button
document.getElementById('inspectorMode').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  showStatus('Inspecting form...', 'info');

  const response = await sendMessageToAllFrames(tab.id, {
    action: 'inspectForm'
  });

  if (!response) {
    showStatus('Error: Could not connect to page. Please refresh the page.', 'error');
    return;
  }

  if (response && response.success) {
    currentFormData = response.formData;
    displayInspectorResults(response.formData);
    showStatus(`Found ${response.formData.fields.length} fields`, 'success');
  } else {
    showStatus('No form found on this page.', 'error');
  }
});

// Display inspector results
function displayInspectorResults(formData) {
  const section = document.getElementById('inspectorSection');
  const fieldList = document.getElementById('fieldList');

  // Update form info
  document.getElementById('formUrl').textContent = formData.url;
  document.getElementById('formTitle').textContent = formData.title || '(no title)';
  document.getElementById('formFieldCount').textContent = formData.fields.length;

  // Clear and populate field list
  fieldList.innerHTML = '';

  if (formData.fields.length === 0) {
    fieldList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No form fields detected</div>';
    section.classList.add('show');
    return;
  }

  formData.fields.forEach((field, index) => {
    const fieldItem = document.createElement('div');
    fieldItem.className = 'field-item';
    fieldItem.dataset.index = index;

    const labelText = field.labelCandidates[0] || field.name || field.id || '(no label)';
    const typeText = field.type === 'select' ? `select (${field.options?.length || 0} options)` : field.type;

    fieldItem.innerHTML = `
      <div class="field-header">
        <div class="field-label">${escapeHtml(labelText)}</div>
        <span class="field-type">${typeText}</span>
        ${field.required ? '<span class="field-required">*</span>' : ''}
      </div>
      <div class="field-details">
        ${field.name ? `name: ${escapeHtml(field.name)}` : ''}
        ${field.id ? ` | id: ${escapeHtml(field.id)}` : ''}
      </div>
      <div class="field-mapping">
        <select class="key-selector" data-field-index="${index}">
          <option value="">(ignore)</option>
          ${getStandardKeyOptions().map(key => `<option value="${key}">${key}</option>`).join('')}
        </select>
        <button class="btn-secondary" onclick="testFillField(${index})">Test</button>
      </div>
    `;

    fieldList.appendChild(fieldItem);
  });

  section.classList.add('show');

  // Set up key selectors
  fieldList.querySelectorAll('.key-selector').forEach(select => {
    select.addEventListener('change', (e) => {
      const fieldIndex = parseInt(e.target.dataset.fieldIndex);
      fieldMappings[fieldIndex] = e.target.value;
    });
  });
}

// Get standard key options
function getStandardKeyOptions() {
  return [
    'company',
    'name',
    'name_kana',
    'email',
    'phone',
    'subject',
    'message',
    'department',
    'position',
    'zipcode',
    'address',
    'prefecture',
    'city',
    'building',
    'website',
    'consent',
    'category'
  ];
}

// Test fill a single field
window.testFillField = async function(fieldIndex) {
  if (!currentFormData) return;

  const field = currentFormData.fields[fieldIndex];
  const key = fieldMappings[fieldIndex];

  if (!key) {
    showStatus('Please select a key first', 'error');
    return;
  }

  // Get profile value
  const data = await chrome.storage.sync.get(['profile']);
  const profile = data.profile || {};
  const value = getProfileValue(profile, key);

  if (!value) {
    showStatus(`No value for key: ${key}`, 'error');
    return;
  }

  // Send test fill message
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const response = await sendMessageToAllFrames(tab.id, {
    action: 'testFillField',
    selector: field.selector,
    value: value
  });

  if (response && response.success) {
    showStatus(`Test filled: ${key} = ${value}`, 'success');
  } else {
    showStatus('Test fill failed', 'error');
  }
};

// Save mapping for this form
document.getElementById('saveMapping').addEventListener('click', async () => {
  if (!currentFormData || Object.keys(fieldMappings).length === 0) {
    showStatus('Please map at least one field', 'error');
    return;
  }

  const url = new URL(currentFormData.url);
  const useGeneralized = document.getElementById('useGeneralizedPattern').checked;

  // Create mapping
  const mapping = {
    fields: {},
    metadata: {
      lastUpdated: Date.now(),
      url: currentFormData.url,
      title: currentFormData.title,
      urlPattern: useGeneralized ? generalizePath(url.pathname) : url.pathname,
      fieldCount: Object.keys(fieldMappings).length
    }
  };

  // Build field mappings with fingerprints
  Object.entries(fieldMappings).forEach(([fieldIndex, key]) => {
    if (!key) return;
    const field = currentFormData.fields[parseInt(fieldIndex)];
    mapping.fields[key] = {
      selector: field.selector,
      fingerprint: field.fingerprint,
      labelText: field.labelCandidates[0] || '',
      type: field.type,
      required: field.required
    };
  });

  // Load existing mappings
  const data = await chrome.storage.sync.get(['formMappings']);
  const allMappings = data.formMappings || {};

  // Create key for this mapping
  const mappingKey = `${url.hostname}${mapping.metadata.urlPattern}`;
  allMappings[mappingKey] = mapping;

  // Save
  await chrome.storage.sync.set({ formMappings: allMappings });

  showStatus(`Mapping saved for: ${mappingKey}`, 'success');
});

// Generalize path (replace numbers with *)
function generalizePath(pathname) {
  return pathname.replace(/\/\d+/g, '/*');
}

// Clear mappings for current domain
document.getElementById('clearMappings').addEventListener('click', async () => {
  if (!currentUrl) return;

  const url = new URL(currentUrl);
  const hostname = url.hostname;

  const data = await chrome.storage.sync.get(['formMappings']);
  const allMappings = data.formMappings || {};

  // Find and delete mappings for this domain
  let deletedCount = 0;
  Object.keys(allMappings).forEach(key => {
    if (key.startsWith(hostname)) {
      delete allMappings[key];
      deletedCount++;
    }
  });

  await chrome.storage.sync.set({ formMappings: allMappings });

  showStatus(`Cleared ${deletedCount} mapping(s) for ${hostname}`, 'success');
});

// Copy debug JSON
document.getElementById('copyDebug').addEventListener('click', () => {
  if (!debugData) {
    showStatus('No debug data available. Run Auto Fill first.', 'info');
    return;
  }

  const json = JSON.stringify(debugData, null, 2);
  navigator.clipboard.writeText(json).then(() => {
    showStatus('Debug JSON copied to clipboard!', 'success');
  }).catch(() => {
    showStatus('Failed to copy to clipboard', 'error');
  });
});

// Display auto-fill results
function displayResults(results) {
  const resultsDiv = document.getElementById('results');
  const listDiv = document.getElementById('resultsList');

  if (!results || results.length === 0) {
    resultsDiv.classList.remove('show');
    return;
  }

  listDiv.innerHTML = '';

  results.forEach(result => {
    const item = document.createElement('div');
    item.className = 'result-item';

    const confidence = result.confidence || 0;
    let confidenceClass = 'confidence-low';
    if (confidence >= 80) confidenceClass = 'confidence-high';
    else if (confidence >= 50) confidenceClass = 'confidence-medium';

    const method = result.method === 'stored' ? '📌 Stored' : '🤖 Auto';

    item.innerHTML = `
      <span class="result-field">${result.fieldType}</span>
      <span class="result-confidence ${confidenceClass}">${method} ${confidence}%</span>
      <div style="font-size: 10px; color: #888; margin-top: 2px;">
        ${escapeHtml(result.label || '')} → ${escapeHtml(result.selector || '')}
      </div>
    `;

    listDiv.appendChild(item);
  });

  resultsDiv.classList.add('show');
}

// Get profile value by key
function getProfileValue(profile, key) {
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
    consent: true, // Default for checkboxes
    category: ''
  };

  return mapping[key] || '';
}

// Show status message
function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status show status-${type}`;

  setTimeout(() => {
    statusDiv.classList.remove('show');
  }, 3000);
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Bulk Crawler functionality
document.getElementById('startBulkCrawl').addEventListener('click', async () => {
  const urlsText = document.getElementById('bulkUrls').value.trim();
  if (!urlsText) {
    showStatus('Please enter at least one URL', 'error');
    return;
  }

  const urls = urlsText.split('\n').map(url => url.trim()).filter(url => url.length > 0);
  if (urls.length === 0) {
    showStatus('Please enter valid URLs', 'error');
    return;
  }

  // Show progress and disable button
  document.getElementById('startBulkCrawl').disabled = true;
  document.getElementById('crawlProgress').style.display = 'block';
  document.getElementById('crawlResults').style.display = 'none';
  document.getElementById('progressText').textContent = `Processing ${urls.length} URL(s)...`;

  try {
    // Call Worker API
    const response = await fetch('https://goenchan-worker.taiichifox.workers.dev/bulk-crawler', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ urls })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error || 'Unknown error'}`);
    }

    const result = await response.json();

    // Store mappings globally for download
    window.crawlMappings = result.mappings;

    // Hide progress, show results
    document.getElementById('crawlProgress').style.display = 'none';
    document.getElementById('crawlResults').style.display = 'block';

    // Display statistics (use correct field names from Worker response)
    const stats = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <div><strong>Total:</strong> ${result.totalProcessed || 0}</div>
        <div><strong>Success:</strong> <span style="color: #34a853;">${result.successCount || 0}</span></div>
        <div><strong>Failed:</strong> <span style="color: #ea4335;">${result.failureCount || 0}</span></div>
        <div><strong>Mappings:</strong> ${result.mappings ? result.mappings.length : 0}</div>
      </div>
    `;
    document.getElementById('resultsStats').innerHTML = stats;

    // Display errors if any
    if (result.errors && result.errors.length > 0) {
      const errorList = document.getElementById('errorList');
      errorList.style.display = 'block';
      errorList.innerHTML = '<div style="font-weight: 600; margin-bottom: 6px; color: #ea4335;">Errors:</div>';

      result.errors.forEach(error => {
        const errorItem = document.createElement('div');
        errorItem.style.cssText = 'padding: 6px; border-bottom: 1px solid #f0f0f0; font-size: 10px;';
        // Error is a string in format "url: error message"
        errorItem.textContent = error;
        errorList.appendChild(errorItem);
      });
    } else {
      document.getElementById('errorList').style.display = 'none';
    }

    showStatus(`Crawl complete! ${result.successCount}/${result.totalProcessed} successful`, 'success');

  } catch (error) {
    console.error('Bulk crawl error:', error);
    document.getElementById('crawlProgress').style.display = 'none';
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    // Re-enable button regardless of success or failure
    document.getElementById('startBulkCrawl').disabled = false;
  }
});

// Download mappings JSON
document.getElementById('downloadMappings').addEventListener('click', () => {
  if (!window.crawlMappings) {
    showStatus('No mappings available to download', 'error');
    return;
  }

  const json = JSON.stringify(window.crawlMappings, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `form-mappings-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showStatus('Mappings JSON downloaded!', 'success');
});
