const test = require('node:test');
const assert = require('node:assert/strict');

const { estimateTokens, formatTokens } = require('../src/lib/tokenizer.js');
const { buildHandoff, toMarkdown, trimMiddle, firstSentence } = require('../src/lib/handoff.js');
const { mergeMessages } = require('../src/lib/storage.js');
const { siteForHost } = require('../src/lib/sites.js');

test('estimateTokens is roughly 4 chars per token for English', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('   '), 0);
  const text = 'The quick brown fox jumps over the lazy dog. '.repeat(20); // ~200 real tokens
  const n = estimateTokens(text);
  assert.ok(n > 160 && n < 260, `got ${n}`);
});

test('estimateTokens counts CJK characters individually', () => {
  const n = estimateTokens('你好世界，今天天气很好');
  assert.ok(n >= 10, `got ${n}`);
});

test('formatTokens', () => {
  assert.equal(formatTokens(950), '950');
  assert.equal(formatTokens(1000), '1k');
  assert.equal(formatTokens(1250), '1.3k');
  assert.equal(formatTokens(32000), '32k');
  assert.equal(formatTokens(1500000), '1.5M');
});

test('siteForHost maps known hosts', () => {
  assert.equal(siteForHost('chatgpt.com').id, 'chatgpt');
  assert.equal(siteForHost('claude.ai').id, 'claude');
  assert.equal(siteForHost('example.com'), null);
});

test('mergeMessages keeps older turns when a virtualised page shows only the tail', () => {
  const m = (role, text) => ({ role, text });
  const stored = [m('user', 'a'), m('assistant', 'b'), m('user', 'c'), m('assistant', 'd')];
  assert.deepEqual(mergeMessages(stored, [m('user', 'c'), m('assistant', 'd2')]).map((x) => x.text), ['a', 'b', 'c', 'd2']);
  // Edited from the first message: shorter but starts at index 0 -> replaced.
  assert.deepEqual(mergeMessages(stored, [m('user', 'a')]).map((x) => x.text), ['a']);
  // Longer scrape always wins.
  assert.equal(mergeMessages(stored, [...stored, m('user', 'e')]).length, 5);
});

test('buildHandoff fits the budget and keeps the latest message', () => {
  const messages = [];
  for (let i = 0; i < 40; i++) {
    messages.push({ role: i % 2 ? 'assistant' : 'user', text: `Turn ${i}. ` + 'lorem ipsum dolor sit amet '.repeat(80) });
  }
  messages.push({ role: 'user', text: 'FINAL QUESTION: how do I deploy this?' });
  const out = buildHandoff({ title: 'Deploy help', messages }, { budget: 3000, siteName: 'ChatGPT' });
  assert.ok(out.includes('FINAL QUESTION'));
  assert.ok(out.includes('on ChatGPT'));
  assert.ok(out.includes('earlier turns omitted'));
  assert.ok(estimateTokens(out) < 3600, `handoff too big: ${estimateTokens(out)}`);
});

test('buildHandoff handles empty chats', () => {
  assert.ok(buildHandoff({ messages: [] }).includes('No messages'));
});

test('trimMiddle and firstSentence', () => {
  const long = 'start ' + 'x'.repeat(5000) + ' end';
  const t = trimMiddle(long, 100);
  assert.ok(t.startsWith('start') && t.endsWith('end') && t.includes('trimmed'));
  assert.equal(firstSentence('This is the first sentence. And second.'), 'This is the first sentence.');
});

test('toMarkdown includes every message', () => {
  const md = toMarkdown({ title: 'T', messages: [{ role: 'user', text: 'hi' }, { role: 'assistant', text: 'hello' }], totals: { total: 3 } }, 'Claude');
  assert.ok(md.startsWith('# T'));
  assert.ok(md.includes('## Me\n\nhi') && md.includes('## AI\n\nhello'));
});
