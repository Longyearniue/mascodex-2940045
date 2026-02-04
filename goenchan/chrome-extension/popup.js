// Load profile from storage on popup open
document.addEventListener('DOMContentLoaded', async () => {
  loadProfile();
  checkTrainingMode();
});

// Load profile data
async function loadProfile() {
  const data = await chrome.storage.sync.get(['profile']);
  if (data.profile) {
    document.getElementById('company').value = data.profile.company || '';
    document.getElementById('name').value = data.profile.name || '';
    document.getElementById('email').value = data.profile.email || '';
    document.getElementById('phone').value = data.profile.phone || '';
    document.getElementById('message').value = data.profile.message || '';
  }
}

// Save profile
document.getElementById('saveProfile').addEventListener('click', async () => {
  const profile = {
    company: document.getElementById('company').value,
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    message: document.getElementById('message').value
  };

  await chrome.storage.sync.set({ profile });
  showStatus('Profile saved successfully!', 'success');
});

// Auto Fill button
document.getElementById('autoFill').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Get profile
  const data = await chrome.storage.sync.get(['profile']);
  const profile = data.profile || {};

  // Send message to content script
  chrome.tabs.sendMessage(tab.id, {
    action: 'autoFill',
    profile: profile
  }, (response) => {
    if (chrome.runtime.lastError) {
      showStatus('Error: Could not connect to page. Please refresh the page.', 'error');
      return;
    }

    if (response && response.success) {
      displayResults(response.results);
      showStatus(`Filled ${response.results.length} field(s)!`, 'success');
    } else {
      showStatus('No form fields detected on this page.', 'info');
    }
  });
});

// Training Mode toggle
document.getElementById('trainingMode').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Get current training mode state
  const data = await chrome.storage.local.get(['trainingMode']);
  const isActive = data.trainingMode || false;
  const newState = !isActive;

  // Save new state
  await chrome.storage.local.set({ trainingMode: newState });

  // Update UI
  updateTrainingModeUI(newState);

  // Send message to content script
  chrome.tabs.sendMessage(tab.id, {
    action: 'toggleTrainingMode',
    enabled: newState
  }, (response) => {
    if (chrome.runtime.lastError) {
      showStatus('Error: Could not connect to page. Please refresh the page.', 'error');
      return;
    }

    if (newState) {
      showStatus('Training mode activated! Click any form field to map it.', 'info');
    } else {
      showStatus('Training mode deactivated.', 'info');
    }
  });
});

// Clear mappings for current domain
document.getElementById('clearMappings').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = new URL(tab.url);
  const domain = url.hostname;

  // Get all mappings
  const data = await chrome.storage.sync.get(['fieldMappings']);
  const mappings = data.fieldMappings || {};

  // Delete mappings for this domain
  delete mappings[domain];

  // Save back
  await chrome.storage.sync.set({ fieldMappings: mappings });

  showStatus(`Cleared all mappings for ${domain}`, 'success');
});

// Check training mode state
async function checkTrainingMode() {
  const data = await chrome.storage.local.get(['trainingMode']);
  const isActive = data.trainingMode || false;
  updateTrainingModeUI(isActive);
}

// Update training mode UI
function updateTrainingModeUI(isActive) {
  const btn = document.getElementById('trainingMode');
  const hint = document.getElementById('trainingHint');

  if (isActive) {
    btn.classList.add('active');
    hint.classList.add('show');
  } else {
    btn.classList.remove('active');
    hint.classList.remove('show');
  }
}

// Display detection results
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

    item.innerHTML = `
      <span class="result-field">${result.fieldType}</span>
      <span class="result-confidence ${confidenceClass}">${confidence}%</span>
      <div style="font-size: 11px; color: #888; margin-top: 2px;">
        ${result.selector || 'Auto-detected'}
      </div>
    `;

    listDiv.appendChild(item);
  });

  resultsDiv.classList.add('show');
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

// Listen for messages from content script (training mode field selection)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'trainingFieldSelected') {
    showStatus(`Mapped field to: ${message.fieldType}`, 'success');
  }
});
