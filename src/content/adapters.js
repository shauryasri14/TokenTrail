// Per-site message extractors. Each adapter returns [{ role: 'user'|'assistant'|'unknown', text }]
// in on-screen order. Site markup changes often, so every site falls back to the generic
// heuristic adapter when its own selectors stop matching.
(function (root) {
  const TT = (root.TT = root.TT || {});

  function cleanText(el) {
    const t = (el.innerText || el.textContent || '').replace(/ /g, ' ');
    return t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // Drop elements nested inside another matched element (keeps the outermost per message).
  function outermost(els) {
    const set = new Set(els);
    return els.filter((el) => {
      for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return false;
      return true;
    });
  }

  // rules: [[selector, role | (el) => role], ...]
  function bySelectors(rules) {
    return () => {
      const selector = rules.map((r) => r[0]).join(',');
      const els = outermost(Array.from(document.querySelectorAll(selector)));
      return els
        .map((el) => {
          const rule = rules.find((r) => el.matches(r[0]));
          const role = typeof rule[1] === 'function' ? rule[1](el) : rule[1];
          return { role, text: cleanText(el) };
        })
        .filter((m) => m.text);
    };
  }

  const USER_HINT = /(^|[-_\s])(user|human|me|mine|self|query|question|prompt|request|sent|outgoing)([-_\s]|$)/i;
  const BOT_HINT = /(^|[-_\s])(assistant|bot|ai|model|response|answer|reply|received|incoming|gpt|llm|markdown)([-_\s]|$)/i;

  function roleHint(el) {
    for (let n = el, depth = 0; n && depth < 3; n = n.parentElement, depth++) {
      const attrs = [
        n.getAttribute('data-role'), n.getAttribute('data-author'), n.getAttribute('data-message-author-role'),
        n.getAttribute('data-testid'), n.getAttribute('aria-label'), typeof n.className === 'string' ? n.className : '',
      ].filter(Boolean).join(' ');
      if (USER_HINT.test(attrs)) return 'user';
      if (BOT_HINT.test(attrs)) return 'assistant';
    }
    return null;
  }

  // Heuristic adapter for any chat UI: look for message-like elements, discard containers that
  // hold several of them, guess roles from attributes/classes, alternate when unknown.
  function generic() {
    const CANDIDATES = [
      '[data-message-author-role]', '[data-role]', '[data-author]', '[data-message-id]',
      '[data-testid*="message" i]', '[class*="message" i]', '[class*="chat-turn" i]',
      '[class*="bubble" i]', '[role="article"]', 'article',
    ].join(',');
    let els = Array.from(document.querySelectorAll(CANDIDATES)).filter((el) => {
      if (el.closest('nav, aside, header, footer, form, [role="navigation"], #tokentrail-root')) return false;
      const len = (el.innerText || '').trim().length;
      return len > 0;
    });
    const set = new Set(els);
    // A container that holds ≥2 candidates is a list, not a message.
    els = els.filter((el) => {
      let inner = 0;
      for (const other of set) if (other !== el && el.contains(other) && ++inner >= 2) return false;
      return true;
    });
    els = outermost(els);

    if (!els.length) {
      const main = document.querySelector('main, [role="main"]');
      const text = main ? cleanText(main) : '';
      return text ? [{ role: 'unknown', text }] : [];
    }

    let last = 'assistant';
    return els
      .map((el) => {
        const role = roleHint(el) || (last === 'user' ? 'assistant' : 'user');
        last = role;
        return { role, text: cleanText(el) };
      })
      .filter((m) => m.text);
  }

  const ADAPTERS = {
    chatgpt: bySelectors([
      ['[data-message-author-role="user"]', 'user'],
      ['[data-message-author-role="assistant"]', 'assistant'],
    ]),
    claude: bySelectors([
      ['[data-testid="user-message"]', 'user'],
      ['.font-claude-response', 'assistant'],
      ['.font-claude-message', 'assistant'],
    ]),
    gemini: bySelectors([
      ['user-query', 'user'],
      ['model-response', 'assistant'],
    ]),
    deepseek: bySelectors([
      ['.ds-message', (el) => (el.querySelector('.ds-markdown') ? 'assistant' : 'user')],
    ]),
    perplexity: bySelectors([
      ['[class*="group/query"]', 'user'],
      ['h1[class*="query"]', 'user'],
      ['[id^="markdown-content"]', 'assistant'],
    ]),
    copilot: bySelectors([
      ['[data-content="user-message"]', 'user'],
      ['[data-content="ai-message"]', 'assistant'],
    ]),
    grok: bySelectors([
      ['.message-bubble', (el) => (el.closest('[class*="items-end"]') ? 'user' : 'assistant')],
    ]),
    poe: bySelectors([
      ['[class*="Message_humanMessageBubble"]', 'user'],
      ['[class*="Message_botMessageBubble"]', 'assistant'],
    ]),
  };

  function extractMessages(siteId) {
    const own = ADAPTERS[siteId];
    let msgs = [];
    if (own) {
      try { msgs = own(); } catch (_) { msgs = []; }
    }
    if (!msgs.length) msgs = generic();
    return msgs;
  }

  function chatTitle(messages) {
    let t = (document.title || '').replace(/\s*[-|–—]\s*(ChatGPT|Claude|Gemini|DeepSeek|Perplexity|Copilot|Le Chat|Grok|Poe|Meta AI|HuggingChat|Qwen|Kimi).*$/i, '').trim();
    const genericTitle = /^(chatgpt|claude|gemini|google gemini|deepseek|perplexity|copilot|microsoft copilot.*|le chat.*|grok|poe|meta ai|huggingchat|qwen.*|kimi.*|new chat)?$/i;
    if (genericTitle.test(t)) {
      const firstUser = messages.find((m) => m.role === 'user') || messages[0];
      t = firstUser ? firstUser.text.replace(/\s+/g, ' ').slice(0, 70) : '';
    }
    return t || 'Untitled chat';
  }

  TT.extractMessages = extractMessages;
  TT.chatTitle = chatTitle;
})(globalThis);
