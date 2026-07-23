const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const adapter = read('js/game1-rewards.js');
const css = read('css/game1-autosave.css');
const serviceWorker = read('sw.js');

[
  'function rewardLines(detail)',
  'function renderInWinDialog(detail)',
  "querySelector('#manThang .hop-thang')",
  "querySelector('.nhom-nut')",
  "summary.className = 'bh-game1-reward-summary'",
  "summary.setAttribute('role', 'status')",
  "summary.setAttribute('aria-live', 'polite')",
  'dialog.insertBefore(summary, actions || null)',
  '⭐ Bé nhận ${detail.stars} sao',
  '🌟 Sticker mới: Ngôi sao vui vẻ',
  '🎈 Huy hiệu mới: Lần đầu hoàn thành',
  'newBadge: !badge.duplicate',
  'if (renderInWinDialog(detail)) return;'
].forEach((snippet) => {
  assert.ok(adapter.includes(snippet), `Game 1 reward dialog must include: ${snippet}`);
});

assert.ok(css.includes('.bh-game1-reward-summary'));
assert.ok(css.includes('.bh-game1-reward-stars'));
assert.ok(css.includes('.bh-game1-reward-unlock'));
assert.ok(css.includes('prefers-reduced-motion'));
assert.ok(serviceWorker.includes('./js/game1-rewards.js'));
assert.ok(serviceWorker.includes('./css/game1-autosave.css'));
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

console.log('Game 1 reward win dialog checks passed.');
