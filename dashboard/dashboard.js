const api = TT.api;
const $ = (id) => document.getElementById(id);
const esc = TT.escapeHTML;

let chats = [];
let settings = TT.DEFAULT_SETTINGS;
let current = null;

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 1700);
}

const siteKeyOf = (chat) => (chat.site === 'generic' ? 'generic:' + chat.host : chat.site);

function renderTiles(usage) {
  const total = chats.reduce((n, c) => n + ((c.totals && c.totals.total) || 0), 0);
  $('t-chats').textContent = chats.length;
  $('t-tokens').textContent = TT.formatTokens(total);
  const today = usage[usage.length - 1].total;
  const yesterday = usage[usage.length - 2].total;
  $('t-today').textContent = TT.formatTokens(today);
  const trend = $('t-trend');
  if (yesterday) {
    const diff = Math.round(((today - yesterday) / yesterday) * 100);
    trend.textContent = `${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff)}% vs yesterday`;
    trend.className = diff >= 0 ? 'up' : 'down';
  } else trend.textContent = '';

  const perSite = {};
  chats.forEach((c) => (perSite[c.site] = (perSite[c.site] || 0) + c.totals.total));
  const top = Object.entries(perSite).sort((a, b) => b[1] - a[1])[0];
  $('t-top').textContent = top ? (TT.siteById(top[0]) || TT.GENERIC_SITE).name : '—';
}

function renderWeek(usage) {
  const max = Math.max(1, ...usage.map((d) => d.total));
  const sitesSeen = new Set();
  $('week-chart').innerHTML = usage
    .map((d, i) => {
      const segs = Object.entries(d.bySite)
        .sort((a, b) => b[1] - a[1])
        .map(([id, v]) => {
          sitesSeen.add(id);
          const s = TT.siteById(id) || TT.GENERIC_SITE;
          return `<i style="height:${(v / max) * 100}%;background:${s.color}" title="${esc(s.name)}: ${v.toLocaleString()} tokens"></i>`;
        })
        .join('');
      return `<div class="week-col ${i === usage.length - 1 ? 'today' : ''}">
        <b>${d.total ? TT.formatTokens(d.total) : ''}</b>
        <div class="week-stack">${segs}</div>
        <span>${esc(d.label)}</span></div>`;
    })
    .join('');
  $('week-total').textContent = TT.formatTokens(usage.reduce((n, d) => n + d.total, 0)) + ' tokens';
  $('week-legend').innerHTML = [...sitesSeen]
    .map((id) => {
      const s = TT.siteById(id) || TT.GENERIC_SITE;
      return `<span><i class="dot" style="background:${s.color}"></i>${esc(s.name)}</span>`;
    })
    .join('') || '<span>No usage recorded this week yet.</span>';
}

function renderSiteBars() {
  const groups = {};
  chats.forEach((c) => {
    const k = siteKeyOf(c);
    const g = (groups[k] = groups[k] || { info: TT.siteInfo(c), tokens: 0, count: 0 });
    g.tokens += c.totals.total;
    g.count++;
  });
  const rows = Object.values(groups).sort((a, b) => b.tokens - a.tokens);
  const max = Math.max(1, ...rows.map((r) => r.tokens));
  $('site-bars').innerHTML = rows.length
    ? rows
        .slice(0, 8)
        .map((r) => `<div class="site-row">
          <span class="name"><i class="dot" style="background:${r.info.color}"></i>${esc(r.info.name)}</span>
          <span class="track"><i style="width:${(r.tokens / max) * 100}%;background:${r.info.color}"></i></span>
          <span class="val">${TT.formatTokens(r.tokens)} · ${r.count}</span></div>`)
        .join('')
    : '<p class="muted">Nothing saved yet.</p>';

  const sel = $('site-filter');
  const chosen = sel.value;
  sel.innerHTML = '<option value="">All sites</option>' +
    Object.entries(groups).map(([k, g]) => `<option value="${esc(k)}">${esc(g.info.name)}</option>`).join('');
  sel.value = groups[chosen] ? chosen : '';
}

function renderList() {
  const q = $('q').value.trim().toLowerCase();
  const site = $('site-filter').value;
  const list = chats.filter((c) => {
    if (site && siteKeyOf(c) !== site) return false;
    if (!q) return true;
    return (c.title || '').toLowerCase().includes(q) || c.messages.some((m) => m.text.toLowerCase().includes(q));
  });

  $('empty').hidden = chats.length > 0;
  $('chats').innerHTML = list
    .map((c) => {
      const info = TT.siteInfo(c);
      const limit = TT.limitFor(c.site, settings);
      const pct = (c.totals.total / limit) * 100;
      const level = TT.levelFor(pct, settings);
      return `<button class="card chat" data-key="${esc(c.key)}">
        <div class="chat-top"><span class="chip"><i class="dot" style="background:${info.color}"></i>${esc(info.name)}</span>
          <span class="muted">${TT.timeAgo(c.updatedAt)}</span></div>
        <h4>${esc(c.title || 'Untitled chat')}</h4>
        <div class="bar ${level}"><i style="width:${Math.min(100, pct)}%"></i></div>
        <div class="chat-foot"><span><b>${TT.formatTokens(c.totals.total)}</b> / ${TT.formatTokens(limit)} tokens</span>
          <span>${c.totals.messages} messages</span></div>
      </button>`;
    })
    .join('');
  if (chats.length && !list.length) $('chats').innerHTML = '<p class="muted">No chats match your search.</p>';
}

