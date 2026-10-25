const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const adapter = read('js/games5-7-autosave.js');
const sharedUi = read('shared-ui.js');
const serviceWorker = read('sw.js');
const game5 = read('game5.html');
const game6 = read('game6.html');
const game7 = read('game7.html');

assert.ok(adapter.includes('const sharedGameId = routes?.getGameId?.(path);'), 'Adapter must use the shared route API');
assert.ok(
  adapter.includes("const match = path.match(/\\/(game[567])(?:\\.html)?\\/?$/);"),
  'Fallback must support extensionless routes'
);
assert.ok(adapter.includes('const gameId = resolveGameId(window.location?.pathname, window.BongRoutes);'));
assert.equal(
  adapter.includes('match(/\\/(game[567])\\.html$/)'),
  false,
  'Adapter must not keep the old .html-only route check'
);
['game5', 'game6', 'game7'].forEach((gameId) => {
  assert.match(adapter, new RegExp(`${gameId}: \\{`), `${gameId} must have an adapter`);
});

assert.match(adapter, /progress\.saveGame\(gameId/);
assert.match(adapter, /progress\.loadGame\(gameId\)/);
assert.match(adapter, /progress\.completeGame\(gameId/);
assert.match(adapter, /transactionId: `\$\{gameId\}-finish-\$\{sessionId\}`/);
assert.match(adapter, /durationSeconds: adapter\.seconds\(\)/);
assert.match(adapter, /MutationObserver/);
assert.match(adapter, /pagehide/);
assert.match(adapter, /visibilitychange/);
assert.match(adapter, /SAVE_INTERVAL_MS = 2000/);


assert.match(sharedUi, /isGames5To7/);
assert.match(sharedUi, /\.\/js\/games5-7-autosave\.js/);
assert.match(sharedUi, /loadGames5To7Autosave\(\)/);
assert.match(sharedUi, /isGames2To4\(\) \|\| isGames5To7\(\)/);

// Cả ba game đã tách engine: adapter chỉ gọi window.BongGameN, không còn đọc biến toàn cục của game.
['viTri', 'soSai', 'giay', 'daBatDau', 'dongHoChay', 'hinhHienTai', 'KHO_HINH'].forEach((name) => {
  assert.doesNotMatch(adapter, new RegExp(`\\b${name}\\b`), `adapter không được dùng biến toàn cục ${name}`);
});
// Game 5: không còn script inline, nạp engine trước UI, lưu/khôi phục qua window.BongGame5.
assert.doesNotMatch(game5, /<script>/, 'game5.html không còn script inline');
assert.ok(game5.indexOf('./js/game5-engine.js') > 0 && game5.indexOf('./js/game5-engine.js') < game5.indexOf('./js/game5-ui.js'));
assert.match(adapter, /window\.BongGame5\.serialize\(sessionId\)/);
assert.match(adapter, /window\.BongGame5\.restore\(state\)/);
assert.ok(serviceWorker.includes('./js/game5-engine.js') && serviceWorker.includes('./js/game5-ui.js'), 'Game 5 phải có offline');
// Game 6 đã tách engine: không còn script inline, adapter lưu ván qua window.BongGame6.
assert.doesNotMatch(game6, /<script>/, 'game6.html không còn script inline');
assert.ok(game6.indexOf('./js/game6-engine.js') > 0 && game6.indexOf('./js/game6-engine.js') < game6.indexOf('./js/game6-ui.js'));
assert.match(adapter, /window\.BongGame6\.serialize\(sessionId\)/);
assert.match(adapter, /window\.BongGame6\.restore\(state\)/);
assert.ok(serviceWorker.includes('./js/game6-engine.js') && serviceWorker.includes('./js/game6-ui.js'), 'Game 6 phải có offline');
// Game 7 cũng đã tách engine.
assert.doesNotMatch(game7, /<script>/, 'game7.html không còn script inline');
assert.ok(game7.indexOf('./js/game7-engine.js') > 0 && game7.indexOf('./js/game7-engine.js') < game7.indexOf('./js/game7-ui.js'));
assert.match(adapter, /window\.BongGame7\.serialize\(sessionId\)/);
assert.match(adapter, /window\.BongGame7\.restore\(state\)/);
assert.ok(serviceWorker.includes('./js/game7-engine.js') && serviceWorker.includes('./js/game7-ui.js'), 'Game 7 phải có offline');

assert.ok(serviceWorker.includes('./js/games5-7-autosave.js'), 'adapter must be cached offline');
assert.ok(serviceWorker.includes('./css/games-autosave.css'), 'shared autosave CSS must stay cached');
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

console.log('Game 5-7 autosave checks passed.');
