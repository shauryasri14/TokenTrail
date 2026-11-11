// Background (service worker on Chromium, event page on Firefox).
// - Shows the current chat's usage % on the toolbar badge.
// - Opens the dashboard.
// - Injects TokenTrail into sites the user enables with "Track this site" (optional host permission).
if (typeof importScripts === 'function' && !(globalThis.TT && globalThis.TT.api)) {
  importScripts('lib/browser.js', 'lib/sites.js', 'lib/storage.js');
}

const api = globalThis.TT.api;
const CUSTOM_SCRIPT_ID = 'tokentrail-custom-sites';
const CONTENT_FILES = [
  'src/lib/browser.js', 'src/lib/sites.js', 'src/lib/tokenizer.js', 'src/lib/storage.js',
  'src/lib/handoff.js', 'src/lib/ui.js', 'src/content/adapters.js', 'src/content/overlay.js',
  'src/content/content.js',
];
const BADGE = { ok: '#16a34a', warn: '#d97706', danger: '#dc2626' };

const BUILTIN_HOSTS = new Set(TT.SITES.flatMap((s) => s.hosts));
const toPattern = (origin) => origin.replace(/\/+$/, '') + '/*';
const isBuiltin = (origin) => {
  try { return BUILTIN_HOSTS.has(new URL(origin).hostname); } catch (_) { return false; }
};

// Keep the dynamic content-script registration in sync with settings.customSites.
async function syncCustomScripts() {
  const { customSites } = await TT.getSettings();
  const matches = (customSites || []).filter((o) => !isBuiltin(o)).map(toPattern);
  try {
    const existing = await api.scripting.getRegisteredContentScripts({ ids: [CUSTOM_SCRIPT_ID] });
    if (existing.length) await api.scripting.unregisterContentScripts({ ids: [CUSTOM_SCRIPT_ID] });
  } catch (_) {}
  if (!matches.length) return;
  try {
    await api.scripting.registerContentScripts([
      { id: CUSTOM_SCRIPT_ID, matches, js: CONTENT_FILES, runAt: 'document_idle', persistAcrossSessions: true },
    ]);
  } catch (e) {
    // Firefox versions without persistAcrossSessions support: register for this session only.
    await api.scripting.registerContentScripts([{ id: CUSTOM_SCRIPT_ID, matches, js: CONTENT_FILES, runAt: 'document_idle' }]);
  }
}

async function injectInto(tabId) {
  try {
    await api.scripting.executeScript({ target: { tabId }, files: CONTENT_FILES });
  } catch (e) {
    console.warn('[TokenTrail] inject failed', e);
  }
}

async function enableOrigins(origins) {
  const settings = await TT.getSettings();
  const set = new Set(settings.customSites || []);
  origins.forEach((o) => set.add(o.replace(/\/\*$/, '')));
  await TT.saveSettings({ customSites: [...set] });
  await syncCustomScripts();
  for (const o of origins) {
    const tabs = await api.tabs.query({ url: toPattern(o.replace(/\/\*$/, '')) });
    for (const t of tabs) injectInto(t.id);
  }
}

// Granted from the popup. Handled here because Firefox may close the popup during the prompt.
api.permissions.onAdded.addListener((perms) => {
  const origins = (perms.origins || []).filter((o) => o !== '*://*/*' && o !== '<all_urls>');
  if (origins.length) enableOrigins(origins);
});

api.permissions.onRemoved.addListener(async (perms) => {
  const removed = new Set((perms.origins || []).map((o) => o.replace(/\/\*$/, '')));
  if (!removed.size) return;
  const settings = await TT.getSettings();
  await TT.saveSettings({ customSites: (settings.customSites || []).filter((o) => !removed.has(o)) });
  await syncCustomScripts();
});

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== 'string') return;

  if (msg.type === 'tt:badge' && sender.tab) {
    const tabId = sender.tab.id;
    const text = msg.active ? Math.min(999, msg.percent) + '%' : '';
    api.action.setBadgeText({ tabId, text });
    api.action.setBadgeBackgroundColor({ tabId, color: BADGE[msg.level] || BADGE.ok });
    if (api.action.setBadgeTextColor) api.action.setBadgeTextColor({ tabId, color: '#ffffff' });
    return;
  }

  if (msg.type === 'tt:openDashboard') {
    const url = api.runtime.getURL('dashboard/dashboard.html') + (msg.key ? '#' + encodeURIComponent(msg.key) : '');
    api.tabs.create({ url });
    return;
  }

  if (msg.type === 'tt:enableSite') {
    // Popup path for browsers where the popup stays open (permission already granted).
    enableOrigins([msg.origin]).then(() => sendResponse({ ok: true }), (e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }

  if (msg.type === 'tt:disableSite') {
    (async () => {
      const settings = await TT.getSettings();
      await TT.saveSettings({ customSites: (settings.customSites || []).filter((o) => o !== msg.origin) });
      await syncCustomScripts();
      try { await api.permissions.remove({ origins: [toPattern(msg.origin)] }); } catch (_) {}
      sendResponse({ ok: true });
    })();
    return true;
  }
});

api.runtime.onInstalled.addListener((details) => {
  syncCustomScripts();
  if (details.reason === 'install') api.tabs.create({ url: api.runtime.getURL('dashboard/dashboard.html#welcome') });
});
api.runtime.onStartup.addListener(syncCustomScripts);
