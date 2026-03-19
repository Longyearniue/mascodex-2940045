// Background script for batch mode tab management

// Worker API endpoint
const WORKER_API_URL = 'https://crawler-worker-teamb.taiichifox.workers.dev';

// Fetch with timeout utility
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// Store batch state
let batchState = {
  isRunning: false,
  urls: [],              // Original company URLs
  contactPages: {},      // Original URL -> Contact page URL mapping
  validUrls: [],         // URLs with valid contact pages found
  skippedUrls: [],       // URLs without contact pages
  currentIndex: 0,
  openTabs: [],
  completedTabs: [],
  tabsPerBatch: 10,
  profile: null,
  generatedMessages: {}, // URL -> generated message
  processingPhase: 'idle', // 'idle', 'finding_contacts', 'ready', 'running'
  verificationResults: {}, // tabId -> verification result
  successfulTabs: [],    // Tabs with properly filled forms (kept open)
  failedTabs: []         // Tabs that were closed (form not filled properly)
};

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle sales letter fetch request from content script (avoids CORS issues)
  // AI field classification via Claude API (bypasses Mixed Content restriction)
  if (message.action === 'aiClassifyFields') {
    (async () => {
      try {
        const { fields, profile } = message;
        const apiKeyData = await chrome.storage.sync.get(['anthropicApiKey']);
        const apiKey = apiKeyData.anthropicApiKey;
        if (!apiKey) {
          sendResponse({ success: false, error: 'No Anthropic API key configured' });
          return;
        }

        const fieldList = fields.map((f, i) =>
          `${i}: label="${f.label}" name="${f.name}" type="${f.type}" placeholder="${f.placeholder}"`
        ).join('\n');

        const prompt = `You are a form-filling assistant. Given these form fields and a user profile, determine what value to fill in each field.

Fields:
${fieldList}

Profile:
- Full name: ${profile.fullName || (profile.lastName || '') + ' ' + (profile.firstName || '')}
- Name kana: ${profile.lastNameKana || ''} ${profile.firstNameKana || ''}
- Company: ${profile.company || ''}
- Email: ${profile.email || ''}
- Phone: ${profile.phone || ''}
- Zipcode: ${profile.zipcode || ''}
- Prefecture: ${profile.prefecture || ''}
- City: ${profile.city || ''}
- Street: ${profile.street || ''}
- Message: ${profile.defaultMessage || '卸売のご相談をさせていただきたくご連絡いたしました。'}

Reply with a JSON array of values, one per field (same order). Use null if the field should not be filled (e.g. checkboxes, radio buttons, privacy policy). For select/dropdown fields, provide the option value or label text. Keep values concise.`;

        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-haiku-20240307',
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }]
          })
        });

        if (!resp.ok) {
          const err = await resp.text();
          sendResponse({ success: false, error: err });
          return;
        }
        const data = await resp.json();
        const text = data.content?.[0]?.text || '';
        const match = text.match(/\[.*\]/s);
        if (!match) {
          sendResponse({ success: false, error: 'No JSON array in response' });
          return;
        }
        const values = JSON.parse(match[0]);
        sendResponse({ success: true, values });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.action === 'fetchSalesLetter') {
    console.log('[Background] Fetching sales letter for:', message.companyUrl);
    fetchSalesLetterFromBackground(message.companyUrl)
      .then(result => {
        if (result.salesLetter) {
          console.log('[Background] Sales letter fetched, length:', result.salesLetter.length);
          sendResponse({ success: true, salesLetter: result.salesLetter });
        } else {
          console.log('[Background] No sales letter:', result.error);
          sendResponse({ success: false, error: result.error || 'Unknown error' });
        }
      })
      .catch(error => {
        console.error('[Background] Error fetching sales letter:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }

  if (message.action === 'startBatch') {
    startBatchProcess(message.urls, message.profile, message.tabsPerBatch || 10, message.autoCloseEnabled !== false, message.entries || null);
    sendResponse({ success: true });
  } else if (message.action === 'getBatchStatus') {
    const status = {
      isRunning: batchState.isRunning,
      processingPhase: batchState.processingPhase,
      total: batchState.urls.length,
      validCount: batchState.validUrls.length,
      skippedCount: batchState.skippedUrls.length,
      currentIndex: batchState.currentIndex,
      openTabs: batchState.openTabs.length,
      completedTabs: batchState.completedTabs.length,
      generatedMessages: Object.keys(batchState.generatedMessages).length,
      tabsPerBatch: batchState.tabsPerBatch
    };
    console.log('[Batch] Status requested:', status);
    sendResponse(status);
  } else if (message.action === 'stopBatch') {
    stopBatchProcess();
    sendResponse({ success: true });
  } else if (message.action === 'nextBatch') {
    console.log('[Batch] Next batch requested');
    const stateInfo = {
      isRunning: batchState.isRunning,
      currentIndex: batchState.currentIndex,
      validUrlsCount: batchState.validUrls.length,
      openTabsCount: batchState.openTabs.length,
      tabsPerBatch: batchState.tabsPerBatch
    };
    console.log('[Batch] Current state:', stateInfo);

    // Check if there are more URLs to process
    if (!batchState.isRunning) {
      console.log('[Batch] ⚠️ Batch not running');
      sendResponse({ success: false, error: 'batch_not_running' });
      return true;
    }

    if (batchState.currentIndex >= batchState.validUrls.length) {
      console.log('[Batch] ⚠️ No more URLs to process');
      sendResponse({ success: false, error: 'no_more_urls', message: '処理するURLがありません' });
      return true;
    }

    openNextBatch().then(() => {
      console.log('[Batch] Next batch opened successfully');
    }).catch(err => {
      console.error('[Batch] Error opening next batch:', err);
    });
    sendResponse({ success: true, remaining: batchState.validUrls.length - batchState.currentIndex });
  } else if (message.action === 'tabCompleted') {
    markTabCompleted(sender.tab.id);
    sendResponse({ success: true });
  } else if (message.action === 'verificationResult') {
    // Store verification result for batch mode
    handleVerificationResult(message.verification, message.url, sender.tab?.id);
    sendResponse({ success: true });
  }
  return true;
});

// Start batch process
async function startBatchProcess(urls, profile, tabsPerBatch, autoCloseEnabled = true, entries = null) {
  console.log('[Batch] Starting batch process with', urls.length, 'URLs');
  console.log('[Batch] Auto-close enabled:', autoCloseEnabled);
  if (entries) {
    console.log('[Batch] CSV entries provided:', entries.length);
  }

  // Build URL-to-entry lookup from CSV entries
  const urlEntryMap = {};
  if (entries && Array.isArray(entries)) {
    for (const entry of entries) {
      if (entry.url) {
        urlEntryMap[entry.url] = entry;
      }
    }
  }

  batchState = {
    isRunning: true,
    urls: urls,
    contactPages: {},
    validUrls: [],
    skippedUrls: [],
    currentIndex: 0,
    openTabs: [],
    completedTabs: [],
    tabsPerBatch: tabsPerBatch,
    profile: profile,
    generatedMessages: {},
    processingPhase: 'finding_contacts',
    verificationResults: {},
    successfulTabs: [],
    failedTabs: [],
    autoCloseEnabled: autoCloseEnabled,
    urlEntryMap: urlEntryMap
  };

  // Store profile for content scripts to access
  await chrome.storage.local.set({
    batchProfile: profile,
    batchMode: true,
    batchGeneratedMessages: {}
  });

  // Notify popup that we're finding contact pages
  chrome.runtime.sendMessage({
    action: 'batchPhaseUpdate',
    phase: 'finding_contacts',
    total: urls.length,
    processed: 0
  });

  // Step 1: Find contact pages for all URLs
  await findContactPagesForBatch(urls);

  if (!batchState.isRunning) return;

  // Step 2: Filter to only valid URLs and generate messages
  if (batchState.validUrls.length === 0) {
    console.log('[Batch] No contact pages found for any URL');
    batchState.isRunning = false;
    batchState.processingPhase = 'idle';
    await chrome.storage.local.set({ batchMode: false });

    chrome.runtime.sendMessage({
      action: 'batchComplete',
      total: batchState.urls.length,
      completed: 0,
      skipped: batchState.skippedUrls.length,
      message: 'No contact pages found'
    });
    return;
  }

  console.log(`[Batch] Found ${batchState.validUrls.length} URLs with contact pages, ${batchState.skippedUrls.length} skipped`);

  // Notify popup
  chrome.runtime.sendMessage({
    action: 'batchPhaseUpdate',
    phase: 'ready',
    validCount: batchState.validUrls.length,
    skippedCount: batchState.skippedUrls.length
  });

  batchState.processingPhase = 'ready';

  // Open first batch
  await openNextBatch();
}

// Contact page keywords for client-side detection (expanded)
const CONTACT_KEYWORDS = [
  // 日本語 - 一般的
  'お問い合わせ', 'お問合せ', 'お問合わせ', '問い合わせ', '問合せ', '問合わせ',
  'ご相談', 'ご連絡', 'ご質問', 'お申込', 'お申し込み', '資料請求',
  'メールフォーム', 'メール送信', 'フォーム', 'コンタクト',
  // 日本語 - ビジネス
  '見積', '見積り', 'お見積', '無料相談', '無料見積',
  // ローマ字
  'otoiawase', 'toiawase', 'contact', 'inquiry', 'enquiry',
  'soudan', 'renraku', 'mailform', 'form', 'mail',
  // 英語
  'get-in-touch', 'reach-us', 'message', 'support', 'help',
  'feedback', 'request', 'quote'
];

// URL patterns that indicate contact pages
const CONTACT_URL_PATTERNS = [
  /\/contact\/?$/i,
  /\/contact\/.*$/i,
  /\/inquiry\/?$/i,
  /\/enquiry\/?$/i,
  /\/otoiawase\/?$/i,
  /\/toiawase\/?$/i,
  /\/mail\/?$/i,
  /\/form\/?$/i,
  /\/mailform\/?$/i,
  /contact\.html?$/i,
  /inquiry\.html?$/i,
  /mail\.html?$/i,
  /form\.html?$/i,
  /form\.php$/i,
  /contact\.php$/i,
  /cgi-bin.*mail/i,
  /cgi.*contact/i,
  /feedback/i,
  /support/i
];

// Client-side contact page finder (fallback when API fails)
async function findContactPageClientSide(baseUrl) {
  try {
    console.log('[Batch] Client-side contact page search for:', baseUrl);

    // Fetch the main page with timeout
    const response = await fetchWithTimeout(baseUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, 8000);

    if (!response.ok) {
      console.log('[Batch] Could not fetch page:', response.status);
      return null;
    }

    const html = await response.text();

    // Extract all links with multiple patterns
    const links = [];

    // Pattern 1: Standard href links
    const linkPattern1 = /<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = linkPattern1.exec(html)) !== null) {
      const href = match[1].trim();
      const text = match[2].replace(/<[^>]+>/g, '').trim();
      if (href && !href.startsWith('javascript:') && !href.startsWith('mailto:')) {
        links.push({ href, text });
      }
    }

    // Pattern 2: Extract title and aria-label attributes
    const linkPattern2 = /<a[^>]+href=["']([^"'#]+)["'][^>]*(title=["']([^"']+)["']|aria-label=["']([^"']+)["'])[^>]*>/gi;
    while ((match = linkPattern2.exec(html)) !== null) {
      const href = match[1].trim();
      const title = match[3] || match[4] || '';
      if (href && !href.startsWith('javascript:') && title) {
        links.push({ href, text: title });
      }
    }

    console.log(`[Batch] Found ${links.length} links to analyze`);

    // Score and sort links by contact relevance
    const scoredLinks = links.map(link => {
      let score = 0;
      const hrefLower = link.href.toLowerCase();
      const textLower = link.text.toLowerCase();

      // Keyword matching in text (higher weight)
      for (const keyword of CONTACT_KEYWORDS) {
        const kwLower = keyword.toLowerCase();
        if (textLower.includes(kwLower)) score += 20;
        if (hrefLower.includes(kwLower)) score += 10;
      }

      // URL pattern matching (highest weight)
      for (const pattern of CONTACT_URL_PATTERNS) {
        if (pattern.test(link.href)) {
          score += 30;
          break;
        }
      }

      // Exact text matches for common labels
      if (/^お問い?合わせ$/.test(link.text.trim())) score += 25;
      if (/^contact$/i.test(link.text.trim())) score += 25;
      if (/^お問い?合わせはこちら/.test(link.text.trim())) score += 25;

      // Penalty for non-contact pages
      if (/faq|よくある質問|privacy|プライバシー|sitemap|サイトマップ/i.test(hrefLower)) {
        score -= 20;
      }

      return { ...link, score };
    }).filter(link => link.score > 0)
      .sort((a, b) => b.score - a.score);

    console.log(`[Batch] Top scored links:`, scoredLinks.slice(0, 5).map(l => ({ href: l.href, text: l.text, score: l.score })));

    if (scoredLinks.length > 0 && scoredLinks[0].score >= 10) {
      // Resolve relative URL to absolute
      const bestLink = scoredLinks[0];
      try {
        const absoluteUrl = new URL(bestLink.href, baseUrl).href;
        console.log(`[Batch] Client-side found contact page: ${absoluteUrl} (score: ${bestLink.score})`);
        return absoluteUrl;
      } catch (e) {
        console.log('[Batch] Could not resolve URL:', bestLink.href);
      }
    }

    // Try common contact page paths as fallback
    const commonPaths = [
      '/contact', '/contact/', '/contact.html', '/contact.php',
      '/inquiry', '/inquiry/', '/inquiry.html',
      '/otoiawase', '/otoiawase/', '/toiawase',
      '/form', '/form/', '/mailform', '/mailform/',
      '/お問い合わせ', '/お問合せ'
    ];

    console.log('[Batch] Trying common contact paths...');
    for (const path of commonPaths) {
      try {
        const testUrl = new URL(path, baseUrl).href;
        const testResponse = await fetchWithTimeout(testUrl, { method: 'HEAD' }, 3000);
        if (testResponse.ok && testResponse.status === 200) {
          console.log(`[Batch] Found contact page at common path: ${testUrl}`);
          return testUrl;
        }
      } catch (e) {
        // Ignore errors (including timeout), try next path
      }
    }

    console.log('[Batch] No contact page found client-side for:', baseUrl);
    return null;
  } catch (error) {
    console.error('[Batch] Client-side search error:', error);
    return null;
  }
}

