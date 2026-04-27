/**
 * SaveAtlas Extension — Background Service Worker
 * 
 * Handles:
 * - Receiving intercepted saves from content script
 * - Deduplication using chrome.storage
 * - Syncing batches to the SaveAtlas backend API
 * - Periodic alarm-based re-sync
 * - Status reporting to popup
 */

const SAVEATLAS_API = 'https://save-atlas.vercel.app/api/saves/sync';
const SYNC_ALARM_NAME = 'saveatlas-periodic-sync';
const SYNC_INTERVAL_MINUTES = 30; // Auto-sync every 30 minutes
const BATCH_DELAY_MS = 3000; // Wait 3s after first intercept before sending batch (accumulate more saves)

let pendingBatch = [];
let batchTimer = null;

// ── Alarm Setup ─────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.log('[SaveAtlas BG] Extension installed. Setting up periodic alarm.');
  chrome.alarms.create(SYNC_ALARM_NAME, {
    periodInMinutes: SYNC_INTERVAL_MINUTES,
  });
  updateStatus({ state: 'idle', message: 'Ready. Visit Instagram to sync.' });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM_NAME) {
    console.log('[SaveAtlas BG] Periodic sync alarm fired.');
    triggerInstagramVisit(); // Nudge user or re-trigger if tab is open
  }
});

// ── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'SAVES_INTERCEPTED':
      handleInterceptedSaves(message.payload);
      break;

    case 'CONTENT_SCRIPT_READY':
      console.log('[SaveAtlas BG] Content script ready on:', message.url);
      break;

    case 'GET_STATUS':
      chrome.storage.local.get(['saveatlas_status'], (result) => {
        sendResponse(result.saveatlas_status || { state: 'idle', message: 'No sync yet.' });
      });
      return true; // Keep message channel open for async response

    case 'GET_STATS':
      chrome.storage.local.get(['saveatlas_synced_ids', 'saveatlas_last_sync', 'saveatlas_total'], (result) => {
        sendResponse({
          total: result.saveatlas_total || 0,
          lastSync: result.saveatlas_last_sync || null,
          syncedCount: result.saveatlas_synced_ids?.length || 0,
        });
      });
      return true;

    case 'SET_USER_TOKEN':
      chrome.storage.local.set({ saveatlas_user_token: message.token });
      sendResponse({ ok: true });
      break;

    case 'MANUAL_SYNC':
      triggerManualSync();
      sendResponse({ ok: true });
      break;
  }
});

// ── Core Logic ───────────────────────────────────────────────────────────────

/**
 * Called when content script intercepts saved posts.
 * Accumulates them in a batch and sends after a short delay.
 */
function handleInterceptedSaves(posts) {
  if (!posts || posts.length === 0) return;

  console.log(`[SaveAtlas BG] Intercepted ${posts.length} saves. Queuing for batch send.`);

  pendingBatch.push(...posts);

  // Debounce — wait for more to accumulate
  if (batchTimer) clearTimeout(batchTimer);
  batchTimer = setTimeout(() => {
    flushBatch();
  }, BATCH_DELAY_MS);
}

/**
 * Deduplicates and sends pending batch to SaveAtlas API
 */
async function flushBatch() {
  if (pendingBatch.length === 0) return;

  const batchToSend = [...pendingBatch];
  pendingBatch = [];

  // Deduplicate against already-synced IDs
  const { saveatlas_synced_ids: syncedIds = [] } = await chrome.storage.local.get('saveatlas_synced_ids');
  const syncedSet = new Set(syncedIds);

  const newPosts = batchToSend.filter((p) => p.instagram_id && !syncedSet.has(p.instagram_id));

  if (newPosts.length === 0) {
    console.log('[SaveAtlas BG] All intercepted posts already synced. Skipping.');
    return;
  }

  console.log(`[SaveAtlas BG] Sending ${newPosts.length} new saves to SaveAtlas API.`);
  updateStatus({ state: 'syncing', message: `Syncing ${newPosts.length} new saves...` });

  try {
    const { saveatlas_user_token: token } = await chrome.storage.local.get('saveatlas_user_token');

    const response = await fetch(SAVEATLAS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ saves: newPosts }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API error ${response.status}: ${errText}`);
    }

    const result = await response.json();
    console.log('[SaveAtlas BG] Sync successful:', result);

    // Mark synced IDs in local storage
    const newSyncedIds = [...syncedIds, ...newPosts.map((p) => p.instagram_id)];
    const currentTotal = (await chrome.storage.local.get('saveatlas_total')).saveatlas_total || 0;

    await chrome.storage.local.set({
      saveatlas_synced_ids: newSyncedIds,
      saveatlas_last_sync: new Date().toISOString(),
      saveatlas_total: currentTotal + newPosts.length,
    });

    updateStatus({
      state: 'success',
      message: `Synced ${newPosts.length} saves. Total: ${currentTotal + newPosts.length}`,
    });

    // Show notification for significant syncs
    if (newPosts.length >= 5) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'SaveAtlas Synced',
        message: `${newPosts.length} new saves added to your library.`,
      });
    }
  } catch (err) {
    console.error('[SaveAtlas BG] Sync failed:', err);
    updateStatus({ state: 'error', message: `Sync failed: ${err.message}` });
  }
}

/**
 * Trigger a manual sync by opening/refreshing Instagram saved page
 */
async function triggerManualSync() {
  updateStatus({ state: 'syncing', message: 'Opening Instagram saved posts to sync...' });

  const tabs = await chrome.tabs.query({ url: 'https://www.instagram.com/*' });

  if (tabs.length > 0) {
    // Navigate existing Instagram tab to saved posts
    await chrome.tabs.update(tabs[0].id, {
      url: 'https://www.instagram.com/your_activity/saved/',
      active: true,
    });
  } else {
    // Open a new tab to Instagram saved posts
    await chrome.tabs.create({ url: 'https://www.instagram.com/your_activity/saved/' });
  }
}

/**
 * For periodic background sync — re-navigate if Instagram tab is open
 */
async function triggerInstagramVisit() {
  const tabs = await chrome.tabs.query({ url: 'https://www.instagram.com/*' });
  if (tabs.length > 0) {
    // Reload the saved posts page silently if already open
    chrome.tabs.update(tabs[0].id, { url: 'https://www.instagram.com/your_activity/saved/' });
  }
}

function updateStatus(status) {
  chrome.storage.local.set({ saveatlas_status: { ...status, updatedAt: new Date().toISOString() } });
}
