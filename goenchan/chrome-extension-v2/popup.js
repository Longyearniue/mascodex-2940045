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
  updateStorageStatus();

  // Restore batch mode state if running
  await restoreBatchModeState();
});

// Restore batch mode UI state from background
async function restoreBatchModeState() {
  try {
    // Restore saved batch URLs and settings
    const storage = await chrome.storage.local.get(['batchUrls', 'batchAutoCloseEnabled']);
    if (storage.batchUrls) {
      const batchUrlsEl = document.getElementById('batchUrls'); if (batchUrlsEl) batchUrlsEl.value = storage.batchUrls;
    }
    // Restore auto-close setting (default to true)
    const autoCloseCheckbox = document.getElementById('autoCloseEnabled');
    if (autoCloseCheckbox) {
      autoCloseCheckbox.checked = storage.batchAutoCloseEnabled !== false;
    }

    const status = await chrome.runtime.sendMessage({ action: 'getBatchStatus' });

    if (status && status.isRunning) {
      console.log('[Popup] Restoring batch mode state:', status);

      // Show batch mode section
      const batchContent = document.getElementById('batchModeContent');
      const batchToggle = document.getElementById('batchModeToggle');
      batchContent.classList.add('show');
      batchToggle.textContent = '▼ Batch Mode (一括送信)';

      // Update button states
      { const _el_startBatch = document.getElementById('startBatch'); if (_el_startBatch) _el_startBatch.disabled = true; }
      { const _el_nextBatch = document.getElementById('nextBatch'); if (_el_nextBatch) _el_nextBatch.disabled = false; }
      { const _el_stopBatch = document.getElementById('stopBatch'); if (_el_stopBatch) _el_stopBatch.disabled = false; }
      { const _s_batchStatus = document.getElementById('batchStatus'); if (_s_batchStatus) _s_batchStatus.style.display = 'block'; }

      // Show appropriate phase
      if (status.processingPhase === 'finding_contacts') {
        { const _s_findingContactsPhase = document.getElementById('findingContactsPhase'); if (_s_findingContactsPhase) _s_findingContactsPhase.style.display = 'block'; }
        { const _s_openingTabsPhase = document.getElementById('openingTabsPhase'); if (_s_openingTabsPhase) _s_openingTabsPhase.style.display = 'none'; }

        const processed = status.validCount + status.skippedCount;
        { const _el_contactSearchProgress = document.getElementById('contactSearchProgress'); if (_el_contactSearchProgress) _el_contactSearchProgress.textContent = `${processed}/${status.total}`; }
        { const _el_validUrlCount = document.getElementById('validUrlCount'); if (_el_validUrlCount) _el_validUrlCount.textContent = status.validCount; }
        { const _el_skippedUrlCount = document.getElementById('skippedUrlCount'); if (_el_skippedUrlCount) _el_skippedUrlCount.textContent = status.skippedCount; }

        const percent = status.total > 0 ? (processed / status.total) * 100 : 0;
        { const _s_contactSearchBar = document.getElementById('contactSearchBar'); if (_s_contactSearchBar) _s_contactSearchBar.style.width = `${percent}%`; }
      } else if (status.processingPhase === 'running' || status.processingPhase === 'ready') {
        { const _s_findingContactsPhase = document.getElementById('findingContactsPhase'); if (_s_findingContactsPhase) _s_findingContactsPhase.style.display = 'none'; }
        { const _s_openingTabsPhase = document.getElementById('openingTabsPhase'); if (_s_openingTabsPhase) _s_openingTabsPhase.style.display = 'block'; }

        { const _el_batchProgress = document.getElementById('batchProgress'); if (_el_batchProgress) _el_batchProgress.textContent = `${status.currentIndex}/${status.validCount}`; }
        { const _el_openTabsCount = document.getElementById('openTabsCount'); if (_el_openTabsCount) _el_openTabsCount.textContent = status.openTabs; }

        const percent = status.validCount > 0 ? (status.currentIndex / status.validCount) * 100 : 0;
        { const _s_batchProgressBar = document.getElementById('batchProgressBar'); if (_s_batchProgressBar) _s_batchProgressBar.style.width = `${percent}%`; }
      }

      // Start status update interval
      startBatchStatusInterval();

      showStatus(`🔄 バッチモード実行中: ${status.validCount}件の有効URL`, 'info');
    }
  } catch (error) {
    console.log('[Popup] Could not restore batch state:', error);
  }
}

// Batch status update interval reference
let batchStatusInterval = null;

function startBatchStatusInterval() {
  // Clear existing interval if any
  if (batchStatusInterval) {
    clearInterval(batchStatusInterval);
  }

  // Start new interval
  batchStatusInterval = setInterval(updateBatchStatus, 1000);
}

// Setup collapsible sections
function setupCollapsibles() {
  document.getElementById('profileToggle')?.addEventListener('click', () => {
    const content = document.getElementById('profileContent');
    const toggle = document.getElementById('profileToggle');
    if (!content || !toggle) return;
    content.classList.toggle('show');
    toggle.textContent = content.classList.contains('show') ? '▼ Profile Settings' : '▶ Profile Settings';
  });

  document.getElementById('bulkCrawlerToggle')?.addEventListener('click', () => {
    const content = document.getElementById('bulkCrawlerContent');
    const toggle = document.getElementById('bulkCrawlerToggle');
    if (!content || !toggle) return;
    content.classList.toggle('show');
    toggle.textContent = content.classList.contains('show') ? '▼ Bulk Site Crawler' : '▶ Bulk Site Crawler';
  });

  document.getElementById('batchModeToggle')?.addEventListener('click', () => {
    const content = document.getElementById('batchModeContent');
    const toggle = document.getElementById('batchModeToggle');
    if (!content || !toggle) return;
    content.classList.toggle('show');
    toggle.textContent = content.classList.contains('show') ? '▼ Batch Mode (一括送信)' : '▶ Batch Mode (一括送信)';
  });

  // Auto-save autoCloseEnabled setting when changed
  document.getElementById('autoCloseEnabled')?.addEventListener('change', async (e) => {
    await chrome.storage.local.set({ batchAutoCloseEnabled: e.target.checked });
    console.log('[Popup] Auto-close setting saved:', e.target.checked);
  });
}

// Load current tab URL
async function loadCurrentUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentUrl = tab.url;
}

