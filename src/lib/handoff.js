// Builds a "continue this conversation" prompt that fits in a token budget, plus Markdown export.
// Fully offline: older turns are summarised extractively (their opening sentence), the most
// recent turns are kept verbatim (trimmed from the middle if they're huge).
(function (root) {
  const TT = (root.TT = root.TT || {});
  const est = (t) => (TT.estimateTokens ? TT.estimateTokens(t) : Math.ceil(String(t).length / 4));

  const LABEL = { user: 'Me', assistant: 'AI', unknown: 'Message' };
  const label = (role) => LABEL[role] || LABEL.unknown;

  function firstSentence(text, max = 180) {
    const flat = String(text).replace(/\s+/g, ' ').trim();
    const m = flat.match(/^(.{20,}?[.!?])(\s|$)/);
    const s = m ? m[1] : flat;
    return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
  }

  // Keep the start and end of a long message, cut the middle.
  function trimMiddle(text, maxTokens) {
    if (est(text) <= maxTokens) return text;
    const maxChars = Math.max(80, maxTokens * 4);
    const head = Math.floor(maxChars * 0.6);
    const tail = maxChars - head;
    return text.slice(0, head).trimEnd() + '\n[…trimmed…]\n' + text.slice(-tail).trimStart();
  }

  function buildHandoff(chat, opts = {}) {
    const budget = Math.max(500, opts.budget || 3000);
    const recentCount = opts.recentCount || 6;
    const messages = (chat && chat.messages) || [];
    const siteName = opts.siteName || '';

    const header =
      `I'm continuing a conversation that was cut off${siteName ? ` on ${siteName}` : ''} because it hit a usage limit. ` +
      `Below is the context. Read it, then continue from where we left off.\n\n` +
      (chat && chat.title ? `Topic: ${chat.title}\n\n` : '');
    const footer =
      `\n---\nContinue from the last message above. Don't repeat what was already said. ` +
      `If something is missing, ask me.`;

    if (!messages.length) return header + '(No messages were captured.)' + footer;

    const recent = messages.slice(-recentCount);
    const older = messages.slice(0, messages.length - recent.length);

    const fixed = est(header) + est(footer) + 30;
    const recentBudget = Math.floor((budget - fixed) * (older.length ? 0.7 : 1));
    const summaryBudget = budget - fixed - recentBudget;

    // Recent turns: share the budget, newest message gets the biggest slice.
    const perMsg = Math.max(60, Math.floor(recentBudget / recent.length));
    const recentBlocks = recent.map((m, i) => {
      const allowance = i === recent.length - 1 ? perMsg * 1.5 : perMsg;
      return `### ${label(m.role)}\n${trimMiddle(m.text.trim(), Math.floor(allowance))}`;
    });

    // Older turns: one line each; drop from the middle if over budget.
    let lines = older.map((m) => `- ${label(m.role)}: ${firstSentence(m.text)}`);
    let used = lines.reduce((n, l) => n + est(l), 0);
    if (used > summaryBudget && lines.length > 4) {
      const keep = lines.slice();
      let headN = 2;
      let tailN = keep.length - 2;
      // Remove lines from just after the first two until within budget.
      while (used > summaryBudget && tailN > 2) {
        used -= est(keep[headN]);
        keep.splice(headN, 1);
        tailN--;
      }
      const omitted = lines.length - keep.length;
      if (omitted > 0) keep.splice(headN, 0, `- … (${omitted} earlier turns omitted)`);
      lines = keep;
    }

    const parts = [header];
    if (lines.length) parts.push(`## Summary of earlier conversation\n${lines.join('\n')}\n`);
    parts.push(`## Most recent messages\n${recentBlocks.join('\n\n')}`);
    return parts.join('\n') + footer;
  }

  function toMarkdown(chat, siteName) {
    const date = new Date(chat.updatedAt || Date.now()).toLocaleString();
    const head = `# ${chat.title || 'Untitled chat'}\n\n` +
      `- Site: ${siteName || chat.host || chat.site}\n- URL: ${chat.url || ''}\n- Saved: ${date}\n` +
      `- Estimated tokens: ${(chat.totals && chat.totals.total) || 0}\n\n---\n`;
    const body = (chat.messages || [])
      .map((m) => `\n## ${label(m.role)}\n\n${m.text}\n`)
      .join('');
    return head + body;
  }

  TT.buildHandoff = buildHandoff;
  TT.toMarkdown = toMarkdown;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildHandoff, toMarkdown, firstSentence, trimMiddle };
  }
})(globalThis);
