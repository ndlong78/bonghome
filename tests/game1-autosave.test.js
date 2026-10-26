const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const autosave = require(path.join(root, 'game1-autosave.js'));
const routes = require(path.join(root, 'js', 'routes.js'));
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

const validSnapshot = {
  version: 1,
  difficulty: 3,
  deck: [0, 1, 2, 0, 1, 2],
  matchedIndices: [0, 3],
  openIndices: [1],
  moves: 2,
  seconds: 15,
  started: true,
  locked: false
};

const mediumSnapshot = {
  version: 1,
  difficulty: 6,
  deck: [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5],
  matchedIndices: [],
  openIndices: [2],
  moves: 0,
  seconds: 4,
  started: true,
  locked: false
};

assert.deepEqual(autosave.validateSnapshot(validSnapshot), validSnapshot);
assert.equal(autosave.validateSnapshot({ ...validSnapshot, deck: [0, 0, 1] }), null);
assert.equal(autosave.validateSnapshot({ ...validSnapshot, matchedIndices: [0] }), null);
assert.equal(autosave.validateSnapshot({ ...validSnapshot, openIndices: [0] }), null);
assert.equal(autosave.validateSnapshot({ ...validSnapshot, difficulty: 5 }), null);
assert.equal(autosave.makeTransactionId('2026-07-22T00:00:00.000Z', 3), 'game1:3:2026-07-22T00:00:00.000Z');
assert.equal(autosave.makeTransactionId(null, 6), 'game1:6:unknown');

assert.equal(autosave.matchesGameRoute('/game1.html', routes), true);
assert.equal(autosave.matchesGameRoute('/game1', routes), true);
assert.equal(autosave.matchesGameRoute('/game1/', routes), true);
assert.equal(autosave.matchesGameRoute('/game2.html', routes), false);
assert.equal(autosave.matchesGameRoute('/game1', null), true, 'fallback phải hỗ trợ URL không đuôi');
assert.equal(autosave.matchesGameRoute('/game1/', null), true, 'fallback phải hỗ trợ dấu / cuối');

const bundle = autosave.validateBundle({
  bundleVersion: 1,
  activeDifficulty: 6,
  snapshots: {
    3: { snapshot: validSnapshot, startedAt: '2026-07-22T00:00:00.000Z' },
    6: { snapshot: mediumSnapshot, startedAt: '2026-07-22T00:01:00.000Z' }
  }
});
assert.equal(bundle.activeDifficulty, 6);
assert.deepEqual(bundle.snapshots['3'].snapshot, validSnapshot);
assert.deepEqual(bundle.snapshots['6'].snapshot, mediumSnapshot);
assert.equal(Object.keys(bundle.snapshots).length, 2, '6 → 12 lá không được ghi đè snapshot 6 lá');

const migratedLegacy = autosave.validateBundle(validSnapshot, '2026-07-22T00:00:00.000Z');
assert.equal(migratedLegacy.activeDifficulty, 3);
assert.deepEqual(migratedLegacy.snapshots['3'].snapshot, validSnapshot);
assert.equal(migratedLegacy.snapshots['3'].startedAt, '2026-07-22T00:00:00.000Z');

// Luật kiểm tra snapshot nằm ở engine: adapter nhận thêm điều kiện quan hệ giữa các trường.
assert.equal(autosave.validateSnapshot({ ...validSnapshot, matchedIndices: [0, 1] }), null, 'cặp đã ghép phải cùng hình');
assert.deepEqual(autosave.validateSnapshot({ ...validSnapshot, difficulty: '3' }), validSnapshot);

// Hợp đồng sau khi tách engine/UI: trang không còn script inline, nạp engine → UI theo thứ tự,
// adapter chạy thật (lưu, khôi phục qua hộp "Tiếp tục", ghi hoàn thành) trong e2e/game1-gameplay.spec.js.
const game1Html = fs.readFileSync(path.join(root, 'game1.html'), 'utf8');
assert.doesNotMatch(game1Html, /<script>(?!\s*<\/script>)/, 'game1.html không còn script inline');
const scriptOrder = ['./shared-ui.js', './js/game1-engine.js', './js/game1-ui.js'].map((src) => game1Html.indexOf(`<script src="${src}" defer></script>`));
assert.ok(scriptOrder.every((index, i) => index > 0 && (i === 0 || index > scriptOrder[i - 1])), 'thứ tự script Game 1');
for (const file of ['./js/game1-engine.js', './js/game1-ui.js']) assert.ok(serviceWorker.includes(file), `precache ${file}`);
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);
assert.ok(serviceWorker.includes('./game1-autosave.js'));
assert.ok(serviceWorker.includes('./css/game1-autosave.css'));
// Nút "Tiếp tục"/"Chơi lại" đủ cao và đủ tương phản: e2e/game1-resume-contrast.spec.js.

console.log('Game 1 autosave checks passed.');