// Load profile data
async function loadProfile() {
  const data = await chrome.storage.sync.get(['profile', 'autoFillEnabled', 'deepseekApiKey']);
  if (data.deepseekApiKey) {
    document.getElementById('deepseekApiKey').value = data.deepseekApiKey;
  }
  if (data.profile) {
    document.getElementById('company').value = data.profile.company || '';
    document.getElementById('company_kana').value = data.profile.company_kana || '';
    document.getElementById('name').value = data.profile.name || '';
    document.getElementById('name_kana').value = data.profile.name_kana || '';
    document.getElementById('last_name').value = data.profile.last_name || '';
    document.getElementById('first_name').value = data.profile.first_name || '';
    document.getElementById('last_name_kana').value = data.profile.last_name_kana || '';
    document.getElementById('first_name_kana').value = data.profile.first_name_kana || '';
    document.getElementById('email').value = data.profile.email || '';
    document.getElementById('phone').value = data.profile.phone || '';
    document.getElementById('zipcode').value = data.profile.zipcode || '';
    document.getElementById('address').value = data.profile.address || '';
    document.getElementById('prefecture').value = data.profile.prefecture || '';
    document.getElementById('city').value = data.profile.city || '';
    document.getElementById('street').value = data.profile.street || '';
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
  // フルネームから姓/名を自動分割（個別フィールドが空の場合）
  const _fullName = document.getElementById('name').value.trim();
  const _fullKana = document.getElementById('name_kana').value.trim();
  let _autoLastName = document.getElementById('last_name').value.trim();
  let _autoFirstName = document.getElementById('first_name').value.trim();
  let _autoLastKana = document.getElementById('last_name_kana').value.trim();
  let _autoFirstKana = document.getElementById('first_name_kana').value.trim();

  // フルネームがあり姓/名が空 or 姓==名==フルネームなら自動分割
  const _needsSplit = !_autoLastName || !_autoFirstName ||
    (_autoLastName === _fullName && _autoFirstName === _fullName);
  if (_fullName && _needsSplit) {
    const spaceParts = _fullName.split(/[\s\u3000]+/).filter(p => p.length > 0);
    if (spaceParts.length >= 2) {
      if (!_autoLastName) _autoLastName = spaceParts[0];
      if (!_autoFirstName) _autoFirstName = spaceParts.slice(1).join('');
    } else {
      // 漢字→かな/カナ境界で分割（例: 松本まみ, 松本マミ）
      const m = _fullName.match(/^([一-鿿㐀-䶿]+)([぀-ゟ゠-ヿ].+)$/);
      if (m) {
        if (!_autoLastName) _autoLastName = m[1];
        if (!_autoFirstName) _autoFirstName = m[2];
      }
    }
  }

  // フルカナがあり姓/名カナが空なら自動分割
  if (_fullKana && (!_autoLastKana || !_autoFirstKana)) {
    const kanaSpace = _fullKana.split(/[\s\u3000]+/).filter(p => p.length > 0);
    if (kanaSpace.length >= 2) {
      if (!_autoLastKana) _autoLastKana = kanaSpace[0];
      if (!_autoFirstKana) _autoFirstKana = kanaSpace.slice(1).join('');
    } else if (_autoLastName) {
      // 漢字の姓の長さを使ってカナを分割
      const kanjiCount = (_autoLastName.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
      const totalKanji = (_fullName.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
      if (kanjiCount > 0 && totalKanji > 0) {
        const splitPos = Math.round(_fullKana.length * kanjiCount / totalKanji);
        const clamped = Math.max(1, Math.min(splitPos, _fullKana.length - 1));
        if (!_autoLastKana) _autoLastKana = _fullKana.slice(0, clamped);
        if (!_autoFirstKana) _autoFirstKana = _fullKana.slice(clamped);
      }
    }
  }

  const profile = {
    company: document.getElementById('company').value,
    company_kana: document.getElementById('company_kana').value,
    name: _fullName,
    name_kana: _fullKana,
    last_name: _autoLastName,
    first_name: _autoFirstName,
    last_name_kana: _autoLastKana,
    first_name_kana: _autoFirstKana,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    zipcode: document.getElementById('zipcode').value,
    address: document.getElementById('address').value,
    prefecture: document.getElementById('prefecture').value,
    city: document.getElementById('city').value,
    street: document.getElementById('street').value,
    department: document.getElementById('department').value,
    subject: document.getElementById('subject').value,
    message: document.getElementById('message').value
  };

  // Get auto-fill setting
  const autoFillEnabled = document.getElementById('autoFillEnabled').checked;

  const deepseekApiKey = document.getElementById('deepseekApiKey').value.trim();
  await chrome.storage.sync.set({ profile, autoFillEnabled, deepseekApiKey });
  const ps = document.getElementById('profileStatus'); if (ps) { ps.textContent = '✅ プロフィールを保存しました！'; ps.className = 'status show status-success'; setTimeout(() => ps.classList.remove('show'), 3000); }
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
    if (response.results.length === 0) {
      const pl = (debugData && debugData.platform) || '?';
      const sm = (debugData && debugData.siteMapping) || 'なし';
      showStatus('⚠️ 0件入力 | platform:' + pl + ' | siteMap:' + sm, 'error');
    } else {
      const pc = (debugData && debugData.passCounts) || {};
      showStatus('✅ ' + response.results.length + 'フィールド入力 [AI:' + (pc.passAI||0) + ' type:' + (pc.passType||0) + ']', 'success');
    }

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

  // Split URLs into batches of 3 (hybrid approach: 3 sites × 16 requests = 48 < 50 subrequest limit)
  const BATCH_SIZE = 3;
  const batches = [];
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    batches.push(urls.slice(i, i + BATCH_SIZE));
  }

  // Show progress and disable button
  document.getElementById('startBulkCrawl').disabled = true;
  document.getElementById('crawlProgress').style.display = 'block';
  document.getElementById('crawlResults').style.display = 'none';

  // Initialize progress list
  const progressList = document.getElementById('urlProgressList');
  progressList.innerHTML = '';

  // Accumulate results from all batches
  let allMappings = [];
  let allErrors = [];
  let totalProcessed = 0;
  let totalSuccess = 0;
  let totalFailed = 0;

  try {
    // Process each batch sequentially
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchNum = i + 1;
      const totalBatches = batches.length;

      document.getElementById('progressText').textContent =
        `Batch ${batchNum}/${totalBatches}: Processing ${batch.length} URL(s)... (${totalProcessed}/${urls.length} total completed)`;

      // Add batch URLs to progress list
      const batchUrls = {};
      batch.forEach(url => {
        const urlItem = document.createElement('div');
        urlItem.id = `url-${url.replace(/[^a-zA-Z0-9]/g, '-')}`;
        urlItem.style.cssText = 'padding: 4px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 6px;';
        urlItem.innerHTML = `
          <span style="color: #ff9800;">⏳</span>
          <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(url)}</span>
          <span style="font-size: 9px; color: #666;">処理中...</span>
        `;
        progressList.appendChild(urlItem);
        batchUrls[url] = urlItem;
      });

      // Call Worker API for this batch with timeout (90 seconds for 3 sites × 20 sec each + buffer)
      const batchController = new AbortController();
      const batchTimeoutId = setTimeout(() => batchController.abort(), 90000);

      let response;
      try {
        response = await fetch('https://crawler-worker-teamb.taiichifox.workers.dev/bulk-crawler', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ urls: batch }),
          signal: batchController.signal
        });
      } catch (error) {
        clearTimeout(batchTimeoutId);
        if (error.name === 'AbortError') {
          throw new Error(`Batch ${batchNum} timed out after 90 seconds`);
        }
        throw error;
      }
      clearTimeout(batchTimeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Batch ${batchNum} failed: HTTP ${response.status}, ${errorData.error || 'Unknown error'}`);
      }

      const result = await response.json();

      // Update each URL status based on results
      if (result.results) {
        result.results.forEach(urlResult => {
          const urlItem = batchUrls[urlResult.url];
          if (urlItem) {
            if (urlResult.success) {
              urlItem.innerHTML = `
                <span style="color: #34a853;">✓</span>
                <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(urlResult.url)}</span>
                <span style="font-size: 9px; color: #34a853;">成功</span>
              `;
            } else {
              urlItem.innerHTML = `
                <span style="color: #ea4335;">✗</span>
                <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(urlResult.error || '')}">${escapeHtml(urlResult.url)}</span>
                <span style="font-size: 9px; color: #ea4335;">失敗</span>
              `;
            }
          }
        });
      }

      // Accumulate results
      if (result.mappings && result.mappings.length > 0) {
        allMappings = allMappings.concat(result.mappings);
      }
      if (result.errors && result.errors.length > 0) {
        allErrors = allErrors.concat(result.errors);
      }
      totalProcessed += result.totalProcessed || 0;
      totalSuccess += result.successCount || 0;
      totalFailed += result.failureCount || 0;

      // Small delay between batches to avoid rate limiting
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Store all mappings globally for download
    window.crawlMappings = allMappings;

    // AUTO-SAVE: Automatically save to chrome.storage for instant use
    if (allMappings.length > 0) {
      try {
        // Get existing mappings from storage
        const stored = await chrome.storage.local.get(['autoGeneratedMappings']);
        const existingMappings = stored.autoGeneratedMappings || {};

        // Merge new mappings with existing (new ones override)
        const mergedMappings = { ...existingMappings };
        allMappings.forEach(mapping => {
          const url = mapping.url || mapping.domain;
          if (url && mapping.mapping) {
            mergedMappings[url] = {
              pattern: mapping.pattern,
              confidence: mapping.confidence,
              mapping: mapping.mapping
            };
          }
        });

        // Save merged mappings
        await chrome.storage.local.set({ autoGeneratedMappings: mergedMappings });
        console.log(`✅ Auto-saved ${Object.keys(mergedMappings).length} mappings to local storage`);

        // Update storage status display
        updateStorageStatus();

        // AUTO-UPLOAD: Upload high-quality mappings to shared cloud storage
        await uploadToSharedMappings(mergedMappings);
      } catch (error) {
        console.error('❌ Failed to auto-save mappings:', error);
      }
    }

    // Hide progress, show results
    document.getElementById('crawlProgress').style.display = 'none';
    document.getElementById('crawlResults').style.display = 'block';

    // Display combined statistics
    const stats = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <div><strong>Total:</strong> ${totalProcessed}</div>
        <div><strong>Success:</strong> <span style="color: #34a853;">${totalSuccess}</span></div>
        <div><strong>Failed:</strong> <span style="color: #ea4335;">${totalFailed}</span></div>
        <div><strong>Mappings:</strong> ${allMappings.length}</div>
      </div>
      ${batches.length > 1 ? `<div style="margin-top: 8px; font-size: 11px; color: #666;">Processed in ${batches.length} batches</div>` : ''}
    `;
    document.getElementById('resultsStats').innerHTML = stats;

    // Display all errors
    if (allErrors.length > 0) {
      const errorList = document.getElementById('errorList');
      errorList.style.display = 'block';
      errorList.innerHTML = `<div style="font-weight: 600; margin-bottom: 6px; color: #ea4335;">Errors (${allErrors.length}):</div>`;

      // Limit displayed errors to first 50 to avoid UI overload
      const displayErrors = allErrors.slice(0, 50);
      displayErrors.forEach(error => {
        const errorItem = document.createElement('div');
        errorItem.style.cssText = 'padding: 6px; border-bottom: 1px solid #f0f0f0; font-size: 10px;';
        errorItem.textContent = error;
        errorList.appendChild(errorItem);
      });

      if (allErrors.length > 50) {
        const moreItem = document.createElement('div');
        moreItem.style.cssText = 'padding: 6px; font-size: 10px; color: #666; font-style: italic;';
        moreItem.textContent = `... and ${allErrors.length - 50} more errors`;
        errorList.appendChild(moreItem);
      }
    } else {
      document.getElementById('errorList').style.display = 'none';
    }

    showStatus(`Crawl complete! ${totalSuccess}/${totalProcessed} successful. ✅ Auto-saved to storage - ready to use immediately!`, 'success');

  } catch (error) {
    console.error('Bulk crawl error:', error);
    document.getElementById('crawlProgress').style.display = 'none';
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    // Re-enable button regardless of success or failure
    document.getElementById('startBulkCrawl').disabled = false;
  }
});