// =============================================================================
// HUMAN-LIKE CONTACT PAGE NAVIGATION (NEW METHOD)
// =============================================================================

// Keywords that indicate a contact link (prioritized)
const CONTACT_LINK_KEYWORDS = [
  // 高優先度 - 明確なお問い合わせ
  { text: 'お問い合わせ', score: 100 },
  { text: 'お問合せ', score: 100 },
  { text: 'お問合わせ', score: 100 },
  { text: 'CONTACT', score: 90 },
  { text: 'Contact', score: 90 },
  { text: 'contact', score: 90 },
  // 中優先度 - 関連リンク
  { text: 'ご相談', score: 70 },
  { text: 'ご連絡', score: 70 },
  { text: 'メールでのお問い合わせ', score: 95 },
  { text: 'フォームでのお問い合わせ', score: 95 },
  { text: 'お問い合わせフォーム', score: 95 },
  { text: 'メールフォーム', score: 85 },
  { text: '資料請求', score: 60 },
  { text: '無料相談', score: 60 },
  { text: 'お見積', score: 50 },
];

// Keywords for sub-links on contact pages
const CONTACT_FORM_KEYWORDS = [
  'メールでお問い合わせ', 'メールで問い合わせ', 'メールフォーム',
  'フォームでお問い合わせ', 'フォームで問い合わせ', 'お問い合わせフォーム',
  'WEBからお問い合わせ', 'ウェブからお問い合わせ', 'ネットでお問い合わせ',
  'こちらから', 'フォームはこちら', 'お問い合わせはこちら',
  'mail', 'form', 'inquiry', 'contact form'
];

