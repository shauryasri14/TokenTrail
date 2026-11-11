// Content script: watches the chat DOM, estimates tokens, saves the conversation locally and
// drives the floating meter. Injected statically on known AI sites and dynamically on any site
// the user enables with "Track this site".
(async function () {
  if (window.__tokentrail) return;
  window.__tokentrail = true;

  const TT = globalThis.TT;
  const api = TT.api;
  const host = location.hostname;
  const site = TT.siteForHost(host) || { ...TT.GENERIC_SITE, name: host.replace(/^www\./, '') };

  let settings = await TT.getSettings();
  let overlay = null;
  let overlayHidden = false;
  let overlayPos = (await api.storage.local.get('overlayPos')).overlayPos || null;
  const state = { key: null, chat: null, lastTotal: 0, lastSig: '', warned: null };

  // Path identifies a conversation on every supported site (e.g. /c/<id>, /chat/<id>).
  const currentKey = () => TT.chatKey(host, location.pathname);
  const limit = () => TT.limitFor(site.id, settings);

  async function loadChat() {
    state.key = currentKey();
    state.chat = await TT.getChat(state.key);
    state.lastTotal = state.chat ? state.chat.totals.total : 0;
    state.lastSig = '';
    state.warned = null;
  }

  function computeTotals(messages) {
    const t = { total: 0, user: 0, assistant: 0, messages: messages.length, userMessages: 0 };
    for (const m of messages) {
      t.total += m.tokens;
      if (m.role === 'user') { t.user += m.tokens; t.userMessages++; }
      else t.assistant += m.tokens;
    }
    return t;
  }

  const emptyTotals = () => ({ total: 0, user: 0, assistant: 0, messages: 0, userMessages: 0 });

  function snapshot() {
    return {
      siteId: site.id,
      siteName: site.name,
      title: state.chat ? state.chat.title : document.title,
      totals: state.chat ? state.chat.totals : emptyTotals(),
      limit: limit(),
      settings,
    };
  }

  async function scan() {
    if (currentKey() !== state.key) await loadChat();

    const scraped = TT.extractMessages(site.id);
    if (!scraped.length) return render();

    const now = Date.now();
    const prev = state.chat ? state.chat.messages : [];
    const fresh = scraped.map((m, i) => {
      const old = prev[i];
      const same = old && old.text === m.text && old.role === m.role;
      return same ? old : { role: m.role, text: m.text, tokens: TT.estimateTokens(m.text), ts: now };
    });
    const messages = TT.mergeMessages(prev, fresh);
    const totals = computeTotals(messages);
    const sig = messages.length + ':' + totals.total;
    if (sig === state.lastSig) return;
    state.lastSig = sig;

    state.chat = {
      key: state.key,
      site: site.id,
      host,
      url: location.href,
      title: TT.chatTitle(messages),
      messages,
      totals,
      createdAt: (state.chat && state.chat.createdAt) || now,
      updatedAt: now,
    };

    const delta = totals.total - state.lastTotal;
    state.lastTotal = totals.total;
    try {
      await TT.saveChat(state.chat);
      if (delta > 0) await TT.addUsage(site.id, delta);
    } catch (e) {
      if (/context invalidated/i.test(String(e))) return teardown(); // extension reloaded
      console.warn('[TokenTrail] save failed', e);
    }
    render();
  }

  function render() {
    const snap = snapshot();
    const pct = snap.limit ? (snap.totals.total / snap.limit) * 100 : 0;
    const level = TT.levelFor(pct, settings);
    try { api.runtime.sendMessage({ type: 'tt:badge', percent: Math.round(pct), level, active: snap.totals.total > 0 }); } catch (_) {}

    if (!settings.showOverlay || overlayHidden) return;
    if (!overlay) {
      overlay = TT.overlay.create({
        position: overlayPos,
        onCopy: () => TT.copyText(handoff()),
        onDashboard: () => api.runtime.sendMessage({ type: 'tt:openDashboard', key: state.key }),
        onHide: () => { overlay = null; overlayHidden = true; },
        onMove: (pos) => { overlayPos = pos; api.storage.local.set({ overlayPos: pos }); },
      });
    }
    overlay.update(snap);
    // Warn once per level per chat (never step back down from red to amber).
    if (level !== 'ok' && state.warned !== level && state.warned !== 'danger' && snap.totals.total > 0) {
      overlay.warn(level);
      state.warned = level;
    }
  }

  function handoff() {
    return TT.buildHandoff(state.chat || { messages: [] }, { budget: settings.handoffBudget, siteName: site.name });
  }

  // Debounced re-scan on DOM changes (streaming replies mutate constantly).
  let timer = null;
  const schedule = (ms = 900) => { clearTimeout(timer); timer = setTimeout(scan, ms); };
  const observer = new MutationObserver(() => schedule());
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  // SPA navigation doesn't fire page loads; poll the path.
  let lastPath = location.pathname;
  const navTimer = setInterval(() => {
    if (location.pathname !== lastPath) { lastPath = location.pathname; schedule(300); }
  }, 1000);

  function teardown() {
    observer.disconnect();
    clearInterval(navTimer);
    clearTimeout(timer);
    if (overlay) overlay.destroy();
  }

  api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'tt:getState') {
      sendResponse({ ...snapshot(), chat: state.chat, handoff: handoff() });
    } else if (msg.type === 'tt:showOverlay') {
      overlayHidden = false;
      render();
      sendResponse({ ok: true });
    }
  });

  api.storage.onChanged.addListener((changes) => {
    if (!changes.settings) return;
    settings = { ...TT.DEFAULT_SETTINGS, ...(changes.settings.newValue || {}) };
    if (!settings.showOverlay && overlay) { overlay.destroy(); overlay = null; }
    state.lastSig = '';
    render();
  });

  await loadChat();
  scan();
})();