/**
 * Convert Worker mappings to SITE_MAPPINGS format for content.js
 *
 * Worker format: { personName: "お名前", email: "メールアドレス", ... }
 * SITE_MAPPINGS format: { name: { selector: '[name="お名前"]', confidence: 85 }, ... }
 */
function convertToSiteMappings(workerMappings) {
  const siteMappings = {};

  // Field type name conversions
  const fieldTypeMap = {
    personName: 'name',
    personNameKana: 'nameKana',
    companyName: 'company',
    email: 'email',
    phone: 'phone',
    inquiry: 'message',
    subject: 'subject',
    zipcode: 'zipcode',
    address: 'address',
    department: 'department'
  };

  workerMappings.forEach(mapping => {
    const { url, pattern, confidence, mapping: fieldMapping } = mapping;

    // Skip if no field mapping
    if (!fieldMapping || Object.keys(fieldMapping).length === 0) {
      return;
    }

    // Convert to SITE_MAPPINGS format
    const siteMapping = {
      pattern,
      confidence,
      mapping: {}
    };

    // Convert each field
    Object.entries(fieldMapping).forEach(([workerFieldType, fieldName]) => {
      // Get content.js field type name
      const contentFieldType = fieldTypeMap[workerFieldType] || workerFieldType;

      // Check if it's an array (split fields like tel1, tel2, tel3)
      if (Array.isArray(fieldName)) {
        // For arrays, create array of selector objects
        siteMapping.mapping[contentFieldType] = fieldName.map(name => ({
          selector: `[name="${name}"]`,
          confidence: Math.round(confidence * 100)
        }));
      } else {
        // Single field
        siteMapping.mapping[contentFieldType] = {
          selector: `[name="${fieldName}"]`,
          confidence: Math.round(confidence * 100)
        };
      }
    });

    siteMappings[url] = siteMapping;
  });

  return siteMappings;
}

// Download mappings JSON
document.getElementById('downloadMappings').addEventListener('click', () => {
  if (!window.crawlMappings) {
    showStatus('No mappings available to download', 'error');
    return;
  }

  // Convert to SITE_MAPPINGS format
  const siteMappings = convertToSiteMappings(window.crawlMappings);

  // Generate JavaScript code for content.js
  const jsCode = `// Auto-generated SITE_MAPPINGS from Bulk Crawler
// Generated at: ${new Date().toISOString()}
// Add this to your content.js SITE_MAPPINGS object

const GENERATED_MAPPINGS = ${JSON.stringify(siteMappings, null, 2)};

// To use: merge with existing SITE_MAPPINGS
// Object.assign(SITE_MAPPINGS, GENERATED_MAPPINGS);
`;

  const blob = new Blob([jsCode], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `site-mappings-${Date.now()}.js`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showStatus(`SITE_MAPPINGS generated! (${Object.keys(siteMappings).length} sites)`, 'success');
});

// =============================================================================
// SHARED MAPPINGS (CLOUD SYNC)
// =============================================================================

/**
 * Upload mappings to shared cloud storage
 * Only uploads high-quality mappings (confidence >= 50%)
 */
async function uploadToSharedMappings(mappings) {
  try {
    // Filter high-quality mappings only
    const highQualityMappings = {};
    let filteredCount = 0;

    for (const [url, mapping] of Object.entries(mappings)) {
      if (mapping.confidence && mapping.confidence >= 0.5) {
        highQualityMappings[url] = mapping;
        filteredCount++;
      }
    }

    if (filteredCount === 0) {
      console.log('ℹ️ No high-quality mappings to upload (confidence >= 50% required)');
      return;
    }

    // Upload to cloud
    const response = await fetch('https://crawler-worker-teamb.taiichifox.workers.dev/shared-mappings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mappings: highQualityMappings })
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`☁️ Uploaded to cloud: ${result.added} added, ${result.skipped} skipped, ${result.total} total in cloud`);
    } else {
      console.warn('⚠️ Failed to upload to cloud:', response.status);
    }
  } catch (error) {
    console.log('ℹ️ Could not upload to cloud (offline or unavailable)');
  }
}

// =============================================================================
// AUTO-SAVE STORAGE MANAGEMENT
// =============================================================================

// Update storage status display
async function updateStorageStatus() {
  try {
    const stored = await chrome.storage.local.get(['autoGeneratedMappings']);
    const count = stored.autoGeneratedMappings ? Object.keys(stored.autoGeneratedMappings).length : 0;
    document.getElementById('storedMappingsCount').textContent = count;
  } catch (error) {
    console.error('Failed to update storage status:', error);
  }
}

// Clear storage button handler
document.getElementById('clearStorage').addEventListener('click', async () => {
  if (confirm('Clear all auto-saved mappings? This cannot be undone.')) {
    try {
      await chrome.storage.local.remove(['autoGeneratedMappings']);
      updateStorageStatus();
      showStatus('✅ Auto-saved mappings cleared', 'success');
    } catch (error) {
      console.error('Failed to clear storage:', error);
      showStatus('❌ Failed to clear storage', 'error');
    }
  }
});

// Upload to cloud button handler
document.getElementById('uploadToCloud').addEventListener('click', async () => {
  try {
    const stored = await chrome.storage.local.get(['autoGeneratedMappings']);
    const mappings = stored.autoGeneratedMappings || {};
    const count = Object.keys(mappings).length;

    if (count === 0) {
      showStatus('No mappings to share', 'error');
      return;
    }

    showStatus(`☁️ Uploading ${count} mappings to community...`, 'info');
    await uploadToSharedMappings(mappings);
    showStatus(`✅ Shared to community! Your mappings help everyone.`, 'success');
  } catch (error) {
    console.error('Failed to upload to cloud:', error);
    showStatus('❌ Failed to upload to cloud', 'error');
  }
});

