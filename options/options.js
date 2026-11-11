const api = TT.api;
const $ = (id) => document.getElementById(id);
const esc = TT.escapeHTML;

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 1400);
}

async function save(patch) {
  await TT.saveSettings(patch);
  toast('Saved');
}

async function render() {
  const s = await TT.getSettings();

  $('showOverlay').checked = !!s.showOverlay;
  for (const id of ['warnAt', 'dangerAt']) {
    $(id).value = s[id];
    $(id + '-out').textContent = s[id] + '%';
  }
  $('handoffBudget').value = s.handoffBudget;

  $('limits').innerHTML = [...TT.SITES, TT.GENERIC_SITE]
    .map((site) => `<label class="limit"><span><i class="dot" style="background:${site.color}"></i>${esc(site.name)}</span>
      <input type="number" min="1000" step="1000" data-site="${site.id}" placeholder="${site.limit}" value="${s.limits[site.id] || ''}" /></label>`)
    .join('');

  const custom = s.customSites || [];
  $('custom').innerHTML = custom.length
    ? custom.map((o) => `<li><span>${esc(o.replace(/^https?:\/\//, ''))}</span><button class="btn danger" data-origin="${esc(o)}">Remove</button></li>`).join('')
    : '<li class="none">None yet. Open any AI chat site, click the TokenTrail icon and choose “Track this site”.</li>';
}

$('showOverlay').addEventListener('change', (e) => save({ showOverlay: e.target.checked }));

for (const id of ['warnAt', 'dangerAt']) {
  $(id).addEventListener('input', (e) => ($(id + '-out').textContent = e.target.value + '%'));
  $(id).addEventListener('change', async () => {
    let warnAt = +$('warnAt').value;
    let dangerAt = +$('dangerAt').value;
    if (warnAt >= dangerAt) {
      if (id === 'warnAt') dangerAt = Math.min(100, warnAt + 5);
      else warnAt = Math.max(30, dangerAt - 5);
    }
    await save({ warnAt, dangerAt });
    render();
  });
}

$('handoffBudget').addEventListener('change', (e) => {
  const v = Math.max(500, Math.min(20000, +e.target.value || TT.DEFAULT_SETTINGS.handoffBudget));
  e.target.value = v;
  save({ handoffBudget: v });
});

$('limits').addEventListener('change', async (e) => {
  const input = e.target.closest('input[data-site]');
  if (!input) return;
  const s = await TT.getSettings();
  const v = Math.round(+input.value);
  if (v >= 1000) s.limits[input.dataset.site] = v;
  else { delete s.limits[input.dataset.site]; input.value = ''; }
  save({ limits: s.limits });
});

$('custom').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-origin]');
  if (!b) return;
  await api.runtime.sendMessage({ type: 'tt:disableSite', origin: b.dataset.origin });
  toast('Site removed');
  render();
});

$('clear').addEventListener('click', async () => {
  if (!confirm('Delete every saved chat and all usage history? This cannot be undone.')) return;
  await TT.clearChats();
  toast('All data deleted');
});

render();
