// Local persistence. Everything stays on this device (storage.local); only small settings go to
// storage.sync so they follow the user between browsers signed into the same account.
//
// Keys:
//   chat:<host><path>   -> { key, site, host, url, title, messages[], totals, createdAt, updatedAt }
//   usage:YYYY-MM-DD    -> { [siteId]: tokens }
//   overlayPos          -> { x, y } of the floating meter
(function (root) {
  const TT = (root.TT = root.TT || {});

  const DEFAULT_SETTINGS = {
    limits: {},          // siteId -> token budget override
    warnAt: 70,          // % of budget where the meter turns amber
    dangerAt: 90,        // % where it turns red
    showOverlay: true,
    handoffBudget: 3000, // max tokens for the handoff prompt
    customSites: [],     // origins the user enabled with "Track this site"
  };

  const api = () => TT.api;

  async function syncArea() {
    try {
      await api().storage.sync.get('settings');
      return api().storage.sync;
    } catch (_) {
      return api().storage.local; // sync disabled (e.g. Firefox without account in some setups)
    }
  }

  async function getSettings() {
    const area = await syncArea();
    const { settings } = await area.get('settings');
    return { ...DEFAULT_SETTINGS, ...(settings || {}), limits: { ...((settings && settings.limits) || {}) } };
  }

  async function saveSettings(patch) {
    const area = await syncArea();
    const next = { ...(await getSettings()), ...patch };
    await area.set({ settings: next });
    return next;
  }

  function limitFor(siteId, settings) {
    const own = settings && settings.limits && settings.limits[siteId];
    if (own) return own;
    const s = TT.siteById(siteId);
    return (s && s.limit) || TT.GENERIC_SITE.limit;
  }

  function chatKey(host, path) {
    return 'chat:' + host + (path || '/');
  }

  async function getChat(key) {
    const res = await api().storage.local.get(key);
    return res[key] || null;
  }

  async function saveChat(chat) {
    await api().storage.local.set({ [chat.key]: chat });
  }

  async function listChats() {
    const all = await api().storage.local.get(null);
    return Object.keys(all)
      .filter((k) => k.startsWith('chat:'))
      .map((k) => all[k])
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async function deleteChat(key) {
    await api().storage.local.remove(key);
  }

  async function clearChats() {
    const all = await api().storage.local.get(null);
    const keys = Object.keys(all).filter((k) => k.startsWith('chat:') || k.startsWith('usage:'));
    if (keys.length) await api().storage.local.remove(keys);
  }

  function dayKey(d = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `usage:${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  async function addUsage(siteId, delta) {
    if (!delta || delta <= 0) return;
    const key = dayKey();
    const cur = (await api().storage.local.get(key))[key] || {};
    cur[siteId] = (cur[siteId] || 0) + delta;
    await api().storage.local.set({ [key]: cur });
  }

  // Returns [{ date: 'YYYY-MM-DD', label: 'Mon', bySite: {...}, total }] oldest first.
  async function getUsage(days = 7) {
    const keys = [];
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d);
      keys.push(dayKey(d));
    }
    const res = await api().storage.local.get(keys);
    return keys.map((k, i) => {
      const bySite = res[k] || {};
      return {
        date: k.slice(6),
        label: dates[i].toLocaleDateString(undefined, { weekday: 'short' }),
        bySite,
        total: Object.values(bySite).reduce((a, b) => a + b, 0),
      };
    });
  }

  // Merge freshly scraped messages into the stored list. Some sites virtualise long chats and only
  // render the most recent turns, so a shorter scrape that lines up with the tail of what we
  // already have must not throw the older messages away.
  function mergeMessages(stored, fresh) {
    if (!stored || !stored.length) return fresh;
    if (!fresh.length) return stored;
    if (fresh.length >= stored.length) return fresh;
    const j = stored.findIndex((m) => m.role === fresh[0].role && m.text === fresh[0].text);
    if (j === -1) return stored.concat(fresh); // no overlap: treat as a continuation
    return stored.slice(0, j).concat(fresh);
  }

  Object.assign(TT, {
    DEFAULT_SETTINGS, getSettings, saveSettings, limitFor, chatKey, getChat, saveChat,
    listChats, deleteChat, clearChats, addUsage, getUsage, mergeMessages, dayKey,
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { mergeMessages, DEFAULT_SETTINGS };
  }
})(globalThis);
