const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const css = read('css/game1-autosave.css');
const serviceWorker = read('sw.js');

// Hành vi hiển thị phần thưởng: tests/reward-announcements.test.js. Ở đây chỉ còn hợp đồng CSS.

assert.ok(css.includes('.bh-game1-reward-summary'));
assert.ok(css.includes('.bh-game1-reward-stars'));
assert.ok(css.includes('.bh-game1-reward-unlock'));
assert.ok(css.includes('prefers-reduced-motion'));
assert.ok(serviceWorker.includes('./js/game1-rewards.js'));
assert.ok(serviceWorker.includes('./css/game1-autosave.css'));
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

console.log('Game 1 reward win dialog checks passed.');