// Check if a page has a contact form
async function pageHasContactForm(url) {
  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    }, 8000);
    if (!response.ok) return false;

    const html = await response.text();

    // Check for form elements
    const hasForm = /<form[^>]*>/i.test(html);
    const hasTextarea = /<textarea[^>]*>/i.test(html);
    const hasInputText = /<input[^>]+type=["']?(text|email|tel)["']?/i.test(html);
    const hasSubmit = /<(input|button)[^>]+(type=["']?submit|送信|確認|submit)/i.test(html);

    // A contact form typically has: form tag + (textarea or multiple inputs) + submit button
    const formScore = (hasForm ? 30 : 0) + (hasTextarea ? 40 : 0) + (hasInputText ? 20 : 0) + (hasSubmit ? 10 : 0);

    console.log(`[HumanNav] Page form check: ${url}`);
    console.log(`[HumanNav]   hasForm: ${hasForm}, hasTextarea: ${hasTextarea}, hasInputText: ${hasInputText}, hasSubmit: ${hasSubmit}`);
    console.log(`[HumanNav]   formScore: ${formScore}`);

    return formScore >= 50;
  } catch (error) {
    console.error('[HumanNav] Error checking page for form:', error.message);
    return false;
  }
}

// Extract links from HTML with scoring (including image links)
function extractContactLinks(html, baseUrl) {
  const links = [];

  // Pattern to extract links with all attributes and content
  const linkPattern = /<a([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const attributes = match[1];
    const rawContent = match[2];

    // Extract href
    const hrefMatch = attributes.match(/href=["']([^"'#]+)["']/i);
    if (!hrefMatch) continue;

    let href = hrefMatch[1].trim();

    // Skip invalid links
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      continue;
    }

    // Resolve relative URL
    try {
      href = new URL(href, baseUrl).href;
    } catch (e) {
      continue;
    }

    // Skip external links
    try {
      const baseHost = new URL(baseUrl).hostname;
      const linkHost = new URL(href).hostname;
      if (linkHost !== baseHost && !linkHost.endsWith('.' + baseHost)) {
        continue;
      }
    } catch (e) {
      continue;
    }

    // Extract text content (remove HTML tags)
    const text = rawContent.replace(/<[^>]+>/g, '').trim();

    // Extract title attribute from link
    const titleMatch = attributes.match(/title=["']([^"']+)["']/i);
    const linkTitle = titleMatch ? titleMatch[1] : '';

    // Extract aria-label from link
    const ariaMatch = attributes.match(/aria-label=["']([^"']+)["']/i);
    const ariaLabel = ariaMatch ? ariaMatch[1] : '';

    // Extract alt text from images inside the link
    const imgAltMatch = rawContent.match(/<img[^>]+alt=["']([^"']+)["']/i);
    const imgAlt = imgAltMatch ? imgAltMatch[1] : '';

    // Extract image src for filename analysis
    const imgSrcMatch = rawContent.match(/<img[^>]+src=["']([^"']+)["']/i);
    const imgSrc = imgSrcMatch ? imgSrcMatch[1].toLowerCase() : '';

    // Check for icon classes or SVG
    const hasIcon = rawContent.includes('<img') || rawContent.includes('<svg') ||
                    rawContent.includes('icon') || attributes.includes('icon');

    // Combine all text sources for analysis
    const allText = [text, linkTitle, ariaLabel, imgAlt].filter(t => t).join(' ');
    const allTextLower = allText.toLowerCase();
    const hrefLower = href.toLowerCase();

    // Calculate score based on all text sources
    let score = 0;
    let matchedKeyword = '';

    for (const keyword of CONTACT_LINK_KEYWORDS) {
      const kwLower = keyword.text.toLowerCase();
      if (allText.includes(keyword.text) || allTextLower.includes(kwLower)) {
        if (keyword.score > score) {
          score = keyword.score;
          matchedKeyword = keyword.text;
        }
      }
    }

    // Check image filename for contact keywords
    if (imgSrc) {
      if (imgSrc.includes('contact') || imgSrc.includes('otoiawase') || imgSrc.includes('inquiry')) {
        score = Math.max(score, 85);
        if (!matchedKeyword) matchedKeyword = 'img:contact';
      }
      if (imgSrc.includes('mail') || imgSrc.includes('form')) {
        score = Math.max(score, 65);
        if (!matchedKeyword) matchedKeyword = 'img:mail/form';
      }
      // Japanese image filenames
      if (imgSrc.includes('btn_') || imgSrc.includes('button_')) {
        if (imgSrc.includes('toiawase') || imgSrc.includes('contact') || imgSrc.includes('mail')) {
          score = Math.max(score, 80);
          if (!matchedKeyword) matchedKeyword = 'img:button';
        }
      }
    }

    // URL-based scoring
    if (hrefLower.includes('contact')) { score = Math.max(score, 80); if (!matchedKeyword) matchedKeyword = 'url:contact'; }
    if (hrefLower.includes('inquiry')) { score = Math.max(score, 80); if (!matchedKeyword) matchedKeyword = 'url:inquiry'; }
    if (hrefLower.includes('otoiawase')) { score = Math.max(score, 80); if (!matchedKeyword) matchedKeyword = 'url:otoiawase'; }
    if (hrefLower.includes('toiawase')) { score = Math.max(score, 80); if (!matchedKeyword) matchedKeyword = 'url:toiawase'; }
    if (hrefLower.includes('form')) { score = Math.max(score, 60); if (!matchedKeyword) matchedKeyword = 'url:form'; }
    if (hrefLower.includes('mail') && !hrefLower.includes('mailto')) { score = Math.max(score, 50); if (!matchedKeyword) matchedKeyword = 'url:mail'; }

    if (score > 0) {
      links.push({
        href,
        text: allText || '[画像リンク]',
        score,
        hasIcon,
        matchedKeyword,
        sources: { text, linkTitle, ariaLabel, imgAlt, imgSrc: imgSrc ? imgSrc.split('/').pop() : '' }
      });
    }
  }

  // Sort by score descending
  links.sort((a, b) => b.score - a.score);

  return links;
}

// Find contact form links on a contact page (for multi-step navigation)
function findContactFormSubLinks(html, baseUrl) {
  const links = [];

  const linkPattern = /<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    let href = match[1].trim();
    const text = match[2].replace(/<[^>]+>/g, '').trim();

    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      continue;
    }

    try {
      href = new URL(href, baseUrl).href;
    } catch (e) {
      continue;
    }

    // Check if this looks like a form link
    let isFormLink = false;
    for (const keyword of CONTACT_FORM_KEYWORDS) {
      if (text.includes(keyword) || text.toLowerCase().includes(keyword.toLowerCase())) {
        isFormLink = true;
        break;
      }
    }

    // Also check href
    const hrefLower = href.toLowerCase();
    if (hrefLower.includes('form') || hrefLower.includes('mail') || hrefLower.includes('inquiry')) {
      isFormLink = true;
    }

    if (isFormLink) {
      links.push({ href, text });
    }
  }

  return links;
}

