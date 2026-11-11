// Small UI helpers shared by the on-page meter, popup and dashboard.
(function (root) {
  const TT = (root.TT = root.TT || {});

  const LEVEL_COLORS = { ok: '#22c55e', warn: '#f59e0b', danger: '#ef4444' };

  function levelFor(percent, settings) {
    const warn = (settings && settings.warnAt) || 70;
    const danger = (settings && settings.dangerAt) || 90;
    if (percent >= danger) return 'danger';
    if (percent >= warn) return 'warn';
    return 'ok';
  }

  let gradId = 0;
  // Circular gauge as an SVG string. `percent` 0..100+ ; colour follows the level.
  function ringSVG(percent, size, stroke, level) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(100, percent || 0));
    const id = 'ttg' + ++gradId;
    const end = LEVEL_COLORS[level || 'ok'];
    return (
      `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">` +
      `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="${level === 'ok' ? '#22d3ee' : end}"/>` +
      `</linearGradient></defs>` +
      `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="currentColor" stroke-opacity=".14" stroke-width="${stroke}"/>` +
      `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#${id})" stroke-width="${stroke}" ` +
      `stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - p / 100)).toFixed(2)}" ` +
      `transform="rotate(-90 ${size / 2} ${size / 2})" style="transition:stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)"/>` +
      `</svg>`
    );
  }

  // Estimate how many more back-and-forth exchanges fit, from this chat's average exchange size.
  function exchangesLeft(totals, limit) {
    const turns = Math.max(1, totals.userMessages || 0);
    const avg = Math.max(50, totals.total / turns);
    return Math.max(0, Math.floor((limit - totals.total) / avg));
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function timeAgo(ts) {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return m + 'm ago';
    const h = Math.round(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.round(h / 24);
    return d < 30 ? d + 'd ago' : new Date(ts).toLocaleDateString();
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) {}
      ta.remove();
      return ok;
    }
  }

  function download(filename, text, type = 'text/markdown') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function slug(s) {
    return String(s || 'chat').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'chat';
  }

  Object.assign(TT, { LEVEL_COLORS, levelFor, ringSVG, exchangesLeft, escapeHTML, timeAgo, copyText, download, slug });
})(globalThis);
