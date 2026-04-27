/**
 * SaveAtlas Extension — Popup Script
 * Renders live status, stats, and triggers manual sync.
 */

const statusPill = document.getElementById('statusPill');
const statusDot  = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const totalEl    = document.getElementById('totalSaves');
const lastEl     = document.getElementById('lastSync');
const syncBtn    = document.getElementById('syncBtn');
const syncIcon   = document.getElementById('syncIcon');
const msgBox     = document.getElementById('messageBox');

// Load data on open
loadStats();
loadStatus();

// Poll for status updates every second while popup is open
const pollInterval = setInterval(loadStatus, 1500);
window.addEventListener('unload', () => clearInterval(pollInterval));

// Sync button
syncBtn.addEventListener('click', () => {
  setSyncing(true);
  chrome.runtime.sendMessage({ type: 'MANUAL_SYNC' });
  setTimeout(() => loadStatus(), 2000);
});

function loadStats() {
  chrome.runtime.sendMessage({ type: 'GET_STATS' }, (resp) => {
    if (!resp) return;
    totalEl.textContent = resp.total ?? '—';
    lastEl.textContent  = resp.lastSync ? formatRelativeTime(resp.lastSync) : 'Never';
  });
}

function loadStatus() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (resp) => {
    if (!resp) return;
    applyStatus(resp);

    // Refresh stats whenever status updates
    loadStats();
  });
}

function applyStatus(status) {
  const { state, message } = status;

  // Dot state
  statusDot.className = `status-dot ${state}`;

  // Pill label
  const labels = { idle: 'Ready', syncing: 'Syncing', success: 'Synced', error: 'Error' };
  statusText.textContent = labels[state] || 'Ready';

  // Message box
  if (message) {
    msgBox.textContent  = message;
    msgBox.className    = `message-box visible ${state === 'error' ? 'error' : state === 'success' ? 'success' : ''}`;
  } else {
    msgBox.className = 'message-box';
  }

  setSyncing(state === 'syncing');
}

function setSyncing(isSyncing) {
  syncBtn.disabled = isSyncing;
  if (isSyncing) {
    syncIcon.classList.add('spinning');
    syncBtn.querySelector('span') && (syncBtn.querySelector('span').textContent = 'Syncing...');
  } else {
    syncIcon.classList.remove('spinning');
  }
}

function formatRelativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
