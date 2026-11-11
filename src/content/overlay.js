// Floating, draggable token meter rendered inside a closed shadow root so the host site's CSS
// can't break it (and ours can't break the site).
(function (root) {
  const TT = (root.TT = root.TT || {});

  const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .wrap {
    --bg: rgba(17, 18, 28, .82); --fg: #eef0ff; --muted: #a3a8c3; --line: rgba(255,255,255,.09);
    --accent: linear-gradient(135deg, #7c5cff, #22d3ee);
    position: fixed; z-index: 2147483646; right: 20px; bottom: 96px;
    font: 500 12.5px/1.35 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Inter, sans-serif;
    color: var(--fg); user-select: none; -webkit-user-select: none;
  }
  @media (prefers-color-scheme: light) {
    .wrap { --bg: rgba(255,255,255,.88); --fg: #161827; --muted: #5b6078; --line: rgba(20,20,40,.1); }
  }
  .pill {
    display: flex; align-items: center; gap: 9px; padding: 6px 12px 6px 6px; border-radius: 999px;
    background: var(--bg); backdrop-filter: blur(14px) saturate(1.4); -webkit-backdrop-filter: blur(14px) saturate(1.4);
    border: 1px solid var(--line); box-shadow: 0 8px 30px rgba(0,0,0,.25);
    cursor: grab; transition: transform .2s ease, box-shadow .2s ease;
  }
  .pill:hover { transform: translateY(-1px); box-shadow: 0 12px 36px rgba(0,0,0,.3); }
  .pill:active { cursor: grabbing; }
  .ring { position: relative; width: 34px; height: 34px; color: var(--fg); flex: none; }
  .ring svg { display: block; }
  .ring b { position: absolute; inset: 0; display: grid; place-items: center; font-size: 9.5px; font-weight: 700; }
  .count { font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
  .count small { color: var(--muted); font-weight: 500; }
  .site { color: var(--muted); font-size: 11px; }
  .panel {
    position: absolute; right: 0; bottom: calc(100% + 10px); width: 290px; padding: 14px;
    border-radius: 16px; background: var(--bg); border: 1px solid var(--line);
    backdrop-filter: blur(16px) saturate(1.4); -webkit-backdrop-filter: blur(16px) saturate(1.4);
    box-shadow: 0 18px 50px rgba(0,0,0,.35);
    opacity: 0; transform: translateY(6px) scale(.98); pointer-events: none;
    transition: opacity .18s ease, transform .18s ease;
  }
  .wrap.open .panel { opacity: 1; transform: none; pointer-events: auto; }
  .wrap.below .panel { bottom: auto; top: calc(100% + 10px); }
  .title { font-weight: 700; font-size: 13px; margin: 0 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { color: var(--muted); font-size: 11.5px; margin-bottom: 12px; }
  .bar { height: 8px; border-radius: 99px; background: var(--line); overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: 99px; background: var(--accent); transition: width .5s cubic-bezier(.2,.8,.2,1); }
  .bar.warn i { background: linear-gradient(90deg, #f59e0b, #f97316); }
  .bar.danger i { background: linear-gradient(90deg, #ef4444, #f43f5e); }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
  .stat { padding: 8px; border-radius: 10px; background: var(--line); }
  .stat span { display: block; color: var(--muted); font-size: 10.5px; }
  .stat strong { font-size: 14px; font-variant-numeric: tabular-nums; }
  .note { color: var(--muted); font-size: 11.5px; margin-bottom: 12px; }
  .note b { color: var(--fg); }
  .row { display: flex; gap: 6px; }
  button {
    all: unset; flex: 1; text-align: center; padding: 8px 10px; border-radius: 10px; cursor: pointer;
    font: 600 12px/1.2 inherit; font-family: inherit; color: var(--fg); background: var(--line);
    transition: filter .15s ease, transform .1s ease;
  }
  button:hover { filter: brightness(1.25); }
  button:active { transform: scale(.97); }
  button.primary { background: var(--accent); color: #fff; }
  .toast {
    position: absolute; right: 0; bottom: calc(100% + 10px); width: 260px; padding: 10px 12px; border-radius: 12px;
    background: #ef4444; color: #fff; font-weight: 600; box-shadow: 0 10px 30px rgba(239,68,68,.35);
    animation: pop .25s ease;
  }
  .toast.warn { background: #f59e0b; color: #1b1300; box-shadow: 0 10px 30px rgba(245,158,11,.35); }
  .toast button { margin-top: 8px; background: rgba(0,0,0,.18); color: inherit; }
  .wrap.open .toast { display: none; }
  @keyframes pop { from { opacity: 0; transform: translateY(6px); } }
  .hidden { display: none !important; }
  `;

  function create({ onCopy, onDashboard, onHide, onMove, position }) {
    const host = document.createElement('div');
    host.id = 'tokentrail-root';
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `<style>${CSS}</style>
      <div class="wrap">
        <div class="panel" part="panel">
          <p class="title"></p>
          <div class="sub"></div>
          <div class="bar"><i style="width:0"></i></div>
          <div class="grid">
            <div class="stat"><span>You</span><strong data-k="user">0</strong></div>
            <div class="stat"><span>AI</span><strong data-k="assistant">0</strong></div>
            <div class="stat"><span>Messages</span><strong data-k="count">0</strong></div>
          </div>
          <div class="note"></div>
          <div class="row">
            <button class="primary" data-a="copy">Copy handoff</button>
            <button data-a="dash">Dashboard</button>
            <button data-a="hide" title="Hide on this page">Hide</button>
          </div>
        </div>
        <div class="toast hidden"></div>
        <div class="pill" title="TokenTrail: click for details, drag to move">
          <div class="ring"></div>
          <div><div class="count"></div><div class="site"></div></div>
        </div>
      </div>`;
    document.documentElement.appendChild(host);

    const $ = (s) => shadow.querySelector(s);
    const wrap = $('.wrap');
    const pill = $('.pill');
    const toast = $('.toast');

    if (position) place(position.x, position.y);

    function place(x, y) {
      const w = pill.offsetWidth || 160;
      const h = pill.offsetHeight || 46;
      x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
      y = Math.max(8, Math.min(window.innerHeight - h - 8, y));
      Object.assign(wrap.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
      wrap.classList.toggle('below', y < 340);
    }

    // Drag vs click: only treat as a click if the pointer barely moved.
    let drag = null;
    pill.addEventListener('pointerdown', (e) => {
      const r = wrap.getBoundingClientRect();
      drag = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false };
      pill.setPointerCapture(e.pointerId);
    });
    pill.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      place(drag.ox + dx, drag.oy + dy);
    });
    pill.addEventListener('pointerup', () => {
      if (!drag) return;
      if (drag.moved) {
        const r = wrap.getBoundingClientRect();
        onMove && onMove({ x: r.left, y: r.top });
      } else {
        wrap.classList.toggle('open');
      }
      drag = null;
    });

    shadow.addEventListener('click', async (e) => {
      const a = e.target.closest && e.target.closest('[data-a]');
      if (!a) return;
      const act = a.getAttribute('data-a');
      if (act === 'copy') {
        const ok = await onCopy();
        a.textContent = ok ? 'Copied ✓' : 'Copy failed';
        setTimeout(() => (a.textContent = a.dataset.label || 'Copy handoff'), 1600);
        toast.classList.add('hidden');
      } else if (act === 'dash') onDashboard();
      else if (act === 'hide') { host.remove(); onHide && onHide(); }
      else if (act === 'dismiss') toast.classList.add('hidden');
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') wrap.classList.remove('open'); });

    function update(s) {
      const pct = s.limit ? (s.totals.total / s.limit) * 100 : 0;
      const level = TT.levelFor(pct, s.settings);
      $('.ring').innerHTML = TT.ringSVG(pct, 34, 4, level) + `<b>${Math.min(999, Math.round(pct))}%</b>`;
      $('.count').innerHTML = `${TT.formatTokens(s.totals.total)} <small>/ ${TT.formatTokens(s.limit)}</small>`;
      $('.site').textContent = s.siteName;
      $('.title').textContent = s.title || 'Current chat';
      $('.sub').textContent = `${s.siteName} · estimated tokens · saved locally`;
      const bar = $('.bar');
      bar.className = 'bar ' + level;
      bar.firstElementChild.style.width = Math.min(100, pct) + '%';
      $('[data-k="user"]').textContent = TT.formatTokens(s.totals.user);
      $('[data-k="assistant"]').textContent = TT.formatTokens(s.totals.assistant);
      $('[data-k="count"]').textContent = s.totals.messages;
      const left = TT.exchangesLeft(s.totals, s.limit);
      $('.note').innerHTML = s.totals.total >= s.limit
        ? '<b>Over budget.</b> The chat may get cut off at any moment. Copy the handoff now.'
        : `About <b>${left}</b> more exchange${left === 1 ? '' : 's'} before the budget runs out.`;
    }

    function warn(level) {
      toast.className = 'toast ' + (level === 'danger' ? '' : 'warn');
      toast.innerHTML = (level === 'danger'
        ? 'This chat is almost out of tokens. Save the context before it gets cut off.'
        : 'This chat has used most of its token budget.') +
        '<div class="row"><button data-a="copy" data-label="Copy handoff">Copy handoff</button><button data-a="dismiss">Dismiss</button></div>';
    }

    return { update, warn, destroy: () => host.remove() };
  }

  TT.overlay = { create };
})(globalThis);
