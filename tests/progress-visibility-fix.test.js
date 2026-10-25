const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const adapter = read('js/games5-7-autosave.js');
const dashboard = read('js/parent-dashboard.js');
const serviceWorker = read('sw.js');

// Game 7 trước đây đọc ngược hình từ DOM để lưu ván (và từng so chuỗi HTML). Nay trạng thái nằm
// trong js/game7-engine.js: kiểm tra lưu rồi khôi phục giữ đúng từng hình của ván đang chơi.
{
  const game7 = require('../js/game7-engine.js');
  let seed = 37;
  const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  let state = game7.createGame(next);
  state = game7.nextQuestion(game7.choose(state, state.choices.findIndex((c) => game7.sameCombo(c, state.answer))).state, next);
  const saved = JSON.parse(JSON.stringify(game7.serialize(state, 'game7-visibility')));
  assert.deepEqual(game7.serialize(game7.restore(saved), 'game7-visibility'), saved, 'Game 7 save/restore must keep every shape');
  assert.ok(adapter.includes('window.BongGame7.serialize(sessionId)'), 'Game 7 adapter must delegate saving to the engine');
}
assert.ok(!adapter.includes('function comboFromHtml'), 'Game 7 must not compare rendered HTML strings');

[
  'function renderGameSummary(container, byGame, games, catalog, rewardsByGame)',
  'Object.keys(inProgress)',
  'Đang chơi dở',
  'progress.byGame, progress.games, catalog, rewardsByGame',
  'Chưa có hoạt động nào được lưu'
].forEach((snippet) => {
  assert.ok(dashboard.includes(snippet), `Parent dashboard must include: ${snippet}`);
});

assert.match(
  serviceWorker,
  /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/,
  'Service Worker must use the standard version format'
);
assert.ok(serviceWorker.includes('./js/games5-7-autosave.js'), 'Game 7 restore adapter must remain cached offline');
assert.ok(serviceWorker.includes('./js/parent-dashboard.js'), 'Parent progress dashboard must remain cached offline');

console.log('Progress visibility regression checks passed.');