// =============================================================================
// BATCH MODE (一括送信)
// =============================================================================

// Get current profile data
function getCurrentProfile() {
  const get = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  return {
    company: get('company'),
    name: get('name'),
    name_kana: get('name_kana'),
    last_name: get('last_name'),
    first_name: get('first_name'),
    last_name_kana: get('last_name_kana'),
    first_name_kana: get('first_name_kana'),
    email: get('email'),
    phone: get('phone'),
    zipcode: get('zipcode'),
    address: get('address'),
    department: get('department'),
    subject: get('subject'),
    message: get('message') // messageフィールドがない場合は空文字
  };
}

async function getCurrentProfileWithTemplate() {
  // storageから読む（UIフィールドが空でも確実に取得）
  const data = await chrome.storage.sync.get(['profile', 'tplBody', 'tplSubject', 'deepseekApiKey']);
  const saved = data.profile || {};
  // UIフィールドが埋まっていればそちらを優先、なければstorage値
  const get = id => { const el = document.getElementById(id); return (el && el.value) ? el.value : ''; };
  const profile = {
    company:          get('company')          || saved.company          || '',
    name:             get('name')             || saved.name             || '',
    name_kana:        get('name_kana')        || saved.name_kana        || '',
    last_name:        get('last_name')        || saved.last_name        || '',
    first_name:       get('first_name')       || saved.first_name       || '',
    last_name_kana:   get('last_name_kana')   || saved.last_name_kana   || '',
    first_name_kana:  get('first_name_kana')  || saved.first_name_kana  || '',
    email:            get('email')            || saved.email            || '',
    phone:            get('phone')            || saved.phone            || '',
    zipcode:          get('zipcode')          || saved.zipcode          || '',
    address:          get('address')          || saved.address          || '',
    prefecture:       get('prefecture')       || saved.prefecture       || '',
    city:             get('city')             || saved.city             || '',
    street:           get('street')           || saved.street           || '',
    department:       get('department')       || saved.department       || '',
    subject:          get('subject')          || saved.subject          || '',
    message:          get('message')          || saved.message          || ''
  };
  // 原稿タブのテンプレートをmessageとして使用
  if (data.tplBody) profile.message = data.tplBody;
  if (data.tplSubject && !profile.subject) profile.subject = data.tplSubject;
  return profile;
}

// Start batch button handler
document.getElementById('startBatch')?.addEventListener('click', async () => {
  const urlsText = document.getElementById('batchUrls')?.value.trim();
  if (!urlsText) {
    showStatus('URLを入力してください', 'error');
    return;
  }

  // Parse CSV lines: 会社名,URL,FAX,県,市 or plain URLs
  const entries = urlsText.split('\n')
    .map(line => line.trim())
    .filter(line => line)
    .map(line => {
      const parts = line.split(',').map(p => p.trim());
      // If line has commas, treat as CSV: 会社名,URL,FAX,県,市
      if (parts.length >= 2 && parts[1].startsWith('http')) {
        return {
          companyName: parts[0] || '',
          url: parts[1],
          fax: parts[2] || '',
          prefecture: parts[3] || '',
          city: parts[4] || ''
        };
      }
      // Plain URL
      if (line.startsWith('http')) {
        return { url: line, companyName: '', fax: '', prefecture: '', city: '' };
      }
      return null;
    })
    .filter(entry => entry && entry.url);

  const urls = entries.map(e => e.url);

  if (entries.length === 0) {
    showStatus('有効なURLがありません', 'error');
    return;
  }

  // Save URLs and settings for restoration
  const autoCloseEnabled = document.getElementById('autoCloseEnabled')?.checked;
  await chrome.storage.local.set({
    batchUrls: urlsText,
    batchAutoCloseEnabled: autoCloseEnabled
  });

  const profile = await getCurrentProfileWithTemplate();
  const tabsPerBatch = parseInt(document.getElementById('tabsPerBatch')?.value);

  try {
    await chrome.runtime.sendMessage({
      action: 'startBatch',
      urls: urls,
      entries: entries,
      profile: profile,
      tabsPerBatch: tabsPerBatch,
      autoCloseEnabled: autoCloseEnabled
    });

    // Update UI
    { const _el_startBatch = document.getElementById('startBatch'); if (_el_startBatch) _el_startBatch.disabled = true; }
    { const _el_nextBatch = document.getElementById('nextBatch'); if (_el_nextBatch) _el_nextBatch.disabled = false; }
    { const _el_stopBatch = document.getElementById('stopBatch'); if (_el_stopBatch) _el_stopBatch.disabled = false; }
    { const _s_batchStatus = document.getElementById('batchStatus'); if (_s_batchStatus) _s_batchStatus.style.display = 'block'; }

    startBatchStatusInterval();
    showStatus(`🚀 バッチ開始: ${urls.length}件のURLを処理します`, 'success');
  } catch (error) {
    console.error('Failed to start batch:', error);
    showStatus('バッチ開始に失敗しました', 'error');
  }
});

// Next batch button handler
document.getElementById('nextBatch')?.addEventListener('click', async () => {
  console.log('[Popup] Next batch button clicked');
  try {
    const response = await chrome.runtime.sendMessage({ action: 'nextBatch' });
    console.log('[Popup] Next batch response:', response);

    if (response.success) {
      showStatus(`➡️ 次のバッチを開いています... (残り${response.remaining}件)`, 'info');
    } else if (response.error === 'no_more_urls') {
      showStatus('⚠️ 処理するURLがありません', 'error');
    } else if (response.error === 'batch_not_running') {
      showStatus('⚠️ バッチモードが実行されていません', 'error');
    } else {
      showStatus('⚠️ ' + (response.message || '次のバッチを開けませんでした'), 'error');
    }
    updateBatchStatus();
  } catch (error) {
    console.error('[Popup] Failed to open next batch:', error);
    showStatus('次のバッチを開けませんでした', 'error');
  }
});

// Stop batch button handler
document.getElementById('stopBatch')?.addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ action: 'stopBatch' });

    // Update UI
    { const _el_startBatch = document.getElementById('startBatch'); if (_el_startBatch) _el_startBatch.disabled = false; }
    { const _el_nextBatch = document.getElementById('nextBatch'); if (_el_nextBatch) _el_nextBatch.disabled = true; }
    { const _el_stopBatch = document.getElementById('stopBatch'); if (_el_stopBatch) _el_stopBatch.disabled = true; }
    { const _s_batchStatus = document.getElementById('batchStatus'); if (_s_batchStatus) _s_batchStatus.style.display = 'none'; }

    // Clear saved URLs
    await chrome.storage.local.remove(['batchUrls']);

    stopBatchStatusInterval();
    showStatus('⏹️ バッチを停止しました', 'info');
  } catch (error) {
    console.error('Failed to stop batch:', error);
    showStatus('バッチ停止に失敗しました', 'error');
  }
});

// Update batch status display
async function updateBatchStatus() {
  try {
    const status = await chrome.runtime.sendMessage({ action: 'getBatchStatus' });

    if (status) {
      const total = status.total || 0;
      const validCount = status.validCount || 0;
      const skippedCount = status.skippedCount || 0;
      const currentIndex = status.currentIndex || 0;
      const openTabs = status.openTabs || 0;
      const phase = status.processingPhase || 'idle';

      // Update phase-specific UI
      const findingPhase = document.getElementById('findingContactsPhase');
      const openingPhase = document.getElementById('openingTabsPhase');
      const summaryText = document.getElementById('batchSummaryText');

      if (phase === 'finding_contacts') {
        findingPhase.style.display = 'block';
        openingPhase.style.display = 'none';
        summaryText.textContent = '🔍 お問合せページを検索中...';
      } else if (phase === 'ready' || phase === 'running') {
        findingPhase.style.display = 'none';
        openingPhase.style.display = 'block';

        { const _el_batchProgress = document.getElementById('batchProgress'); if (_el_batchProgress) _el_batchProgress.textContent = `${currentIndex}/${validCount}`; }
        { const _el_openTabsCount = document.getElementById('openTabsCount'); if (_el_openTabsCount) _el_openTabsCount.textContent = openTabs; }

        const percentage = validCount > 0 ? (currentIndex / validCount) * 100 : 0;
        { const _s_batchProgressBar = document.getElementById('batchProgressBar'); if (_s_batchProgressBar) _s_batchProgressBar.style.width = `${percentage}%`; }

        if (skippedCount > 0) {
          summaryText.innerHTML = `✅ 有効: <strong>${validCount}</strong>件 / ⏭️ スキップ: <strong>${skippedCount}</strong>件 (お問合せページなし)`;
        } else {
          summaryText.innerHTML = `✅ 有効: <strong>${validCount}</strong>件`;
        }
      }

      if (!status.isRunning && phase === 'idle' && (validCount > 0 || skippedCount > 0)) {
        // Batch complete
        { const _el_startBatch = document.getElementById('startBatch'); if (_el_startBatch) _el_startBatch.disabled = false; }
        { const _el_nextBatch = document.getElementById('nextBatch'); if (_el_nextBatch) _el_nextBatch.disabled = true; }
        { const _el_stopBatch = document.getElementById('stopBatch'); if (_el_stopBatch) _el_stopBatch.disabled = true; }
      }
    }
  } catch (error) {
    console.log('Could not get batch status:', error);
  }
}

