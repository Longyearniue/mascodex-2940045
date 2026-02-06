// Background script for batch mode tab management

// Worker API endpoint
const WORKER_API_URL = 'https://crawler-worker-teamb.taiichifox.workers.dev';

// Store batch state
let batchState = {
  isRunning: false,
  urls: [],
  currentIndex: 0,
  openTabs: [],
  completedTabs: [],
  tabsPerBatch: 10,
  profile: null,
  generatedMessages: {} // URL -> generated message
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
      completedTabs: batchState.completedTabs.length,
      generatedMessages: Object.keys(batchState.generatedMessages).length
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
    profile: profile,
    generatedMessages: {}
  };

  // Store profile for content scripts to access
  await chrome.storage.local.set({
    batchProfile: profile,
    batchMode: true,
    batchGeneratedMessages: {}
  });

  // Pre-generate messages for all URLs (in background)
  generateMessagesForBatch(urls);

  // Open first batch
  await openNextBatch();
}

// Generate custom messages using Worker API
async function generateMessagesForBatch(urls) {
  console.log('[Batch] Starting message generation for', urls.length, 'URLs');

  for (const url of urls) {
    if (!batchState.isRunning) break;

    try {
      console.log('[Batch] Generating message for:', url);

      const response = await fetch(`${WORKER_API_URL}/sales-letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.sales_letter || data.salesLetter) {
          batchState.generatedMessages[url] = data.sales_letter || data.salesLetter;
          console.log('[Batch] Message generated for:', url);

          // Also store in chrome.storage for persistence
          const stored = await chrome.storage.local.get(['batchGeneratedMessages']);
          const messages = stored.batchGeneratedMessages || {};
          messages[url] = batchState.generatedMessages[url];
          await chrome.storage.local.set({ batchGeneratedMessages: messages });
        }
      }
    } catch (error) {
      console.error('[Batch] Error generating message for:', url, error);
    }

    // Small delay between API calls
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('[Batch] Message generation complete');
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
    const storage = await chrome.storage.local.get(['batchMode', 'batchProfile', 'batchGeneratedMessages']);

    if (storage.batchMode && storage.batchProfile) {
      console.log('[Batch] Tab loaded, triggering auto-fill:', tabId, tab.url);

      // Wait a bit for page to fully render
      setTimeout(async () => {
        try {
          // Get the original URL for this tab (before any redirects)
          const tabInfo = await chrome.storage.local.get([`batchTab_${tabId}`]);
          const originalUrl = tabInfo[`batchTab_${tabId}`]?.url || tab.url;

          // Get generated message for this URL
          const generatedMessages = storage.batchGeneratedMessages || {};
          let customMessage = generatedMessages[originalUrl];

          // Also check current URL (in case of redirects)
          if (!customMessage && tab.url) {
            customMessage = generatedMessages[tab.url];
          }

          // Check in-memory state as well
          if (!customMessage) {
            customMessage = batchState.generatedMessages[originalUrl] || batchState.generatedMessages[tab.url];
          }

          // Create profile with custom message
          const profileWithMessage = { ...storage.batchProfile };
          if (customMessage) {
            profileWithMessage.message = customMessage;
            console.log('[Batch] Using generated message for:', originalUrl);
          } else {
            console.log('[Batch] No generated message found, using default profile message');
          }

          await chrome.tabs.sendMessage(tabId, {
            action: 'batchAutoFill',
            profile: profileWithMessage
          });
        } catch (e) {
          console.error('[Batch] Error sending auto-fill message:', e);
        }
      }, 2000); // Increased delay to allow message generation
    }
  }
});

console.log('[Batch] Background script loaded');
