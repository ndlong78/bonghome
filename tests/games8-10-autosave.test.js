const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const adapter = read('js/games8-10-autosave.js');
const sharedUi = read('shared-ui.js');
const serviceWorker = read('sw.js');
const game8 = read('game8.html');
const game9 = read('game9.html');
const game10 = read('game10.html');

assert.ok(adapter.includes('const sharedGameId = routes?.getGameId?.(path);'), 'Adapter must use the shared route API');
assert.ok(
  adapter.includes("const match = path.match(/\\/(game(?:8|9|10))(?:\\.html)?\\/?$/);"),
  'Fallback must support extensionless routes'
);
assert.ok(adapter.includes('const gameId = resolveGameId(window.location?.pathname, window.BongRoutes);'));
assert.equal(
  adapter.includes('match(/\\/(game(?:8|9|10))\\.html$/)'),
  false,
  'Adapter must not keep the old .html-only route check'
);
['game8', 'game9', 'game10'].forEach((gameId) => {
  assert.match(adapter, new RegExp(`${gameId}: \\{`), `${gameId} must have an adapter`);
});

assert.match(adapter, /progress\.saveGame\(gameId/);
assert.match(adapter, /progress\.loadGame\(gameId\)/);
assert.match(adapter, /progress\.completeGame\(gameId/);
assert.match(adapter, /transactionId: `\$\{gameId\}-finish-\$\{sessionId\}`/);
assert.match(adapter, /MutationObserver/);
assert.match(adapter, /SAVE_INTERVAL_MS = 2000/);
assert.match(adapter, /pagehide/);
assert.match(adapter, /visibilitychange/);


assert.match(sharedUi, /isGames8To10/);
assert.match(sharedUi, /\.\/js\/games8-10-autosave\.js/);
assert.match(sharedUi, /loadGames8To10Autosave\(\)/);
assert.match(sharedUi, /isGames2To4\(\) \|\| isGames5To7\(\) \|\| isGames8To10\(\)/);

// Game 8 đã tách engine (tests/game8-engine.test.js kiểm tra hành vi lưu/khôi phục):
// trang không còn script inline, nạp engine trước UI, adapter chỉ gọi API window.BongGame8.
assert.equal(/<script>(?!\s*<\/script>)/.test(game8), false, 'game8.html must not keep an inline script');
const scriptOrder = [...game8.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(scriptOrder, ['./shared-ui.js', './js/game8-engine.js', './js/game8-ui.js']);
assert.ok(adapter.includes('return window.BongGame8.serialize(sessionId);'), 'Game 8 saving must go through the engine');
assert.ok(adapter.includes('window.BongGame8.restore(state)'), 'Game 8 restore must go through the engine');
['difficulty', 'seconds', 'moves', 'canSave'].forEach((name) => {
  assert.ok(adapter.includes(`window.BongGame8.${name}()`), `Game 8 adapter must delegate ${name}`);
});
assert.ok(adapter.includes("const winDialog = document.getElementById('manThang');"), 'adapter must find the win dialog by id');
['./js/game8-engine.js', './js/game8-ui.js'].forEach((file) => {
  assert.ok(serviceWorker.includes(`"${file}"`), `${file} must be precached`);
});
// Cả ba game 8–10 đã tách engine (tests/game9-engine.test.js kiểm tra hành vi của Game 9):
// adapter chỉ gọi API window.BongGameN, định dạng bản lưu (schemaVersion…) nằm trong từng engine.
assert.equal(/<script>(?!\s*<\/script>)/.test(game9), false, 'game9.html must not keep an inline script');
assert.deepEqual([...game9.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]), ['./shared-ui.js', './js/game9-engine.js', './js/game9-ui.js']);
['serialize(sessionId)', 'restore(state)', 'seconds()', 'moves()', 'canSave()'].forEach((call) => {
  assert.ok(adapter.includes(`window.BongGame9.${call}`), `Game 9 adapter must call BongGame9.${call}`);
});
['CAC_CHUYEN', 'chuyen', 'TOC_DO', 'dangChay', 'daBat', 'hienTu', 'docTo'].forEach((name) => {
  assert.doesNotMatch(adapter, new RegExp(`\\b${name}\\b`), `adapter must not use Game 9 global ${name}`);
});
['./js/game9-engine.js', './js/game9-ui.js'].forEach((file) => assert.ok(serviceWorker.includes(`"${file}"`), `${file} must be precached`));
// Game 10 đã tách engine (tests/game10-engine.test.js kiểm tra hành vi chấm điểm và lưu/khôi phục).
assert.equal(/<script>(?!\s*<\/script>)/.test(game10), false, 'game10.html must not keep an inline script');
assert.deepEqual([...game10.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]), ['./shared-ui.js', './js/game10-engine.js', './js/game10-ui.js']);
['serialize(sessionId)', 'restore(state)', 'seconds()', 'moves()', 'canSave()'].forEach((call) => {
  assert.ok(adapter.includes(`window.BongGame10.${call}`), `Game 10 adapter must call BongGame10.${call}`);
});
['dsSao', 'TONG_SAO', 'batDauLuc', 'nhipCuoiKeu', 'chuoiDaiNhat', 'vongLap'].forEach((name) => {
  assert.doesNotMatch(adapter, new RegExp(`\\b${name}\\b`), `adapter must not use Game 10 global ${name}`);
});
['./js/game10-engine.js', './js/game10-ui.js'].forEach((file) => assert.ok(serviceWorker.includes(`"${file}"`), `${file} must be precached`));

assert.ok(serviceWorker.includes('./js/games8-10-autosave.js'), 'adapter must be cached offline');
assert.ok(serviceWorker.includes('./css/games-autosave.css'), 'shared autosave CSS must stay cached');
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

console.log('Game 8-10 autosave checks passed.');