// Human-like navigation to find contact page
async function findContactPageHumanStyle(baseUrl) {
  console.log('[HumanNav] Starting human-like navigation for:', baseUrl);

  try {
    // Step 1: Fetch the main page with timeout
    console.log('[HumanNav] Step 1: Fetching main page...');
    const mainResponse = await fetchWithTimeout(baseUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    }, 8000);

    if (!mainResponse.ok) {
      console.log('[HumanNav] Could not fetch main page:', mainResponse.status);
      return null;
    }

    const mainHtml = await mainResponse.text();

    // Step 2: Find contact links on main page
    console.log('[HumanNav] Step 2: Looking for contact links on main page...');
    const contactLinks = extractContactLinks(mainHtml, baseUrl);

    console.log(`[HumanNav] Found ${contactLinks.length} potential contact links`);
    if (contactLinks.length > 0) {
      console.log('[HumanNav] Top links:');
      contactLinks.slice(0, 5).forEach((l, i) => {
        console.log(`  ${i + 1}. [${l.score}点] "${l.text}" (${l.matchedKeyword}) ${l.hasIcon ? '🖼️' : ''}`);
        console.log(`     URL: ${l.href}`);
        if (l.sources.imgSrc) console.log(`     画像: ${l.sources.imgSrc}`);
        if (l.sources.imgAlt) console.log(`     Alt: ${l.sources.imgAlt}`);
      });
    }

    if (contactLinks.length === 0) {
      console.log('[HumanNav] No contact links found on main page');
      return null;
    }

    // Step 3: Check top contact links
    for (const link of contactLinks.slice(0, 3)) {
      console.log(`[HumanNav] Step 3: Checking contact page: ${link.href} (text: "${link.text}")`);

      // Check if this page has a contact form
      const hasForm = await pageHasContactForm(link.href);

      if (hasForm) {
        console.log(`[HumanNav] ✅ Found contact form at: ${link.href}`);
        return link.href;
      }

      // Step 4: If no form, look for sub-links (e.g., "メールでお問い合わせ")
      console.log('[HumanNav] Step 4: No form found, looking for sub-links...');

      try {
        const subResponse = await fetchWithTimeout(link.href, {
          method: 'GET',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        }, 8000);

        if (subResponse.ok) {
          const subHtml = await subResponse.text();
          const formLinks = findContactFormSubLinks(subHtml, link.href);

          console.log(`[HumanNav] Found ${formLinks.length} form sub-links`);
          if (formLinks.length > 0) {
            console.log('[HumanNav] Sub-links:', formLinks.map(l => ({ text: l.text, href: l.href })));
          }

          // Check each sub-link for a form
          for (const formLink of formLinks.slice(0, 3)) {
            console.log(`[HumanNav] Checking sub-link: ${formLink.href}`);
            const subHasForm = await pageHasContactForm(formLink.href);

            if (subHasForm) {
              console.log(`[HumanNav] ✅ Found contact form at sub-link: ${formLink.href}`);
              return formLink.href;
            }
          }
        }
      } catch (e) {
        console.log('[HumanNav] Error checking sub-links:', e.message);
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // If we found contact links but no forms, return the best contact link anyway
    // (it might be a page where the form loads via JavaScript)
    if (contactLinks.length > 0 && contactLinks[0].score >= 80) {
      console.log(`[HumanNav] ⚠️ No form found, but returning best contact link: ${contactLinks[0].href}`);
      return contactLinks[0].href;
    }

    console.log('[HumanNav] No contact page found via human-like navigation');
    return null;

  } catch (error) {
    console.error('[HumanNav] Error in human-like navigation:', error.message);
    return null;
  }
}

// =============================================================================
// WORKER API WITH RETRY
// =============================================================================

// Try Worker API with retry logic
async function tryWorkerAPIWithRetry(url, maxRetries = 2, entry = null) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[Batch] Worker API retry ${attempt} for:`, url);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }

      const requestBody = { url: url };
      if (entry) {
        if (entry.companyName) requestBody.company_name = entry.companyName;
        if (entry.prefecture) requestBody.prefecture = entry.prefecture;
        if (entry.city) requestBody.city = entry.city;
      }

      const response = await fetchWithTimeout(`${WORKER_API_URL}/sales-letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }, 30000); // 30 second timeout for API calls

      if (response.ok) {
        const data = await response.json();
        const contactPages = data.contact_pages || data.contactPages || [];

        if (contactPages.length > 0) {
          return {
            success: true,
            contactPageUrl: contactPages[0],
            salesLetter: data.sales_letter || data.salesLetter
          };
        } else {
          console.log(`[Batch] Worker API: no contact pages in response`);
          return { success: false, reason: 'no_contact_pages' };
        }
      } else if (response.status === 429 || response.status === 503) {
        // Rate limited or service unavailable - retry
        console.log(`[Batch] Worker API rate limited (${response.status}), will retry...`);
        continue;
      } else {
        console.log(`[Batch] Worker API error: ${response.status}`);
        return { success: false, reason: `http_${response.status}` };
      }
    } catch (error) {
      console.error(`[Batch] Worker API exception (attempt ${attempt}):`, error.message);
      if (attempt === maxRetries) {
        return { success: false, reason: 'exception' };
      }
    }
  }
  return { success: false, reason: 'max_retries' };
}

