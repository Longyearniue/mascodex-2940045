// Background script for batch mode tab management

// Store batch state
let batchState = {
  isRunning: false,
  urls: [],
  currentIndex: 0,
  openTabs: [],
  completedTabs: [],
  tabsPerBatch: 10,
  profile: null
};

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startBatch') {
    startBatchProcess(message.urls, message.profile, message.tabsPerBatch || 10);
    sendResponse({ success: true });
  } else if (message.action === 'getBatchStatus') {
    sendResponse({
      isRunning: batchState.isRunning,
      total: batchState.urls.length,
      currentIndex: batchState.currentIndex,
      openTabs: batchState.openTabs.length,
      completedTabs: batchState.completedTabs.length
    });
  } else if (message.action === 'stopBatch') {
    stopBatchProcess();
    sendResponse({ success: true });
  } else if (message.action === 'nextBatch') {
    openNextBatch();
    sendResponse({ success: true });
  } else if (message.action === 'tabCompleted') {
    markTabCompleted(sender.tab.id);
    sendResponse({ success: true });
  }
  return true;
});

// Start batch process
async function startBatchProcess(urls, profile, tabsPerBatch) {
  console.log('[Batch] Starting batch process with', urls.length, 'URLs');

  batchState = {
    isRunning: true,
    urls: urls,
    currentIndex: 0,
    openTabs: [],
    completedTabs: [],
    tabsPerBatch: tabsPerBatch,
    profile: profile
  };

  // Store profile for content scripts to access
  await chrome.storage.local.set({
    batchProfile: profile,
    batchMode: true
  });

  // Open first batch
  await openNextBatch();
}

// Open next batch of tabs
async function openNextBatch() {
  if (!batchState.isRunning) return;

  // Close any remaining open tabs from previous batch
  for (const tabId of batchState.openTabs) {
    try {
      await chrome.tabs.remove(tabId);
    } catch (e) {
      // Tab might already be closed
    }
  }
  batchState.openTabs = [];

  const startIndex = batchState.currentIndex;
  const endIndex = Math.min(startIndex + batchState.tabsPerBatch, batchState.urls.length);

  if (startIndex >= batchState.urls.length) {
    console.log('[Batch] All URLs processed');
    batchState.isRunning = false;
    await chrome.storage.local.set({ batchMode: false });

    // Notify popup
    chrome.runtime.sendMessage({
      action: 'batchComplete',
      total: batchState.urls.length,
      completed: batchState.completedTabs.length
    });
    return;
  }

  console.log(`[Batch] Opening tabs ${startIndex + 1} to ${endIndex} of ${batchState.urls.length}`);

  // Open tabs for this batch
  for (let i = startIndex; i < endIndex; i++) {
    const url = batchState.urls[i];
    try {
      const tab = await chrome.tabs.create({
        url: url,
        active: i === startIndex // Only first tab is active
      });
      batchState.openTabs.push(tab.id);

      // Store tab info
      await chrome.storage.local.set({
        [`batchTab_${tab.id}`]: {
          url: url,
          index: i,
          status: 'loading'
        }
      });
    } catch (e) {
      console.error('[Batch] Error opening tab:', url, e);
    }
  }

  batchState.currentIndex = endIndex;
}

// Mark a tab as completed (form submitted)
function markTabCompleted(tabId) {
  if (batchState.openTabs.includes(tabId)) {
    batchState.completedTabs.push(tabId);
    console.log(`[Batch] Tab ${tabId} completed. ${batchState.completedTabs.length}/${batchState.urls.length} done`);
  }
}

// Stop batch process
async function stopBatchProcess() {
  console.log('[Batch] Stopping batch process');
  batchState.isRunning = false;

  // Close all open tabs
  for (const tabId of batchState.openTabs) {
    try {
      await chrome.tabs.remove(tabId);
    } catch (e) {
      // Tab might already be closed
    }
  }

  batchState.openTabs = [];
  await chrome.storage.local.set({ batchMode: false });
}

// Listen for tab close events
chrome.tabs.onRemoved.addListener((tabId) => {
  const index = batchState.openTabs.indexOf(tabId);
  if (index > -1) {
    batchState.openTabs.splice(index, 1);
  }
});

// Listen for tab updates to inject auto-fill
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && batchState.openTabs.includes(tabId)) {
    // Tab loaded, trigger auto-fill
    const storage = await chrome.storage.local.get(['batchMode', 'batchProfile']);

    if (storage.batchMode && storage.batchProfile) {
      console.log('[Batch] Tab loaded, triggering auto-fill:', tabId);

      // Wait a bit for page to fully render
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tabId, {
            action: 'batchAutoFill',
            profile: storage.batchProfile
          });
        } catch (e) {
          console.error('[Batch] Error sending auto-fill message:', e);
        }
      }, 1500);
    }
  }
});

console.log('[Batch] Background script loaded');