// Listen for batch phase updates, verification updates, and complete message
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'verificationUpdate') {
    // Handle individual tab verification result
    const status = message.kept ? '✅' : '❌';
    const reason = message.kept ? '記入完了' : message.reason;
    console.log(`[Popup] Tab verification: ${status} ${reason} - ${message.url}`);

    // Update summary text if available
    const summaryEl = document.getElementById('batchSummaryText');
    if (summaryEl && message.verification) {
      const v = message.verification;
      summaryEl.innerHTML = `${status} ${v.filledFields}/${v.totalFields}フィールド記入 (${reason})`;
    }
  } else if (message.action === 'batchSummaryUpdate') {
    // Update batch summary display
    const s = message.summary;
    const summaryEl = document.getElementById('batchSummaryText');
    if (summaryEl) {
      summaryEl.innerHTML = `
        ✅ 成功: <strong>${s.successful}</strong>件 /
        ❌ 失敗: <strong>${s.failed}</strong>件 /
        ⏳ 処理中: <strong>${s.pending}</strong>件
      `;
    }
  } else if (message.action === 'contactSearchStep') {
    const el = document.getElementById('contactSearchCurrentUrl');
    if (el) el.textContent = `${message.label}  ―  ${message.url}`;
    // Main タブの同要素も更新
    const elMain = document.getElementById('contactSearchCurrentUrlMain');
    if (elMain) elMain.textContent = `${message.label}  ―  ${message.url}`;

  } else if (message.action === 'batchPhaseUpdate') {
    { const _s_batchStatus = document.getElementById('batchStatus'); if (_s_batchStatus) _s_batchStatus.style.display = 'block'; }

    if (message.phase === 'finding_contacts') {
      { const _s_findingContactsPhase = document.getElementById('findingContactsPhase'); if (_s_findingContactsPhase) _s_findingContactsPhase.style.display = 'block'; }
      { const _s_openingTabsPhase = document.getElementById('openingTabsPhase'); if (_s_openingTabsPhase) _s_openingTabsPhase.style.display = 'none'; }

      const total = message.total || 0;
      const processed = message.processed || 0;
      const validCount = message.validCount || 0;
      const skippedCount = message.skippedCount || 0;

      { const _el_contactSearchProgress = document.getElementById('contactSearchProgress'); if (_el_contactSearchProgress) _el_contactSearchProgress.textContent = `${processed}/${total}`; }
      { const _el_validUrlCount = document.getElementById('validUrlCount'); if (_el_validUrlCount) _el_validUrlCount.textContent = validCount; }
      { const _el_skippedUrlCount = document.getElementById('skippedUrlCount'); if (_el_skippedUrlCount) _el_skippedUrlCount.textContent = skippedCount; }

      const percentage = total > 0 ? (processed / total) * 100 : 0;
      { const _s_contactSearchBar = document.getElementById('contactSearchBar'); if (_s_contactSearchBar) _s_contactSearchBar.style.width = `${percentage}%`; }

      // 現在処理中のURLとステップを表示
      const curUrl = message.currentUrl || '';
      const curStep = message.currentStep || '';
      if (curUrl) {
        const el = document.getElementById('contactSearchCurrentUrl');
        if (el) el.textContent = curStep ? `${curStep}  ―  ${curUrl}` : curUrl;
      }
      { const _el_batchSummaryText = document.getElementById('batchSummaryText'); if (_el_batchSummaryText) _el_batchSummaryText.textContent = `🔍 検索中... ${processed}/${total}件処理済み`; }
    } else if (message.phase === 'ready') {
      { const _s_findingContactsPhase = document.getElementById('findingContactsPhase'); if (_s_findingContactsPhase) _s_findingContactsPhase.style.display = 'none'; }
      { const _s_openingTabsPhase = document.getElementById('openingTabsPhase'); if (_s_openingTabsPhase) _s_openingTabsPhase.style.display = 'block'; }

      const validCount = message.validCount || 0;
      const skippedCount = message.skippedCount || 0;

      if (skippedCount > 0) {
        { const _ml_batchSummaryText = document.getElementById('batchSummaryText'); if (_ml_batchSummaryText) _ml_batchSummaryText.innerHTML = `✅ 有効: <strong>${validCount}</strong>件 / ⏭️ スキップ: <strong>${skippedCount}</strong>件 (お問合せページなし)`; }
      } else {
        { const _el_batchSummaryText = document.getElementById('batchSummaryText'); if (_el_batchSummaryText) _el_batchSummaryText.innerHTML = `✅ 有効: <strong>${validCount}</strong>件`; }
      }

      if (validCount > 0) {
        showStatus(`🎯 ${validCount}件のお問合せページを発見！タブを開きます...`, 'success');
      } else {
        showStatus(`⚠️ お問合せページが見つかりませんでした`, 'error');
      }
    }
  } else if (message.action === 'batchComplete') {
    { const _el_startBatch = document.getElementById('startBatch'); if (_el_startBatch) _el_startBatch.disabled = false; }
    { const _el_nextBatch = document.getElementById('nextBatch'); if (_el_nextBatch) _el_nextBatch.disabled = true; }
    { const _el_stopBatch = document.getElementById('stopBatch'); if (_el_stopBatch) _el_stopBatch.disabled = true; }

    stopBatchStatusInterval();

    // Clear saved URLs on completion
    chrome.storage.local.remove(['batchUrls']);

    const validCount = message.validCount || 0;
    const skipped = message.skipped || 0;
    const completed = message.completed || 0;

    if (validCount === 0) {
      showStatus(`⚠️ お問合せページが見つかりませんでした (${skipped}件スキップ)`, 'error');
    } else {
      showStatus(`✅ バッチ完了: ${validCount}件処理 (${skipped}件スキップ)`, 'success');
    }

    { const _ml_batchSummaryText = document.getElementById('batchSummaryText'); if (_ml_batchSummaryText) _ml_batchSummaryText.innerHTML = `完了: <strong>${completed}</strong>件送信 / スキップ: <strong>${skipped}</strong>件`; }
  }
});

// Stop batch status interval
function stopBatchStatusInterval() {
  if (batchStatusInterval) {
    clearInterval(batchStatusInterval);
    batchStatusInterval = null;
  }
}

// =============================================================================
// TAB SYSTEM
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(tabId).classList.add('active');
      // 検証ダッシュボードタブを開いたら自動ロード
      if (tabId === 'verifyDashTab') loadVerifyDashboard();
    });
  });

  // Variable insertion buttons
  document.querySelectorAll('.var-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const textarea = document.getElementById('tplBody');
      const v = btn.dataset.var;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.value = textarea.value.slice(0, start) + v + textarea.value.slice(end);
      textarea.selectionStart = textarea.selectionEnd = start + v.length;
      textarea.focus();
    });
  });

  // Load template
  loadTemplate();

  // Save template
  document.getElementById('saveTpl').addEventListener('click', saveTemplate);
  document.getElementById('resetTpl').addEventListener('click', resetTemplate);

});