// Find contact pages using multiple methods (Worker API + client-side fallback)
// 並列数（10件同時）
const CONTACT_SEARCH_CONCURRENCY = 10;

async function findContactPagesForBatch(urls) {
  console.log('[Batch] Finding contact pages for', urls.length, 'URLs (concurrency:', CONTACT_SEARCH_CONCURRENCY, ')');

  let processed = 0;
  const total = urls.length;

  for (let i = 0; i < total; i += CONTACT_SEARCH_CONCURRENCY) {
    if (!batchState.isRunning) break;
    const chunk = urls.slice(i, i + CONTACT_SEARCH_CONCURRENCY);

    await Promise.allSettled(chunk.map(async (url) => {
      if (!batchState.isRunning) return;
      let contactPageUrl = null;
      let salesLetter = null;
      let foundVia = null;

      // Method 1: Worker API
      const entry = batchState.urlEntryMap ? batchState.urlEntryMap[url] : null;
      const workerResult = await tryWorkerAPIWithRetry(url, 2, entry).catch(() => ({ success: false, reason: 'error' }));
      if (workerResult.success) {
        contactPageUrl = workerResult.contactPageUrl;
        salesLetter = workerResult.salesLetter;
        foundVia = 'worker-api';
      }

      // Method 2: Client-side
      if (!contactPageUrl) {
        try {
          contactPageUrl = await findContactPageClientSide(url);
          if (contactPageUrl) foundVia = 'client-side';
        } catch (e) {}
      }

      // Method 3: Human-like
      if (!contactPageUrl) {
        try {
          contactPageUrl = await findContactPageHumanStyle(url);
          if (contactPageUrl) foundVia = 'human-navigation';
        } catch (e) {}
      }

      if (contactPageUrl) {
        batchState.contactPages[url] = contactPageUrl;
        batchState.validUrls.push(url);
        console.log(`[Batch] ✅ ${url} → ${contactPageUrl} (${foundVia})`);
        // salesLetter保存を無効化（原稿タブのテンプレートを使用）
        // if (salesLetter) { ... }
      } else {
        batchState.skippedUrls.push(url);
        console.log(`[Batch] ❌ No contact page: ${url}`);
      }

      processed++;
      chrome.runtime.sendMessage({
        action: 'batchPhaseUpdate',
        phase: 'finding_contacts',
        total,
        processed,
        validCount: batchState.validUrls.length,
        skippedCount: batchState.skippedUrls.length
      }).catch(() => {});
    }));

    if (i + CONTACT_SEARCH_CONCURRENCY < total) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  console.log('[Batch] Contact page discovery complete');
  console.log(`[Batch] Results: ${batchState.validUrls.length} valid, ${batchState.skippedUrls.length} skipped`);
}

// Open next batch of tabs (only for URLs with contact pages)
async function openNextBatch() {
  console.log('[Batch] openNextBatch called');
  console.log('[Batch] isRunning:', batchState.isRunning);
  console.log('[Batch] currentIndex:', batchState.currentIndex);
  console.log('[Batch] validUrls.length:', batchState.validUrls.length);

  if (!batchState.isRunning) {
    console.log('[Batch] ⚠️ openNextBatch aborted - batch not running');
    return;
  }

  batchState.processingPhase = 'running';

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
  const endIndex = Math.min(startIndex + batchState.tabsPerBatch, batchState.validUrls.length);

  if (startIndex >= batchState.validUrls.length) {
    console.log('[Batch] All valid URLs processed - batch complete');
    console.log(`[Batch] startIndex: ${startIndex}, validUrls.length: ${batchState.validUrls.length}`);
    batchState.isRunning = false;
    batchState.processingPhase = 'idle';
    await chrome.storage.local.set({ batchMode: false });

    // Notify popup
    chrome.runtime.sendMessage({
      action: 'batchComplete',
      total: batchState.urls.length,
      validCount: batchState.validUrls.length,
      completed: batchState.completedTabs.length,
      skipped: batchState.skippedUrls.length
    });
    return;
  }

  console.log(`[Batch] Opening tabs ${startIndex + 1} to ${endIndex} of ${batchState.validUrls.length} valid URLs`);
  console.log(`[Batch] tabsPerBatch: ${batchState.tabsPerBatch}`);

  // Open tabs for this batch - use CONTACT PAGE URL, not original URL
  let firstTab = true;
  for (let i = startIndex; i < endIndex; i++) {
    const originalUrl = batchState.validUrls[i];
    const contactPageUrl = batchState.contactPages[originalUrl];

    if (!contactPageUrl) {
      console.log(`[Batch] Skipping ${originalUrl} - no contact page`);
      continue;
    }

    try {
      console.log(`[Batch] Opening contact page: ${contactPageUrl} (from: ${originalUrl})`);

      const tab = await chrome.tabs.create({
        url: contactPageUrl,
        active: firstTab // Only first tab is active
      });
      firstTab = false;
      batchState.openTabs.push(tab.id);

      // Store tab info with both original and contact page URL
      await chrome.storage.local.set({
        [`batchTab_${tab.id}`]: {
          originalUrl: originalUrl,
          contactPageUrl: contactPageUrl,
          index: i,
          status: 'loading'
        }
      });
    } catch (e) {
      console.error('[Batch] Error opening tab:', contactPageUrl, e);
    }
  }

  batchState.currentIndex = endIndex;
}

// Mark a tab as completed (form submitted)
function markTabCompleted(tabId) {
  if (batchState.openTabs.includes(tabId)) {
    batchState.completedTabs.push(tabId);
    console.log(`[Batch] Tab ${tabId} completed. ${batchState.completedTabs.length}/${batchState.validUrls.length} done`);
  }
}

// Stop batch process
async function stopBatchProcess() {
  console.log('[Batch] Stopping batch process');
  batchState.isRunning = false;
  batchState.processingPhase = 'idle';

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
          // Get the tab info
          const tabInfo = await chrome.storage.local.get([`batchTab_${tabId}`]);
          const originalUrl = tabInfo[`batchTab_${tabId}`]?.originalUrl || '';
          const contactPageUrl = tabInfo[`batchTab_${tabId}`]?.contactPageUrl || tab.url;

          // Get generated message for this URL (try multiple keys)
          const generatedMessages = storage.batchGeneratedMessages || {};
          let customMessage = generatedMessages[originalUrl] ||
                              generatedMessages[contactPageUrl] ||
                              generatedMessages[tab.url];

          // Check in-memory state as well
          if (!customMessage) {
            customMessage = batchState.generatedMessages[originalUrl] ||
                           batchState.generatedMessages[contactPageUrl] ||
                           batchState.generatedMessages[tab.url];
          }

          // Create profile with custom message
          // 原稿はcontent.jsがchrome.storage.syncから直接読む。ここでは上書きしない
          const profileWithMessage = { ...storage.batchProfile };
          console.log('[Batch] Sending profile to tab (message overriding disabled)');

          await chrome.tabs.sendMessage(tabId, {
            action: 'batchAutoFill',
            profile: profileWithMessage
          });
        } catch (e) {
          console.error('[Batch] Error sending auto-fill message:', e);
        }
      }, 2000);
    }
  }
});

