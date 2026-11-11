const api = TT.api;
const $ = (id) => document.getElementById(id);

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1600);
}

async function activeTab() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function askTab(tabId, msg) {
  try {
    return await api.tabs.sendMessage(tabId, msg);
  } catch (_) {
    return null; // no content script on this page
  }
}

function renderTracking(state) {
  const { totals, limit, settings } = state;
  const pct = limit ? (totals.total / limit) * 100 : 0;
  const level = TT.levelFor(pct, settings);
  const site = TT.siteById(state.siteId) || TT.GENERIC_SITE;

  $('ring').innerHTML = TT.ringSVG(pct, 116, 11, level);
  $('pct').textContent = Math.round(pct) + '%';
  $('used').textContent = `${TT.formatTokens(totals.total)} / ${TT.formatTokens(limit)}`;
  $('site-dot').style.background = site.color;
  $('site-name').textContent = state.siteName;
  $('title').textContent = (state.chat && state.chat.title) || 'New chat';
  $('s-user').textContent = TT.formatTokens(totals.user);
  $('s-ai').textContent = TT.formatTokens(totals.assistant);
  $('s-left').textContent = totals.total ? TT.exchangesLeft(totals, limit) : '—';

  const status = $('status');
  status.className = 'status ' + level;
  status.textContent = !totals.total
    ? 'Waiting for messages…'
    : level === 'danger' ? 'Almost out. Save the context now.'
    : level === 'warn' ? 'Getting close to the limit'
    : 'Plenty of room';

  const disabled = !state.chat;
  $('copy').disabled = disabled;
  $('save-md').disabled = disabled;

  $('copy').onclick = async () => {
    const ok = await TT.copyText(state.handoff);
    toast(ok ? 'Handoff prompt copied' : 'Copy failed');
  };
  $('save-md').onclick = () => {
    TT.download(`${TT.slug(state.chat.title)}.md`, TT.toMarkdown(state.chat, state.siteName));
  };
  if (state.settings.showOverlay) {
    $('show-meter').hidden = false;
    $('show-meter').onclick = async () => {
      const tab = await activeTab();
      await askTab(tab.id, { type: 'tt:showOverlay' });
      window.close();
    };
  }
  $('tracking').hidden = false;
}

function renderIdle(tab) {
  let url;
  try { url = new URL(tab.url || ''); } catch (_) {}
  const web = url && /^https?:$/.test(url.protocol);
  if (!web) {
    $('idle-title').textContent = 'Nothing to track here';
    $('idle-text').textContent = 'Open an AI chat in a normal web page and TokenTrail will start counting.';
  } else {
    $('idle-text').textContent = `TokenTrail isn't running on ${url.hostname}. If this is an AI chat, enable it here. The page will be scanned for messages.`;
    const btn = $('track');
    btn.hidden = false;
    btn.onclick = async () => {
      const origin = url.origin;
      // Firefox may close the popup during this prompt; the background script finishes the job
      // via permissions.onAdded either way.
      const granted = await api.permissions.request({ origins: [origin + '/*'] });
      if (!granted) return toast('Permission was not granted');
      await api.runtime.sendMessage({ type: 'tt:enableSite', origin });
      toast('Tracking enabled');
      setTimeout(init, 900);
    };
  }
  $('idle').hidden = false;
}

async function renderToday() {
  const days = await TT.getUsage(7);
  const max = Math.max(1, ...days.map((d) => d.total));
  $('today').textContent = TT.formatTokens(days[days.length - 1].total);
  $('spark').innerHTML = days
    .map((d, i) => `<div class="${i === days.length - 1 ? 'today-bar' : ''}" title="${d.date}: ${d.total} tokens">` +
      `<i style="height:${Math.round((d.total / max) * 32)}px"></i><span>${d.label.slice(0, 2)}</span></div>`)
    .join('');
}

async function init() {
  $('tracking').hidden = true;
  $('idle').hidden = true;
  const tab = await activeTab();
  const state = tab && (await askTab(tab.id, { type: 'tt:getState' }));
  if (state) renderTracking(state);
  else renderIdle(tab || {});
  renderToday();
}

$('settings').onclick = () => { api.runtime.openOptionsPage(); window.close(); };
$('dashboard').onclick = () => { api.tabs.create({ url: api.runtime.getURL('dashboard/dashboard.html') }); window.close(); };

init();