function openDrawer(chat) {
  current = chat;
  const info = TT.siteInfo(chat);
  const limit = TT.limitFor(chat.site, settings);
  const pct = (chat.totals.total / limit) * 100;
  $('d-dot').style.background = info.color;
  $('d-site').textContent = info.name;
  $('d-title').textContent = chat.title || 'Untitled chat';
  $('d-meta').textContent = `Started ${new Date(chat.createdAt).toLocaleString()} · updated ${TT.timeAgo(chat.updatedAt)}`;
  $('d-bar').className = 'bar ' + TT.levelFor(pct, settings);
  $('d-bar').firstElementChild.style.width = Math.min(100, pct) + '%';
  $('d-stats').innerHTML =
    `<span><b>${chat.totals.total.toLocaleString()}</b> of ${limit.toLocaleString()} tokens (${Math.round(pct)}%)</span>` +
    `<span>You ${TT.formatTokens(chat.totals.user)}</span><span>AI ${TT.formatTokens(chat.totals.assistant)}</span>` +
    `<span>${chat.totals.messages} messages</span>`;
  $('d-open').href = chat.url;

  $('d-messages').innerHTML = chat.messages
    .map((m, i) => {
      const long = m.text.length > 1200;
      const who = m.role === 'user' ? 'You' : m.role === 'assistant' ? 'AI' : 'Message';
      return `<article class="msg ${m.role} ${long ? 'long' : ''}">
        <header><span>${who}</span><span>${TT.formatTokens(m.tokens)} tokens</span></header>
        <p>${esc(m.text)}</p>${long ? `<button class="more" data-i="${i}">Show more</button>` : ''}</article>`;
    })
    .join('');

  $('scrim').hidden = false;
  $('drawer').classList.add('open');
  $('drawer').setAttribute('aria-hidden', 'false');
  history.replaceState(null, '', '#' + encodeURIComponent(chat.key));
}

function closeDrawer() {
  current = null;
  $('scrim').hidden = true;
  $('drawer').classList.remove('open');
  $('drawer').setAttribute('aria-hidden', 'true');
  history.replaceState(null, '', location.pathname);
}

async function load() {
  [chats, settings] = await Promise.all([TT.listChats(), TT.getSettings()]);
  const usage = await TT.getUsage(7);
  renderTiles(usage);
  renderWeek(usage);
  renderSiteBars();
  renderList();
}

// Events
$('chats').addEventListener('click', (e) => {
  const card = e.target.closest('.chat');
  if (!card) return;
  const chat = chats.find((c) => c.key === card.dataset.key);
  if (chat) openDrawer(chat);
});
$('d-messages').addEventListener('click', (e) => {
  const b = e.target.closest('.more');
  if (!b) return;
  const msg = b.closest('.msg');
  msg.classList.toggle('expanded');
  b.textContent = msg.classList.contains('expanded') ? 'Show less' : 'Show more';
});
$('q').addEventListener('input', renderList);
$('site-filter').addEventListener('change', renderList);
$('scrim').addEventListener('click', closeDrawer);
$('d-close').addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) closeDrawer(); });

$('d-copy').addEventListener('click', async () => {
  const text = TT.buildHandoff(current, { budget: settings.handoffBudget, siteName: TT.siteInfo(current).name });
  toast((await TT.copyText(text)) ? 'Handoff prompt copied' : 'Copy failed');
});
$('d-md').addEventListener('click', () => TT.download(`${TT.slug(current.title)}.md`, TT.toMarkdown(current, TT.siteInfo(current).name)));
$('d-json').addEventListener('click', () => TT.download(`${TT.slug(current.title)}.json`, JSON.stringify(current, null, 2), 'application/json'));
$('d-delete').addEventListener('click', async () => {
  if (!confirm(`Delete "${current.title}"? This can't be undone.`)) return;
  await TT.deleteChat(current.key);
  closeDrawer();
  toast('Chat deleted');
  load();
});
$('export-all').addEventListener('click', () => {
  const date = new Date().toISOString().slice(0, 10);
  TT.download(`tokentrail-export-${date}.json`, JSON.stringify({ exportedAt: Date.now(), chats }, null, 2), 'application/json');
});
$('welcome-close').addEventListener('click', () => { $('welcome').hidden = true; history.replaceState(null, '', location.pathname); });

// Live refresh while chats are being written in other tabs.
let refresh = null;
api.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !Object.keys(changes).some((k) => k.startsWith('chat:') || k.startsWith('usage:'))) return;
  clearTimeout(refresh);
  refresh = setTimeout(async () => {
    await load();
    if (current) {
      const fresh = chats.find((c) => c.key === current.key);
      if (fresh && fresh.updatedAt !== current.updatedAt) openDrawer(fresh);
    }
  }, 800);
});

(async () => {
  await load();
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash === 'welcome') $('welcome').hidden = false;
  else if (hash) {
    const chat = chats.find((c) => c.key === hash);
    if (chat) openDrawer(chat);
  }
})();
