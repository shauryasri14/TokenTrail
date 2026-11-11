// Registry of AI chat sites TokenTrail knows about.
// `limit` is the default per-chat token budget: free tiers don't publish exact numbers, so
// these are conservative, user-editable estimates (Options page).
(function (root) {
  const TT = (root.TT = root.TT || {});

  const SITES = [
    { id: 'chatgpt',    name: 'ChatGPT',     hosts: ['chatgpt.com', 'chat.openai.com'],      limit: 32000,  color: '#10a37f' },
    { id: 'claude',     name: 'Claude',      hosts: ['claude.ai'],                           limit: 60000,  color: '#d97757' },
    { id: 'gemini',     name: 'Gemini',      hosts: ['gemini.google.com'],                   limit: 32000,  color: '#4f8df5' },
    { id: 'deepseek',   name: 'DeepSeek',    hosts: ['chat.deepseek.com'],                   limit: 64000,  color: '#4d6bfe' },
    { id: 'perplexity', name: 'Perplexity',  hosts: ['www.perplexity.ai', 'perplexity.ai'],  limit: 32000,  color: '#20b8cd' },
    { id: 'copilot',    name: 'Copilot',     hosts: ['copilot.microsoft.com'],               limit: 16000,  color: '#c04dd8' },
    { id: 'mistral',    name: 'Le Chat',     hosts: ['chat.mistral.ai'],                     limit: 32000,  color: '#ff7000' },
    { id: 'grok',       name: 'Grok',        hosts: ['grok.com'],                            limit: 32000,  color: '#a1a1aa' },
    { id: 'poe',        name: 'Poe',         hosts: ['poe.com'],                             limit: 16000,  color: '#8b5cf6' },
    { id: 'meta',       name: 'Meta AI',     hosts: ['www.meta.ai'],                         limit: 16000,  color: '#0866ff' },
    { id: 'huggingchat',name: 'HuggingChat', hosts: ['huggingface.co'],                      limit: 8000,   color: '#ffb000' },
    { id: 'qwen',       name: 'Qwen',        hosts: ['chat.qwen.ai'],                        limit: 32000,  color: '#615ced' },
    { id: 'kimi',       name: 'Kimi',        hosts: ['www.kimi.com'],                        limit: 32000,  color: '#38bdf8' },
  ];

  const GENERIC = { id: 'generic', name: 'Other site', hosts: [], limit: 32000, color: '#94a3b8' };

  function siteForHost(hostname) {
    const h = String(hostname || '').toLowerCase();
    return SITES.find((s) => s.hosts.includes(h)) || null;
  }

  function siteById(id) {
    return SITES.find((s) => s.id === id) || (id === 'generic' ? GENERIC : null);
  }

  // Display info for a stored chat (generic chats keep their hostname as the name).
  function siteInfo(chat) {
    const s = siteById(chat && chat.site);
    if (s && s.id !== 'generic') return s;
    return { ...GENERIC, name: (chat && chat.host) || GENERIC.name };
  }

  TT.SITES = SITES;
  TT.GENERIC_SITE = GENERIC;
  TT.siteForHost = siteForHost;
  TT.siteById = siteById;
  TT.siteInfo = siteInfo;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SITES, GENERIC, siteForHost, siteById, siteInfo };
  }
})(globalThis);
