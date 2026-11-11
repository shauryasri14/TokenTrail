<p align="center"><img src="icons/icon128.png" width="96" alt="TokenTrail logo" /></p>

<h1 align="center">TokenTrail</h1>

<p align="center"><b>Know when your AI chat is about to hit its limit, and never lose the conversation.</b><br/>
A cross-browser extension for Chrome, Edge, Brave, Opera, Firefox and Safari.</p>

---

Free tiers of ChatGPT, Claude, Gemini and other AI chats cut you off mid-conversation when you
reach a hidden token or usage limit, and the context you built up is stuck in that thread.
TokenTrail:

- **Counts tokens live** for every chat and shows them in a draggable meter on the page, a
  toolbar badge (`42%`) and a popup with a gauge.
- **Warns you early**: the meter turns amber at 70% of the chat's budget and red at 90%, with a
  one-time "save your context now" prompt. Both thresholds can be changed.
- **Saves every conversation locally** as you chat, so it's still there after you get cut off.
- **Builds a handoff prompt with one click**: a short summary of the earlier conversation plus the
  latest messages, sized to fit a token budget. Paste it into a new chat, or into a different
  AI, and continue where you left off.
- **Includes a dashboard** with token usage for the last 7 days, totals by site, search across all
  saved chats, a full transcript view, and Markdown/JSON export.

Everything runs offline in your browser. No account, no server, no analytics.

## Supported sites

Built in: **ChatGPT, Claude, Gemini, DeepSeek, Perplexity, Microsoft Copilot, Mistral Le Chat,
Grok, Poe, Meta AI, HuggingChat, Qwen, Kimi**.

**Any other AI chat:** click the TokenTrail toolbar icon on that site and choose **Track this
site**. TokenTrail asks for permission for that one site only, then finds the messages with a
generic detector. You can remove sites again in Settings.

## Install (developer mode)

The extension has no build step. Clone the repo and load the folder:

```bash
git clone https://github.com/shauryasri14/TokenTrail.git
```

| Browser | Steps |
|---|---|
| **Chrome / Edge / Brave / Opera** | Open `chrome://extensions` (or `edge://extensions`), turn on **Developer mode**, click **Load unpacked**, select the `TokenTrail` folder. |
| **Firefox** (121+) | Open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, select `manifest.json`. Then open `about:addons`, select TokenTrail → **Permissions**, and allow the AI sites (Firefox makes host permissions opt-in). |
| **Safari** (macOS) | `xcrun safari-web-extension-converter /path/to/TokenTrail`, open the generated Xcode project, run it, then enable the extension in Safari → Settings → Extensions. |

## How the token count works

Free tiers don't tell you how many tokens you've used, so TokenTrail **estimates** them from the
text on the page. It averages two common rules of thumb (about 4 characters per token, and about
0.75 words per token) and counts CJK characters one by one. For normal English text this is
usually within about 10–15% of real BPE tokenizers.

Each site has a default **token budget**: a conservative guess at when the free tier starts
cutting you off. If a site usually stops you at a different point, change its budget in
**Settings** so the meter matches what you see.

## Project layout

```
manifest.json            MV3 manifest (works in Chromium + Firefox)
src/background.js        badge, dashboard, dynamic "Track this site" registration
src/content/             adapters (per-site message extraction), floating meter, content script
src/lib/                 token estimator, storage, handoff builder, site registry, UI helpers
popup/  dashboard/  options/   extension pages
ui/common.css            shared design tokens (light + dark)
scripts/make-icons.js    regenerates icons (no dependencies)
test/                    unit tests (node --test)
```

## Development

```bash
npm test             # unit tests for estimator, handoff, merge logic
npm run lint         # Mozilla's web-ext linter
npm run icons        # regenerate PNG icons
npm run build:firefox  # zip for addons.mozilla.org
```

AI sites change their HTML often. If a built-in site stops counting, update its selectors in
`src/content/adapters.js`. Until then the generic detector keeps counting as a fallback.

## Privacy

Chats and settings are kept in `browser.storage` on your device. Settings sync through your
browser account if browser sync is on. TokenTrail makes no network requests.

## License

MIT