const DEFAULT_TPL_BODY = `突然のご連絡失礼いたします。{{担当者名}}と申します。
{{会社名}}様の{{商品名}}を拝見し、{{都道府県}}でご活躍されていることを知りご連絡いたしました。
弊社では{{自社説明}}をご提供しております。ぜひ一度お話しできればと思いご連絡差し上げました。
何卒よろしくお願いいたします。`;

function loadTemplate() {
  chrome.storage.sync.get(['tplSubject', 'tplBody', 'tplSelfDesc'], data => {
    document.getElementById('tplSubject').value = data.tplSubject || '{{会社名}}様へのご提案';
    document.getElementById('tplBody').value = data.tplBody || DEFAULT_TPL_BODY;
    document.getElementById('tplSelfDesc').value = data.tplSelfDesc || '';
  });
}

function saveTemplate() {
  const subj = document.getElementById('tplSubject').value;
  const body = document.getElementById('tplBody').value;
  const selfDesc = document.getElementById('tplSelfDesc').value;
  chrome.storage.sync.set({ tplSubject: subj, tplBody: body, tplSelfDesc: selfDesc }, () => {
    const st = document.getElementById('tplStatus');
    st.textContent = '✅ 保存しました';
    st.className = 'status status-success show';
    setTimeout(() => st.classList.remove('show'), 2000);
  });
}

function resetTemplate() {
  document.getElementById('tplSubject').value = '{{会社名}}様へのご提案';
  document.getElementById('tplBody').value = DEFAULT_TPL_BODY;
  document.getElementById('tplSelfDesc').value = '';
}

function showProcessStatus(text, type) {
  const el = document.getElementById('processStatus');
  el.textContent = text;
  el.className = 'show';
  if (type === 'error') el.style.background = '#fce8e6', el.style.color = '#c5221f';
  else if (type === 'success') el.style.background = '#e6f4ea', el.style.color = '#137333';
  else el.style.background = '#e8f0fe', el.style.color = '#1967d2';
}

let processStatusInterval = null;
function startProcessStatusPolling() {
  if (processStatusInterval) clearInterval(processStatusInterval);
  processStatusInterval = setInterval(async () => {
    const data = await chrome.storage.local.get('processStatus');
    const s = data.processStatus;
    if (!s) return;
    const isError = s.startsWith('❌');
    const isDone = s.startsWith('✅');
    showProcessStatus(s, isError ? 'error' : isDone ? 'success' : 'info');
    if (isError || isDone) {
      clearInterval(processStatusInterval);
      processStatusInterval = null;
    }
  }, 500);
}

// =============================================================================
// BATCH MAIN TAB - シンプル版（MutationObserverなし）
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // 保存済みURLをロード
  chrome.storage.local.get('batchUrls', d => {
    const el = document.getElementById('batchUrlsMain');
    if (el && d.batchUrls) el.value = d.batchUrls;
  });

  // textarea 変更時に自動保存
  const _ta = document.getElementById('batchUrlsMain');
  if (_ta) {
    _ta.addEventListener('input', () => {
      chrome.storage.local.set({ batchUrls: _ta.value });
    });
  }

  // ポップアップ復帰時: バッチ実行中なら状態を復元してポーリング再開
  chrome.runtime.sendMessage({ action: 'getBatchStatus' }, status => {
    if (chrome.runtime.lastError || !status) return;
    if (status.isRunning) {
      console.log('[Popup] Batch is running, restoring UI state...');
      const startBtn = document.getElementById('startBatchMain');
      const nextBtn  = document.getElementById('nextBatchMain');
      const stopBtn  = document.getElementById('stopBatchMain');
      if (startBtn) startBtn.disabled = true;
      if (nextBtn)  nextBtn.disabled  = false;
      if (stopBtn)  stopBtn.disabled  = false;
      const statusDiv = document.getElementById('batchStatusMain');
      if (statusDiv) statusDiv.style.display = 'block';
      const fp = document.getElementById('findingContactsPhaseMain');
      const op = document.getElementById('openingTabsPhaseMain');
      const st = document.getElementById('batchSummaryTextMain');
      if (status.processingPhase === 'finding_contacts') {
        if (fp) fp.style.display = 'block';
        if (op) op.style.display = 'none';
        const done = (status.validCount||0) + (status.skippedCount||0);
        if (st) st.textContent = '🔍 コンタクトページ検索中... ' + done + '/' + (status.total||0) + '件';
      } else if (status.processingPhase === 'running' || status.processingPhase === 'opening_tabs') {
        if (fp) fp.style.display = 'none';
        if (op) op.style.display = 'block';
        if (st) st.textContent = '📨 タブ送信中... ' + (status.currentIndex||0) + '/' + (status.validCount||0) + '件';
      }
      startBatchMainPolling();
    }
  });

  // バッチ開始（二重登録防止）
  const _startBtn = document.getElementById('startBatchMain');
  if (_startBtn && !_startBtn._bound) {
  _startBtn._bound = true;
  _startBtn.addEventListener('click', async () => {
    try {
    const urlsText = document.getElementById('batchUrlsMain')?.value?.trim() || '';
    if (!urlsText) { alert('URLを入力してください'); return; }

    const entries = urlsText.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 2 && parts[1].startsWith('http')) {
        return { companyName: parts[0], url: parts[1], fax: parts[2]||'', prefecture: parts[3]||'', city: parts[4]||'' };
      }
      if (line.startsWith('http')) return { url: line, companyName: '', fax: '', prefecture: '', city: '' };
      return null;
    }).filter(e => e && e.url);

    if (entries.length === 0) { alert('有効なURLがありません'); return; }

    const tabsPerBatch = 20;
    const autoClose = document.getElementById('autoCloseEnabledMain')?.checked ?? true;
    console.log('[Batch] entries:', entries.length, 'tabsPerBatch:', tabsPerBatch);
    let profile;
    try {
      profile = await getCurrentProfileWithTemplate();
      console.log('[Batch] profile loaded:', profile.name, profile.email);
    } catch(pe) {
      alert('プロフィール取得エラー: ' + pe.message);
      return;
    }

    await chrome.storage.local.set({ batchUrls: urlsText, batchAutoCloseEnabled: autoClose });

    console.log('[Batch] Sending startBatch message...');
    const resp = await chrome.runtime.sendMessage({
      action: 'startBatch',
      urls: entries.map(e => e.url),
      entries: entries,
      profile: profile,
      tabsPerBatch: tabsPerBatch,
      autoCloseEnabled: autoClose
    });
    console.log('[Batch] startBatch response:', resp);
    if (!resp || !resp.success) {
      alert('バッチ開始失敗: ' + JSON.stringify(resp));
      return;
    }

    document.getElementById('startBatchMain').disabled = true;
    document.getElementById('nextBatchMain').disabled = false;
    document.getElementById('stopBatchMain').disabled = false;
    // 即座にステータス表示
    const _sd = document.getElementById('batchStatusMain');
    if (_sd) _sd.style.display = 'block';
    const _fp = document.getElementById('findingContactsPhaseMain');
    if (_fp) _fp.style.display = 'block';
    const _st = document.getElementById('batchSummaryTextMain');
    if (_st) _st.textContent = '🔍 コンタクトページ検索中... 0/' + entries.length + '件';
    startBatchMainPolling();
    } catch(e) { alert('バッチ開始エラー: ' + e.message); console.error(e); }
  });

  document.getElementById('nextBatchMain')?.addEventListener('click', async () => {
    const resp = await chrome.runtime.sendMessage({ action: 'nextBatch' });
    console.log('[Batch] nextBatch:', resp);
  });

  document.getElementById('stopBatchMain')?.addEventListener('click', async () => {
    const resp = await chrome.runtime.sendMessage({ action: 'stopBatch' });
    console.log('[Batch] stopBatch:', resp);
    stopBatchMainPolling();
    document.getElementById('startBatchMain').disabled = false;
    document.getElementById('nextBatchMain').disabled = true;
    document.getElementById('stopBatchMain').disabled = true;
  });

  // リセットボタン: バッチ状態を完全クリア
  document.getElementById('resetBatchMain')?.addEventListener('click', async () => {
    if (!confirm('バッチ進捗をリセットしますか？\n（現在の進捗は消えます）')) return;
    // バックグラウンドに停止を送信
    await chrome.runtime.sendMessage({ action: 'stopBatch' }).catch(() => {});
    // ローカルストレージのバッチ状態を全クリア
    await chrome.storage.local.remove([
      'batchMode', 'batchStateSnapshot', 'batchCurrentIndex',
      'batchValidUrls', 'batchContactPages', 'batchProfile',
      'batchGeneratedMessages', 'processStatus'
    ]);
    stopBatchMainPolling();
    // UIリセット
    document.getElementById('startBatchMain').disabled = false;
    document.getElementById('nextBatchMain').disabled = true;
    document.getElementById('stopBatchMain').disabled = true;
    document.getElementById('batchStatusMain').style.display = 'none';
    const prog = document.getElementById('batchProgressMain');
    if (prog) prog.textContent = '0/0';
    const bar = document.getElementById('batchProgressBarMain');
    if (bar) bar.style.width = '0%';
    console.log('[Batch] Reset complete');
    alert('✅ リセット完了！新しいバッチを開始できます。');
  });
  } // end if !_bound
});