// Minimum fields required to consider form as "successfully filled"
const MIN_FILLED_FIELDS = 1;  // 1つでも入力できればキープ（全く入らなかった場合のみクローズ）

// Handle verification result from content script
async function handleVerificationResult(verification, url, tabId) {
  console.log('[Batch] Verification result received:', { url, tabId, status: verification?.status });

  // Only process verification results when batch mode is active
  if (!batchState.isRunning) {
    console.log('[Batch] Ignoring verification - batch mode not active');
    return;
  }

  if (!tabId || !verification) return;

  batchState.verificationResults[tabId] = {
    url: url,
    verification: verification,
    timestamp: Date.now()
  };

  const { status, filledFields, totalFields, requiredEmpty, hasMessageField, messageFieldFilled, pageInvalidReason } = verification;
  console.log(`[Batch] Tab ${tabId} verification: ${status}`);
  console.log(`  - Filled: ${filledFields}/${totalFields}`);
  console.log(`  - Required empty: ${requiredEmpty}`);
  console.log(`  - Has message field: ${hasMessageField}`);
  console.log(`  - Message filled: ${messageFieldFilled}`);
  if (pageInvalidReason) console.log(`  - Page invalid: ${pageInvalidReason}`);

  // If page is invalid (error page or no form), close immediately (if auto-close enabled)
  if (status === 'page_invalid') {
    const shouldClose = batchState.autoCloseEnabled !== false;

    if (shouldClose) {
      console.log(`[Batch] ❌ Tab ${tabId} CLOSING - Invalid page: ${pageInvalidReason}`);
    } else {
      console.log(`[Batch] ⚠️ Tab ${tabId} KEPT (auto-close disabled) - Invalid page: ${pageInvalidReason}`);
    }

    // Track as failed
    if (!batchState.failedTabs) batchState.failedTabs = [];
    batchState.failedTabs.push({ tabId, url, reason: pageInvalidReason || 'page_invalid' });

    // Notify popup
    chrome.runtime.sendMessage({
      action: 'verificationUpdate',
      tabId: tabId,
      url: url,
      verification: verification,
      kept: !shouldClose,
      reason: pageInvalidReason || 'ページが無効'
    }).catch(() => {});

    // Close the tab only if auto-close is enabled
    if (shouldClose) {
      setTimeout(async () => {
        try {
          await chrome.tabs.remove(tabId);
          console.log(`[Batch] Tab ${tabId} closed (invalid page)`);
          const index = batchState.openTabs.indexOf(tabId);
          if (index > -1) batchState.openTabs.splice(index, 1);
        } catch (e) {
          console.log(`[Batch] Could not close tab ${tabId}:`, e);
        }
      }, 800); // Shorter delay for invalid pages
    }

    updateBatchSummary();
    return;
  }

  // Determine if this tab should be kept or closed
  // メッセージ欄がない場合は、メッセージ入力を必須としない
  const messageOk = !hasMessageField || messageFieldFilled;
  const shouldKeep = filledFields >= MIN_FILLED_FIELDS;  // 1つでも入ればキープ

  if (shouldKeep) {
    console.log(`[Batch] ✅ Tab ${tabId} KEPT - Form properly filled`);

    // Track as successful
    if (!batchState.successfulTabs) batchState.successfulTabs = [];
    batchState.successfulTabs.push(tabId);

    // Notify popup
    chrome.runtime.sendMessage({
      action: 'verificationUpdate',
      tabId: tabId,
      url: url,
      verification: verification,
      kept: true
    }).catch(() => {});

  } else {
    // Determine the specific reason for failure
    let failReason = 'unknown';
    let failReasonJa = '不明';
    if (filledFields < MIN_FILLED_FIELDS) {
      failReason = 'insufficient_fields';
      failReasonJa = `フィールド不足 (${filledFields}/${MIN_FILLED_FIELDS})`;
    } else if (hasMessageField && !messageFieldFilled) {
      failReason = 'message_empty';
      failReasonJa = '本文が空';
    }

    // Check if auto-close is enabled
    const shouldClose = batchState.autoCloseEnabled !== false;

    if (shouldClose) {
      console.log(`[Batch] ❌ Tab ${tabId} CLOSING - Form not properly filled`);
    } else {
      console.log(`[Batch] ⚠️ Tab ${tabId} KEPT (auto-close disabled) - Form not properly filled`);
    }
    console.log(`  - Reason: ${failReasonJa}`);

    // Track as failed
    if (!batchState.failedTabs) batchState.failedTabs = [];
    batchState.failedTabs.push({ tabId, url, reason: failReason });

    // Notify popup
    chrome.runtime.sendMessage({
      action: 'verificationUpdate',
      tabId: tabId,
      url: url,
      verification: verification,
      kept: !shouldClose,
      reason: failReasonJa
    }).catch(() => {});

    // Close the tab only if auto-close is enabled
    if (shouldClose) {
      setTimeout(async () => {
        try {
          await chrome.tabs.remove(tabId);
          console.log(`[Batch] Tab ${tabId} closed`);

          // Remove from openTabs
          const index = batchState.openTabs.indexOf(tabId);
          if (index > -1) {
            batchState.openTabs.splice(index, 1);
          }
        } catch (e) {
          console.log(`[Batch] Could not close tab ${tabId}:`, e);
        }
      }, 1500);
    }
  }

  // Update batch summary
  updateBatchSummary();
}

