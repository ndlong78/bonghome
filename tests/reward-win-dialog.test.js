const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const adapter = read('js/games2-4-rewards.js');
const css = read('css/games-autosave.css');
const serviceWorker = read('sw.js');

[
  'function rewardLines(detail)',
  'function renderInWinDialog(detail)',
  "querySelector('.man-thang .hop-thang')",
  "querySelector('.nhom-nut')",
  "summary.className = 'bh-reward-summary'",
  "summary.setAttribute('role', 'status')",
  "summary.setAttribute('aria-live', 'polite')",
  'dialog.insertBefore(summary, actions || null)',
  "⭐ Bé nhận ${detail.stars} sao",
  "🎁 Sticker mới: ${detail.stickerName}",
  '🔎 Huy hiệu mới: Bé ham khám phá'
].forEach((snippet) => {
  assert.ok(adapter.includes(snippet), `reward dialog adapter must include: ${snippet}`);
});

assert.ok(adapter.includes('if (renderInWinDialog(detail)) return;'));
assert.ok(css.includes('.bh-reward-summary'));
assert.ok(css.includes('.bh-reward-stars'));
assert.ok(css.includes('.bh-reward-unlock'));
assert.ok(css.includes('prefers-reduced-motion'));
assert.ok(serviceWorker.includes('./js/games2-4-rewards.js'));
assert.ok(serviceWorker.includes('./css/games-autosave.css'));
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

console.log('Reward win dialog checks passed.');