let batchMainPollTimer = null;

function startBatchMainPolling() {
  if (batchMainPollTimer) return;
  batchMainPollTimer = setInterval(syncBatchMainUI, 1000);
}

function stopBatchMainPolling() {
  if (batchMainPollTimer) { clearInterval(batchMainPollTimer); batchMainPollTimer = null; }
}

function syncBatchMainUI() {
  chrome.runtime.sendMessage({ action: 'getBatchStatus' }, status => {
    if (chrome.runtime.lastError || !status) return;

    const show = el => { if (el) el.style.display = 'block'; };
    const hide = el => { if (el) el.style.display = 'none'; };
    const setText = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    const setWidth = (id, pct) => { const e = document.getElementById(id); if (e) e.style.width = pct + '%'; };

    const statusDiv = document.getElementById('batchStatusMain');
    if (statusDiv) statusDiv.style.display = status.isRunning ? 'block' : 'none';

    if (status.processingPhase === 'finding_contacts') {
      show(document.getElementById('findingContactsPhaseMain'));
      hide(document.getElementById('openingTabsPhaseMain'));
      const processed = (status.validCount || 0) + (status.skippedCount || 0);
      const total = status.total || 1;
      setText('contactSearchProgressMain', processed + '/' + total);
      setText('validUrlCountMain', status.validCount || 0);
      setText('skippedUrlCountMain', status.skippedCount || 0);
      setWidth('contactSearchBarMain', Math.round(processed / total * 100));
      setText('batchSummaryTextMain', '🔍 コンタクトページ検索中... ' + processed + '/' + total + '件');
    } else if (status.processingPhase === 'running' || status.processingPhase === 'opening_tabs') {
      hide(document.getElementById('findingContactsPhaseMain'));
      show(document.getElementById('openingTabsPhaseMain'));
      const cur = status.currentIndex || 0;
      const tot = status.validCount || 1;
      const openCnt = status.openTabs || 0;
      setText('batchProgressMain', cur + '/' + tot);
      setText('openTabsCountMain', openCnt);
      setWidth('batchProgressBarMain', Math.round(cur / tot * 100));
      setText('batchSummaryTextMain', '📨 タブ送信中... ' + cur + '/' + tot + '件 (開中: ' + openCnt + ')');
    }

    if (!status.isRunning) {
      stopBatchMainPolling();
      document.getElementById('startBatchMain').disabled = false;
      document.getElementById('nextBatchMain').disabled = true;
      document.getElementById('stopBatchMain').disabled = true;
      setText('batchSummaryTextMain', '✅ バッチ完了 (有効: ' + (status.validCount||0) + '件 / スキップ: ' + (status.skippedCount||0) + '件)');
      const _sd2 = document.getElementById('batchStatusMain');
      if (_sd2) _sd2.style.display = 'none';
    } else if (status.processingPhase === 'idle') {
      // 開始直後・まだフェーズが設定されていない
      setText('batchSummaryTextMain', '🔍 準備中...');
    }
  });
}

// =============================================================================
// LEARNED DATA TAB
// =============================================================================

async function loadLearnedData() {
  const data = await chrome.storage.local.get('learned_forms');
  const learned = data.learned_forms || {};
  const entries = Object.entries(learned);

  document.getElementById('learnedCount').textContent = entries.length;

  const listEl = document.getElementById('learnedList');
  if (entries.length === 0) {
    listEl.innerHTML = '<div style="padding: 12px; text-align: center; color: #999; font-size: 11px;">データなし</div>';
    return;
  }

  // Sort by timestamp descending, show max 20
  entries.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
  const display = entries.slice(0, 20);

  listEl.innerHTML = display.map(([key, val]) => {
    const date = val.timestamp ? new Date(val.timestamp).toLocaleDateString('ja-JP') : '-';
    const mappingCount = val.mappings ? val.mappings.length : 0;
    return `<div style="padding: 8px; border-bottom: 1px solid #f0f0f0; font-size: 11px;">
      <div style="font-weight: 600; color: #1a73e8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(key)}</div>
      <div style="display: flex; justify-content: space-between; color: #666; margin-top: 2px;">
        <span>フィールド: ${mappingCount}</span>
        <span>成功: ${val.successCount || 0}回</span>
        <span>${date}</span>
      </div>
    </div>`;
  }).join('');

  if (entries.length > 20) {
    listEl.innerHTML += `<div style="padding: 8px; text-align: center; color: #999; font-size: 10px;">他 ${entries.length - 20} サイト...</div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Load learned data when tab is shown
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'learnedTab') loadLearnedData();
    });
  });
});

// Clear learned data
document.getElementById('clearLearned')?.addEventListener('click', async () => {
  if (!confirm('学習データを全て削除しますか？')) return;
  await chrome.storage.local.remove(['learned_forms']);
  loadLearnedData();
  showLearnedStatus('✅ 学習データを削除しました', 'success');
});

// Export learned data
document.getElementById('exportLearned')?.addEventListener('click', async () => {
  const data = await chrome.storage.local.get('learned_forms');
  const learned = data.learned_forms || {};
  const json = JSON.stringify(learned, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `learned-forms-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showLearnedStatus(`✅ ${Object.keys(learned).length}件エクスポートしました`, 'success');
});

// Import learned data
document.getElementById('importLearnedFile')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    if (typeof imported !== 'object') throw new Error('Invalid format');
    const data = await chrome.storage.local.get('learned_forms');
    const existing = data.learned_forms || {};
    const merged = { ...existing, ...imported };
    await chrome.storage.local.set({ learned_forms: merged });
    loadLearnedData();
    showLearnedStatus(`✅ ${Object.keys(imported).length}件インポートしました`, 'success');
  } catch (err) {
    showLearnedStatus('❌ インポートに失敗しました: ' + err.message, 'error');
  }
  e.target.value = '';
});

function showLearnedStatus(message, type) {
  const el = document.getElementById('learnedStatus');
  if (!el) return;
  el.textContent = message;
  el.className = `status show status-${type}`;
  setTimeout(() => el.classList.remove('show'), 3000);
}