// Update batch summary and notify popup
function updateBatchSummary() {
  const successCount = batchState.successfulTabs?.length || 0;
  const failedCount = batchState.failedTabs?.length || 0;
  const pendingCount = batchState.openTabs.length - successCount;

  chrome.runtime.sendMessage({
    action: 'batchSummaryUpdate',
    summary: {
      successful: successCount,
      failed: failedCount,
      pending: pendingCount,
      total: batchState.validUrls.length
    }
  }).catch(() => {});
}

// Fetch sales letter from Worker API (called from background to avoid CORS)
async function fetchSalesLetterFromBackground(companyUrl, companyInfo = null) {
  try {
    console.log('[Background] Calling Worker API for:', companyUrl);

    const requestBody = { company_url: companyUrl };
    if (companyInfo) {
      if (companyInfo.companyName) requestBody.company_name = companyInfo.companyName;
      if (companyInfo.prefecture) requestBody.prefecture = companyInfo.prefecture;
      if (companyInfo.city) requestBody.city = companyInfo.city;
    }

    const response = await fetchWithTimeout(`${WORKER_API_URL}/sales-letter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }, 60000); // 60 second timeout for individual sales letter generation

    if (!response.ok) {
      console.error('[Background] API returned error:', response.status, response.statusText);
      return { error: `API error: ${response.status} ${response.statusText}`, salesLetter: null };
    }

    const data = await response.json();
    console.log('[Background] API response keys:', Object.keys(data));

    if (data.ok && data.sales_letter) {
      return { salesLetter: data.sales_letter, error: null };
    } else if (data.salesLetter) {
      return { salesLetter: data.salesLetter, error: null };
    } else {
      console.log('[Background] No sales_letter in response, data:', JSON.stringify(data).substring(0, 200));
      return { error: 'No sales_letter in API response', salesLetter: null };
    }
  } catch (error) {
    console.error('[Background] Exception fetching sales letter:', error);
    return { error: `Exception: ${error.message}`, salesLetter: null };
  }
}

// =============================================================================
// STARTUP CLEANUP - Clear stale batchMode flag
// =============================================================================
// This fixes the issue where windows are closed outside of batch mode
// if the browser was closed unexpectedly during batch processing

chrome.storage.local.get(['batchMode'], (result) => {
  if (result.batchMode && !batchState.isRunning) {
    console.log('[Batch] ⚠️ Clearing stale batchMode flag on startup');
    chrome.storage.local.set({ batchMode: false });
  }
});

console.log('[Batch] Background script loaded');

// =============================================================================
// PART 2: COMPANY INFO SCRAPER + processUrl HANDLER
// =============================================================================

const PREFECTURES = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];

async function scrapeCompanyInfo(url) {
  const info = { companyName: '', productName: '', prefecture: '', description: '' };
  try {
    const resp = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    }, 8000);
    if (!resp.ok) return info;
    const html = await resp.text();

    // companyName: og:site_name > title > h1
    const ogSite = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
    if (ogSite) {
      info.companyName = ogSite[1].trim();
    } else {
      const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (title) info.companyName = title[1].replace(/\s*[\|｜\-–—]\s*.+$/, '').trim();
      if (!info.companyName) {
        const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (h1) info.companyName = h1[1].trim();
      }
    }

    // productName: og:description (first 30 chars) or h2
    const ogDesc = html.match(/<meta[^>]+(?:property=["']og:description["']|name=["']description["'])[^>]+content=["']([^"']+)["']/i);
    if (ogDesc) {
      info.description = ogDesc[1].trim();
      info.productName = ogDesc[1].trim().substring(0, 30);
    }
    if (!info.productName) {
      const h2 = html.match(/<h2[^>]*>([^<]+)<\/h2>/i);
      if (h2) info.productName = h2[1].replace(/<[^>]+>/g, '').trim().substring(0, 30);
    }

    // prefecture: scan for prefecture names
    for (const pref of PREFECTURES) {
      if (html.includes(pref)) { info.prefecture = pref; break; }
    }
  } catch (e) {
    console.error('[scrapeCompanyInfo] error:', e);
  }
  return info;
}

function substituteTemplate(template, vars) {
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日`;
  return template
    .replace(/\{\{会社名\}\}/g, vars.companyName || '')
    .replace(/\{\{商品名\}\}/g, vars.productName || '')
    .replace(/\{\{都道府県\}\}/g, vars.prefecture || '')
    .replace(/\{\{担当者名\}\}/g, vars.myName || '')
    .replace(/\{\{URL\}\}/g, vars.url || '')
    .replace(/\{\{日付\}\}/g, dateStr)
    .replace(/\{\{自社説明\}\}/g, vars.selfDesc || '');
}

// processUrl message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== 'processUrl') return;
  (async () => {
    const { url, profile, template } = message;
    const setStatus = async (s) => { await chrome.storage.local.set({ processStatus: s }); };

    await setStatus('⏳ お問合せページを検索中...');
    let contactUrl = null;
    try { contactUrl = await findContactPageClientSide(url); } catch(e) {}
    if (!contactUrl) {
      try { contactUrl = await findContactPageHumanStyle(url); } catch(e) {}
    }
    if (!contactUrl) { await setStatus('❌ お問合せページが見つかりませんでした'); return; }

    await setStatus('🔍 企業情報をスキャン中...');
    const companyInfo = await scrapeCompanyInfo(url);

    const vars = {
      companyName: companyInfo.companyName || new URL(url).hostname,
      productName: companyInfo.productName || '',
      prefecture: companyInfo.prefecture || '',
      myName: profile.name || '',
      url: url,
      selfDesc: template.selfDesc || ''
    };

    const filledSubject = substituteTemplate(template.subject || '{{会社名}}様へのご提案', vars);
    const filledBody = substituteTemplate(template.body || '', vars);
    const filledProfile = { ...profile, subject: filledSubject, message: filledBody };

    await setStatus('📝 フォームを記入中...');
    const tab = await chrome.tabs.create({ url: contactUrl });

    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id, { action: 'batchAutoFill', profile: filledProfile });
          } catch(e) { console.error('[processUrl] sendMessage error:', e); }
          await setStatus('✅ 内容を確認して送信ボタンを押してください！');
        }, 2500);
      }
    });
  })();
  return false;
});

