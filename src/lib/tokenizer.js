// Offline token estimator. Real tokenizers (BPE) aren't shipped to keep the extension tiny and
// model-agnostic; this blends two well-known heuristics (≈4 chars/token and ≈0.75 words/token),
// and counts CJK characters individually since each is usually ≥1 token.
(function (root) {
  const TT = (root.TT = root.TT || {});

  const CJK = /[぀-ヿ㐀-䶿一-鿿가-힯豈-﫿]/g;
  const WORD = /[\p{L}\p{N}_]+/gu;
  const PUNCT = /[^\s\p{L}\p{N}_]/gu;

  function estimateTokens(text) {
    if (!text) return 0;
    const s = String(text);
    const cjk = (s.match(CJK) || []).length;
    const rest = cjk ? s.replace(CJK, ' ') : s;
    const compact = rest.replace(/\s+/g, ' ').trim();
    if (!compact && !cjk) return 0;

    const words = compact.match(WORD) || [];
    const punct = (compact.match(PUNCT) || []).length;
    // Long words (code identifiers, URLs) split into several tokens.
    const wordTokens = words.reduce((n, w) => n + Math.max(1, Math.ceil(w.length / 6)), 0);

    const byChars = compact.length / 4;
    const byWords = wordTokens * 1.1 + punct * 0.6;
    return Math.max(1, Math.round((byChars + byWords) / 2 + cjk * 1.05));
  }

  function formatTokens(n) {
    n = Math.max(0, Math.round(n || 0));
    if (n < 1000) return String(n);
    if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    if (n < 1e6) return Math.round(n / 1000) + 'k';
    return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  }

  TT.estimateTokens = estimateTokens;
  TT.formatTokens = formatTokens;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { estimateTokens, formatTokens };
  }
})(globalThis);
