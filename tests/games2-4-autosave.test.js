const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const routes = require(path.join(root, 'js', 'routes.js'));
const adapter = read('js/games2-4-autosave.js');
const sharedUi = read('shared-ui.js');
const css = read('css/games-autosave.css');
const serviceWorker = read('sw.js');

assert.equal(routes.getGameId('/game2.html'), 2);
assert.equal(routes.getGameId('/game3'), 3);
assert.equal(routes.getGameId('/game4/'), 4);
assert.equal(routes.getGameId('/game5.html'), 5);
assert.ok(adapter.includes("const sharedGameId = routes?.getGameId?.(path);"), 'Adapter must use the shared route API');
assert.ok(adapter.includes("const match = path.match(/\\/(game[234])(?:\\.html)?\\/?$/);"), 'Fallback must support extensionless routes');
assert.ok(adapter.includes('const gameId = resolveGameId(window.location?.pathname, window.BongRoutes);'));
assert.equal(
  adapter.includes("window.location.pathname.match(/\\/(game[234])\\.html$/)"),
  false,
  'Adapter must not keep the old .html-only route check'
);
['game2', 'game3', 'game4'].forEach((gameId) => {
  assert.match(adapter, new RegExp(`${gameId}: \\{\\s+capture:`), `${gameId} must have an adapter`);
});

assert.match(adapter, /progress\.saveGame\(gameId/);
assert.match(adapter, /progress\.loadGame\(gameId\)/);
assert.match(adapter, /progress\.completeGame\(gameId/);
assert.match(adapter, /transactionId: `\$\{gameId\}-finish-\$\{sessionId\}`/);
assert.match(adapter, /durationSeconds: adapter\.seconds\(\)/);
assert.match(adapter, /MutationObserver/);
assert.match(adapter, /pagehide/);
assert.match(adapter, /visibilitychange/);

// Game 2 đã tách engine (tests/game2-engine.test.js kiểm tra hành vi): adapter chỉ gọi API window.BongGame2.
const game2 = read('game2.html');
assert.doesNotMatch(game2, /<script>/, 'game2.html không còn script inline');
assert.ok(game2.indexOf('./js/game2-engine.js') > 0 && game2.indexOf('./js/game2-engine.js') < game2.indexOf('./js/game2-ui.js'));
['serialize(sessionId)', 'restore(state)', 'moves()', 'seconds()', 'canSave()'].forEach((call) => {
  assert.ok(adapter.includes(`window.BongGame2.${call}`), `Game 2 adapter phải gọi BongGame2.${call}`);
});
// Cả ba game 2–4 đã tách engine: adapter không còn đọc biến toàn cục nào của trang game.
['dsKhacBiet', 'daTimThay', 'soChamSai', 'luotGoiY', 'VAT_THE', 'giay', 'daBatDau', 'dongHoChay', 'oDongHo', 'dinhDangGio', 'startClock'].forEach((name) => {
  assert.doesNotMatch(adapter, new RegExp(`\\b${name}\\b`), `adapter không được dùng biến toàn cục ${name}`);
});
['./js/game2-engine.js', './js/game2-ui.js'].forEach((file) => assert.ok(serviceWorker.includes(`"${file}"`), `${file} phải có offline`));
// Game 3 đã tách engine (tests/game3-engine.test.js kiểm tra hành vi lưu/khôi phục):
// trang không còn script inline, nạp engine trước UI, adapter chỉ gọi API window.BongGame3.
const game3 = read('game3.html');
assert.doesNotMatch(game3, /<script>/, 'game3.html không còn script inline');
assert.ok(game3.indexOf('./js/game3-engine.js') > 0 && game3.indexOf('./js/game3-engine.js') < game3.indexOf('./js/game3-ui.js'));
['serialize(sessionId)', 'restore(state)', 'moves()', 'seconds()', 'canSave()'].forEach((call) => {
  assert.ok(adapter.includes(`window.BongGame3.${call}`), `Game 3 adapter phải gọi BongGame3.${call}`);
});
['KHO_HINH', 'hangBong', 'khay', 'daGhep', 'veMau', 'veBong', 'SO_HINH'].forEach((name) => {
  assert.doesNotMatch(adapter, new RegExp(`\\b${name}\\b`), `adapter không được dùng biến toàn cục ${name} của Game 3`);
});
assert.ok(adapter.includes("const winDialog = document.getElementById('manThang');"), 'adapter lấy hộp thoại thắng theo id');
['./js/game3-engine.js', './js/game3-ui.js'].forEach((file) => assert.ok(serviceWorker.includes(`"${file}"`), `${file} phải có offline`));
// Game 4 đã tách engine (tests/game4-engine.test.js kiểm tra hành vi; e2e/game4-autosave-restore.spec.js
// kiểm tra bản lưu rất cũ chỉ có HTML): adapter chỉ gọi API window.BongGame4.
const game4 = read('game4.html');
assert.doesNotMatch(game4, /<script>/, 'game4.html không còn script inline');
assert.ok(game4.indexOf('./js/game4-engine.js') > 0 && game4.indexOf('./js/game4-engine.js') < game4.indexOf('./js/game4-ui.js'));
['serialize(sessionId)', 'restore(state)', 'moves()', 'seconds()', 'canSave()'].forEach((call) => {
  assert.ok(adapter.includes(`window.BongGame4.${call}`), `Game 4 adapter phải gọi BongGame4.${call}`);
});
['KIEU_DO', 'MAU', 'sanDo', 'hangGio', 'demTheoGio', 'daGom', 'TONG_DO', 'veGio', 'innerHTML'].forEach((name) => {
  assert.doesNotMatch(adapter, new RegExp(`\\b${name}\\b`), `adapter không được dùng ${name} của Game 4`);
});
['./js/game4-engine.js', './js/game4-ui.js'].forEach((file) => assert.ok(serviceWorker.includes(`"${file}"`), `${file} phải có offline`));

assert.match(sharedUi, /isGames2To4/);
assert.match(sharedUi, /\.\/js\/games2-4-autosave\.js/);
assert.match(sharedUi, /\.\/css\/games-autosave\.css/);
assert.match(sharedUi, /loadGames2To4Autosave\(\)/);
assert.match(sharedUi, /BongRoutesReady\.then/);

assert.match(css, /bh-game-autosave-status/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /safe-area-inset/);

['./js/routes.js', './js/games2-4-autosave.js', './css/games-autosave.css'].forEach((asset) => {
  assert.ok(serviceWorker.includes(asset), `${asset} must be cached offline`);
});
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

console.log('Game 2-4 autosave checks passed.');