// =============================================================================
// 検証ダッシュボード
// =============================================================================
async function loadVerifyDashboard() {
  const loading = document.getElementById('verifyDashLoading');
  const empty = document.getElementById('verifyDashEmpty');
  const table = document.getElementById('verifyDashTable');
  const tbody = document.getElementById('verifyDashBody');
  if (!loading || !empty || !table || !tbody) return;

  loading.style.display = 'block';
  empty.style.display = 'none';
  table.style.display = 'none';

  try {
    // 現在のタブのURLを取得
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      loading.style.display = 'none';
      empty.style.display = 'block';
      return;
    }

    const res = await fetch(`https://crawler-worker-teamb.taiichifox.workers.dev/verify-results?url=${encodeURIComponent(tab.url)}&aggregate=true`);
    const data = await res.json();

    loading.style.display = 'none';

    if (!data.success || !data.fields || data.fields.length === 0) {
      empty.style.display = 'block';
      return;
    }

    // テーブルにレンダリング
    tbody.innerHTML = '';
    // 成功率でソート（低い順）
    data.fields.sort((a, b) => a.successRate - b.successRate);

    for (const field of data.fields) {
      const tr = document.createElement('tr');
      const isLowSuccess = field.successRate < 50;
      tr.style.background = isLowSuccess ? '#ffebee' : '';

      const rateColor = field.successRate >= 80 ? '#2e7d32' : field.successRate >= 50 ? '#e65100' : '#c62828';
      const errors = field.commonErrors.join(', ') || '-';

      tr.innerHTML = `
        <td style="padding: 5px 4px; border-bottom: 1px solid #eee; ${isLowSuccess ? 'color: #c62828; font-weight: bold;' : ''}">${field.name}</td>
        <td style="padding: 5px 4px; border-bottom: 1px solid #eee; text-align: center;">${field.totalChecks}</td>
        <td style="padding: 5px 4px; border-bottom: 1px solid #eee; text-align: center; color: ${rateColor}; font-weight: bold;">${field.successRate}%</td>
        <td style="padding: 5px 4px; border-bottom: 1px solid #eee; font-size: 10px; color: #666;">${errors}</td>
      `;
      tbody.appendChild(tr);
    }

    table.style.display = 'table';
  } catch (e) {
    loading.style.display = 'none';
    empty.textContent = 'データの取得に失敗しました';
    empty.style.display = 'block';
  }
}

// 更新ボタン
document.getElementById('refreshVerifyDash')?.addEventListener('click', loadVerifyDashboard);

// =============================================================================
// AGENT TAKEOVER MODE
// =============================================================================

// Toggle switch styling
const takeoverToggle = document.getElementById('takeoverToggle');
const takeoverPanel = document.getElementById('takeoverPanel');
const takeoverSlider = document.getElementById('takeoverSlider');
const takeoverStatusLabel = document.getElementById('takeoverStatusLabel');

takeoverToggle?.addEventListener('change', () => {
  const on = takeoverToggle.checked;
  takeoverPanel.style.display = on ? 'block' : 'none';
  takeoverStatusLabel.textContent = on ? 'ON' : 'OFF';
  takeoverStatusLabel.style.color = on ? '#ff6b35' : '#888';
  takeoverSlider.style.transform = on ? 'translateX(20px)' : 'translateX(0)';
  takeoverSlider.parentElement.previousElementSibling.nextElementSibling.style.background = on ? '#ff6b35' : '#555';
  // Restore state if ON
  if (on) refreshTakeoverState();
});

// CSV parse
function parseTakeoverCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
  const urlIdx = header.indexOf('url');
  const companyIdx = header.indexOf('company_name');
  const categoryIdx = header.indexOf('category');
  if (urlIdx === -1) return [];

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (!cols[urlIdx]) continue;
    rows.push({
      url: cols[urlIdx],
      company_name: companyIdx >= 0 ? (cols[companyIdx] || '') : '',
      category: categoryIdx >= 0 ? (cols[categoryIdx] || '') : ''
    });
  }
  return rows;
}

// CSV file input
document.getElementById('takeoverCsvFile')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const rows = parseTakeoverCsv(text);
  if (rows.length === 0) {
    document.getElementById('takeoverCsvInfo').textContent = '❌ 有効な行が見つかりません（url列が必要）';
    return;
  }
  document.getElementById('takeoverCsvInfo').textContent = `✅ ${rows.length}件読み込み済み`;

  // Save to background
  chrome.runtime.sendMessage({ action: 'TAKEOVER_SET_CSV', rows }, (resp) => {
    if (resp?.success) {
      addTakeoverLog(`CSV読込: ${rows.length}件`);
      refreshTakeoverState();
    }
  });
});

// Refresh takeover state from storage
async function refreshTakeoverState() {
  chrome.runtime.sendMessage({ action: 'GET_NEXT_COMPANY' }, (resp) => {
    if (!resp?.success) return;
    const total = resp.total || 0;
    const idx = resp.done ? total : resp.index;
    document.getElementById('takeoverProgress').textContent = `${idx} / ${total}`;
    const pct = total > 0 ? (idx / total * 100) : 0;
    document.getElementById('takeoverProgressBar').style.width = pct + '%';

    const nextBtn = document.getElementById('takeoverNext');
    const skipBtn = document.getElementById('takeoverSkip');
    if (resp.done) {
      nextBtn.disabled = true;
      skipBtn.disabled = true;
      document.getElementById('takeoverCurrentCompany').textContent = '✅ 全件完了';
    } else {
      nextBtn.disabled = false;
      skipBtn.disabled = false;
      document.getElementById('takeoverCurrentCompany').textContent = resp.current?.company_name || '';
    }
  });
}

// Log helper
const takeoverLogs = [];
function addTakeoverLog(msg) {
  const time = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  takeoverLogs.unshift(`[${time}] ${msg}`);
  if (takeoverLogs.length > 5) takeoverLogs.pop();
  const logEl = document.getElementById('takeoverLog');
  if (logEl) {
    logEl.innerHTML = takeoverLogs.map(l => `<div>${l}</div>`).join('');
  }
}

// 「次の会社へ」ボタン
document.getElementById('takeoverNext')?.addEventListener('click', async () => {
  chrome.runtime.sendMessage({ action: 'GET_NEXT_COMPANY' }, async (resp) => {
    if (!resp?.success || resp.done) {
      addTakeoverLog('全件処理済み');
      return;
    }

    const company = resp.current;
    addTakeoverLog(`開始: ${company.company_name || company.url}`);

    // Get profile from storage
    const profileData = await chrome.storage.sync.get(null);
    const profile = {
      myCompany: profileData.company || '',
      myName: profileData.name || '',
      myEmail: profileData.email || '',
      myTel: profileData.phone || '',
      subject: profileData.subject || 'ご提案のご連絡',
      salesLetter: profileData.message || ''
    };

    // Open URL in active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.update(tab.id, { url: company.url });

    // Wait for page load then send AGENT_TAKEOVER
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'AGENT_TAKEOVER',
            profile,
            options: { confirmBeforeSubmit: true }
          }, (result) => {
            if (result?.needsConfirm) {
              document.getElementById('takeoverConfirm').disabled = false;
              addTakeoverLog(`入力完了: ${company.company_name || company.url} → 送信待ち`);
            } else if (result?.error) {
              addTakeoverLog(`⚠ ${company.company_name}: ${result.error}`);
            }
            refreshTakeoverState();
          });
        }, 2500);
      }
    });
  });
});

// 「送信確認」ボタン
document.getElementById('takeoverConfirm')?.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: 'CONFIRM_SUBMIT' }, (result) => {
    document.getElementById('takeoverConfirm').disabled = true;
    if (result?.submitted) {
      addTakeoverLog('✅ 送信完了');
      chrome.runtime.sendMessage({ action: 'MARK_DONE', status: 'done' }, () => {
        refreshTakeoverState();
      });
    } else {
      addTakeoverLog('❌ 送信失敗: ' + (result?.error || 'unknown'));
    }
  });
});

// 「スキップ」ボタン
document.getElementById('takeoverSkip')?.addEventListener('click', () => {
  addTakeoverLog('⏭ スキップ');
  document.getElementById('takeoverConfirm').disabled = true;
  chrome.runtime.sendMessage({ action: 'MARK_DONE', status: 'skipped' }, () => {
    refreshTakeoverState();
  });
});

// 「リセット」ボタン
document.getElementById('takeoverReset')?.addEventListener('click', () => {
  chrome.storage.local.remove(['takeoverQueue', 'takeoverIndex', 'takeoverResults'], () => {
    document.getElementById('takeoverProgress').textContent = '0 / 0';
    document.getElementById('takeoverProgressBar').style.width = '0%';
    document.getElementById('takeoverCurrentCompany').textContent = '';
    document.getElementById('takeoverConfirm').disabled = true;
    document.getElementById('takeoverNext').disabled = true;
    document.getElementById('takeoverSkip').disabled = true;
    document.getElementById('takeoverCsvInfo').textContent = '';
    takeoverLogs.length = 0;
    document.getElementById('takeoverLog').innerHTML = '<div style="color: #555;">ログなし</div>';
    addTakeoverLog('リセット完了');
  });
});
