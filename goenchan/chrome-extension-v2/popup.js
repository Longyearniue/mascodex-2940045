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
      document.getElementById('batchUrls').value = storage.batchUrls;
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
      document.getElementById('startBatch').disabled = true;
      document.getElementById('nextBatch').disabled = false;
      document.getElementById('stopBatch').disabled = false;
      document.getElementById('batchStatus').style.display = 'block';

      // Show appropriate phase
      if (status.processingPhase === 'finding_contacts') {
        document.getElementById('findingContactsPhase').style.display = 'block';
        document.getElementById('openingTabsPhase').style.display = 'none';

        const processed = status.validCount + status.skippedCount;
        document.getElementById('contactSearchProgress').textContent = `${processed}/${status.total}`;
        document.getElementById('validUrlCount').textContent = status.validCount;
        document.getElementById('skippedUrlCount').textContent = status.skippedCount;

        const percent = status.total > 0 ? (processed / status.total) * 100 : 0;
        document.getElementById('contactSearchBar').style.width = `${percent}%`;
      } else if (status.processingPhase === 'running' || status.processingPhase === 'ready') {
        document.getElementById('findingContactsPhase').style.display = 'none';
        document.getElementById('openingTabsPhase').style.display = 'block';

        document.getElementById('batchProgress').textContent = `${status.currentIndex}/${status.validCount}`;
        document.getElementById('openTabsCount').textContent = status.openTabs;

        const percent = status.validCount > 0 ? (status.currentIndex / status.validCount) * 100 : 0;
        document.getElementById('batchProgressBar').style.width = `${percent}%`;
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

  document.getElementById('batchModeToggle').addEventListener('click', () => {
    const content = document.getElementById('batchModeContent');
    const toggle = document.getElementById('batchModeToggle');
    content.classList.toggle('show');
    toggle.textContent = content.classList.contains('show') ? '▼ Batch Mode (一括送信)' : '▶ Batch Mode (一括送信)';
  });

  // Auto-save autoCloseEnabled setting when changed
  document.getElementById('autoCloseEnabled').addEventListener('change', async (e) => {
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
  const data = await chrome.storage.sync.get(['profile', 'autoFillEnabled']);
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
    company_kana: document.getElementById('company_kana').value,
    name: document.getElementById('name').value,
    name_kana: document.getElementById('name_kana').value,
    last_name: document.getElementById('last_name').value,
    first_name: document.getElementById('first_name').value,
    last_name_kana: document.getElementById('last_name_kana').value,
    first_name_kana: document.getElementById('first_name_kana').value,
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
        response = await fetch('https://goenchan-worker.taiichifox.workers.dev/bulk-crawler', {
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
    const response = await fetch('https://goenchan-worker.taiichifox.workers.dev/shared-mappings', {
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
  const profile = getCurrentProfile();
  // 原稿タブのテンプレートをmessageとして使用
  const data = await chrome.storage.sync.get(['tplBody', 'tplSubject', 'tplSelfDesc']);
  if (data.tplBody) profile.message = data.tplBody;
  if (data.tplSubject) profile.subject = profile.subject || data.tplSubject;
  return profile;
}

// Start batch button handler
document.getElementById('startBatch').addEventListener('click', async () => {
  const urlsText = document.getElementById('batchUrls').value.trim();
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
  const autoCloseEnabled = document.getElementById('autoCloseEnabled').checked;
  await chrome.storage.local.set({
    batchUrls: urlsText,
    batchAutoCloseEnabled: autoCloseEnabled
  });

  const profile = await getCurrentProfileWithTemplate();
  const tabsPerBatch = parseInt(document.getElementById('tabsPerBatch').value);

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
    document.getElementById('startBatch').disabled = true;
    document.getElementById('nextBatch').disabled = false;
    document.getElementById('stopBatch').disabled = false;
    document.getElementById('batchStatus').style.display = 'block';

    startBatchStatusInterval();
    showStatus(`🚀 バッチ開始: ${urls.length}件のURLを処理します`, 'success');
  } catch (error) {
    console.error('Failed to start batch:', error);
    showStatus('バッチ開始に失敗しました', 'error');
  }
});

// Next batch button handler
document.getElementById('nextBatch').addEventListener('click', async () => {
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
document.getElementById('stopBatch').addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ action: 'stopBatch' });

    // Update UI
    document.getElementById('startBatch').disabled = false;
    document.getElementById('nextBatch').disabled = true;
    document.getElementById('stopBatch').disabled = true;
    document.getElementById('batchStatus').style.display = 'none';

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

        document.getElementById('batchProgress').textContent = `${currentIndex}/${validCount}`;
        document.getElementById('openTabsCount').textContent = openTabs;

        const percentage = validCount > 0 ? (currentIndex / validCount) * 100 : 0;
        document.getElementById('batchProgressBar').style.width = `${percentage}%`;

        if (skippedCount > 0) {
          summaryText.innerHTML = `✅ 有効: <strong>${validCount}</strong>件 / ⏭️ スキップ: <strong>${skippedCount}</strong>件 (お問合せページなし)`;
        } else {
          summaryText.innerHTML = `✅ 有効: <strong>${validCount}</strong>件`;
        }
      }

      if (!status.isRunning && phase === 'idle' && (validCount > 0 || skippedCount > 0)) {
        // Batch complete
        document.getElementById('startBatch').disabled = false;
        document.getElementById('nextBatch').disabled = true;
        document.getElementById('stopBatch').disabled = true;
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
  } else if (message.action === 'batchPhaseUpdate') {
    document.getElementById('batchStatus').style.display = 'block';

    if (message.phase === 'finding_contacts') {
      document.getElementById('findingContactsPhase').style.display = 'block';
      document.getElementById('openingTabsPhase').style.display = 'none';

      const total = message.total || 0;
      const processed = message.processed || 0;
      const validCount = message.validCount || 0;
      const skippedCount = message.skippedCount || 0;

      document.getElementById('contactSearchProgress').textContent = `${processed}/${total}`;
      document.getElementById('validUrlCount').textContent = validCount;
      document.getElementById('skippedUrlCount').textContent = skippedCount;

      const percentage = total > 0 ? (processed / total) * 100 : 0;
      document.getElementById('contactSearchBar').style.width = `${percentage}%`;

      document.getElementById('batchSummaryText').textContent = '🔍 お問合せページを検索中...';
    } else if (message.phase === 'ready') {
      document.getElementById('findingContactsPhase').style.display = 'none';
      document.getElementById('openingTabsPhase').style.display = 'block';

      const validCount = message.validCount || 0;
      const skippedCount = message.skippedCount || 0;

      if (skippedCount > 0) {
        document.getElementById('batchSummaryText').innerHTML =
          `✅ 有効: <strong>${validCount}</strong>件 / ⏭️ スキップ: <strong>${skippedCount}</strong>件 (お問合せページなし)`;
      } else {
        document.getElementById('batchSummaryText').innerHTML = `✅ 有効: <strong>${validCount}</strong>件`;
      }

      if (validCount > 0) {
        showStatus(`🎯 ${validCount}件のお問合せページを発見！タブを開きます...`, 'success');
      } else {
        showStatus(`⚠️ お問合せページが見つかりませんでした`, 'error');
      }
    }
  } else if (message.action === 'batchComplete') {
    document.getElementById('startBatch').disabled = false;
    document.getElementById('nextBatch').disabled = true;
    document.getElementById('stopBatch').disabled = true;

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

    document.getElementById('batchSummaryText').innerHTML =
      `完了: <strong>${completed}</strong>件送信 / スキップ: <strong>${skipped}</strong>件`;
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

  // processUrl button
  document.getElementById('processUrlBtn').addEventListener('click', async () => {
    const url = document.getElementById('targetUrl').value.trim();
    if (!url) { showProcessStatus('❌ URLを入力してください', 'error'); return; }
    const storage = await chrome.storage.sync.get(['profile', 'tplSubject', 'tplBody', 'tplSelfDesc']);
    const profile = storage.profile || {};
    const template = {
      subject: storage.tplSubject || '{{会社名}}様へのご提案',
      body: storage.tplBody || DEFAULT_TPL_BODY,
      selfDesc: storage.tplSelfDesc || ''
    };
    showProcessStatus('⏳ 処理を開始しています...', 'info');
    chrome.runtime.sendMessage({ action: 'processUrl', url, profile, template });
    startProcessStatusPolling();
  });
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

  // バッチ開始
  document.getElementById('startBatchMain')?.addEventListener('click', async () => {
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

    const tabsPerBatch = parseInt(document.getElementById('tabsPerBatchMain')?.value || '20');
    const autoClose = document.getElementById('autoCloseEnabledMain')?.checked ?? true;
    const profile = await getCurrentProfileWithTemplate();

    await chrome.storage.local.set({ batchUrls: urlsText, batchAutoCloseEnabled: autoClose });

    await chrome.runtime.sendMessage({
      action: 'startBatch',
      urls: entries.map(e => e.url),
      entries: entries,
      profile: profile,
      tabsPerBatch: tabsPerBatch,
      autoCloseEnabled: autoClose
    });

    document.getElementById('startBatchMain').disabled = true;
    document.getElementById('nextBatchMain').disabled = false;
    document.getElementById('stopBatchMain').disabled = false;
    startBatchMainPolling();
  });

  document.getElementById('nextBatchMain')?.addEventListener('click', () => {
    document.getElementById('nextBatch')?.click();
  });

  document.getElementById('stopBatchMain')?.addEventListener('click', () => {
    document.getElementById('stopBatch')?.click();
    stopBatchMainPolling();
  });
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
  // batchStatusMain の表示はsrcに合わせる
  const srcStatus = document.getElementById('batchStatus');
  const dstStatus = document.getElementById('batchStatusMain');
  if (srcStatus && dstStatus) dstStatus.style.display = srcStatus.style.display;

  const copyText = (srcId, dstId) => {
    const s = document.getElementById(srcId);
    const d = document.getElementById(dstId);
    if (s && d) d.textContent = s.textContent;
  };
  const copyStyle = (srcId, dstId, prop) => {
    const s = document.getElementById(srcId);
    const d = document.getElementById(dstId);
    if (s && d) d.style[prop] = s.style[prop];
  };

  // 検索フェーズ
  const findPhase = document.getElementById('findingContactsPhase');
  const findPhaseMain = document.getElementById('findingContactsPhaseMain');
  if (findPhase && findPhaseMain) findPhaseMain.style.display = findPhase.style.display;
  copyText('contactSearchProgress', 'contactSearchProgressMain');
  copyText('validUrlCount', 'validUrlCountMain');
  copyText('skippedUrlCount', 'skippedUrlCountMain');
  copyStyle('contactSearchBar', 'contactSearchBarMain', 'width');

  // タブフェーズ
  const tabPhase = document.getElementById('openingTabsPhase');
  const tabPhaseMain = document.getElementById('openingTabsPhaseMain');
  if (tabPhase && tabPhaseMain) tabPhaseMain.style.display = tabPhase.style.display;
  copyText('batchProgress', 'batchProgressMain');
  copyText('openTabsCount', 'openTabsCountMain');
  copyStyle('batchProgressBar', 'batchProgressBarMain', 'width');
  copyText('batchSummaryText', 'batchSummaryTextMain');

  // ボタン状態
  const startBtn = document.getElementById('startBatch');
  const nextBtn = document.getElementById('nextBatch');
  const stopBtn = document.getElementById('stopBatch');
  const sm = document.getElementById('startBatchMain');
  const nm = document.getElementById('nextBatchMain');
  const stm = document.getElementById('stopBatchMain');
  if (sm && startBtn) sm.disabled = startBtn.disabled;
  if (nm && nextBtn) nm.disabled = nextBtn.disabled;
  if (stm && stopBtn) stm.disabled = stopBtn.disabled;

  // 完了したらポーリング停止
  if (startBtn && !startBtn.disabled) stopBatchMainPolling();
}