// =============================================================================
// PART 4: SITEMAP-FIRST + PARALLEL HEAD in findContactPageClientSide
// =============================================================================

async function findContactUrlFromSitemap(baseUrl) {
  const sitemapUrls = [
    new URL('/sitemap.xml', baseUrl).href,
    new URL('/sitemap_index.xml', baseUrl).href,
    new URL('/sitemap.html', baseUrl).href
  ];
  const contactPattern = /contact|inquiry|otoiawase|toiawase|form|mail|お問|問合/i;

  const results = await Promise.allSettled(
    sitemapUrls.map(su => fetchWithTimeout(su, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, 4000))
  );

  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value.ok) continue;
    const text = await r.value.text();
    const locs = [];
    const locMatch = text.matchAll(/<loc>([^<]+)<\/loc>/g);
    for (const m of locMatch) locs.push(m[1]);
    // also parse <a href> for sitemap.html
    const hrefMatch = text.matchAll(/href=["']([^"']+)["']/g);
    for (const m of hrefMatch) locs.push(m[1]);

    const match = locs.find(u => contactPattern.test(u));
    if (match) return match.startsWith('http') ? match : new URL(match, baseUrl).href;
  }
  return null;
}

// Monkey-patch: wrap findContactPageClientSide to inject sitemap check + parallel HEAD
const _originalFindContactPageClientSide = findContactPageClientSide;
// eslint-disable-next-line no-global-assign
async function findContactPageClientSide(baseUrl) {
  // 1. Try sitemap first
  try {
    const sitemapResult = await findContactUrlFromSitemap(baseUrl);
    if (sitemapResult) {
      console.log('[Sitemap] Found contact page:', sitemapResult);
      return sitemapResult;
    }
  } catch(e) {}

  // 2. Run original HTML link scraping logic (inline to avoid recursion)
  try {
    console.log('[Batch] Client-side contact page search for:', baseUrl);
    const response = await fetchWithTimeout(baseUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    }, 8000);
    if (!response.ok) return null;
    const html = await response.text();

    const links = [];
    const linkPattern1 = /<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = linkPattern1.exec(html)) !== null) {
      const href = match[1].trim();
      const text = match[2].replace(/<[^>]+>/g, '').trim();
      if (href && !href.startsWith('javascript:') && !href.startsWith('mailto:')) links.push({ href, text });
    }

    const scoredLinks = links.map(link => {
      let score = 0;
      const hrefLower = link.href.toLowerCase();
      const textLower = link.text.toLowerCase();
      const contactKws = ['contact','お問い合わせ','お問合せ','問合せ','inquiry','otoiawase','form','mail','toiawase','contactus'];
      for (const kw of contactKws) {
        if (textLower.includes(kw)) score += 20;
        if (hrefLower.includes(kw)) score += 10;
      }
      if (/^お問い?合わせ$/.test(link.text.trim())) score += 25;
      if (/^contact$/i.test(link.text.trim())) score += 25;
      if (/faq|privacy|sitemap|サイトマップ/i.test(hrefLower)) score -= 20;
      return { ...link, score };
    }).filter(l => l.score > 0).sort((a, b) => b.score - a.score);

    if (scoredLinks.length > 0 && scoredLinks[0].score >= 10) {
      try { return new URL(scoredLinks[0].href, baseUrl).href; } catch(e) {}
    }

    // 3. Parallel HEAD checks (replaces sequential loop)
    const commonPaths = [
      '/contact', '/contact/', '/contact.html', '/contact.php',
      '/inquiry', '/inquiry/', '/inquiry.html',
      '/otoiawase', '/otoiawase/', '/toiawase',
      '/form', '/form/', '/mailform', '/mailform/',
      '/お問い合わせ', '/お問合せ'
    ];

    const headResults = await Promise.allSettled(
      commonPaths.map(async path => {
        const testUrl = new URL(path, baseUrl).href;
        const resp = await fetchWithTimeout(testUrl, { method: 'HEAD' }, 2000);
        if (resp.ok && resp.status === 200) return testUrl;
        throw new Error('not found');
      })
    );

    for (const r of headResults) {
      if (r.status === 'fulfilled') return r.value;
    }

    return null;
  } catch (error) {
    console.error('[Batch] Client-side search error:', error);
    return null;
  }
}
