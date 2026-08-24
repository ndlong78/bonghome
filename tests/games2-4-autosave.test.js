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
// Khung autosave dùng chung cho Game 2-10; phần riêng từng game ở file nhóm.
const core = read('js/autosave-core.js');

assert.equal(routes.getGameId('/game2.html'), 2);
assert.equal(routes.getGameId('/game3'), 3);
assert.equal(routes.getGameId('/game4/'), 4);
assert.equal(routes.getGameId('/game5.html'), 5);
['game2', 'game3', 'game4'].forEach((gameId) => {
  assert.match(adapter, new RegExp(`${gameId}: \\{`), `${gameId} must have an adapter`);
});

assert.match(adapter, /differences: dsKhacBiet/);
assert.match(adapter, /found: \[\.\.\.daTimThay\]/);
assert.match(adapter, /colorOrder:/);
assert.match(adapter, /shadowOrder:/);
assert.match(adapter, /matched:/);
assert.match(adapter, /objects:/);
assert.match(adapter, /basketCounts:/);

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

// Hợp đồng khung chung: nhận dạng trang, vòng lưu, và ghi lượt hoàn thành.
assert.match(core, /function resolveGameId\(pathname, routes, minGameId, maxGameId\)/);
assert.match(core, /const SAVE_INTERVAL_MS = 2000;/);
assert.match(core, /progress\.saveGame\(gameId/);
assert.match(core, /progress\.loadGame\(gameId\)/);
assert.match(core, /progress\.completeGame\(gameId/);
assert.match(core, /transactionId: `\$\{gameId\}-finish-\$\{sessionId\}`/);
assert.match(core, /durationSeconds: adapter\.duration\(\)/);
assert.match(core, /new root\.MutationObserver/);
assert.match(core, /pagehide/);
assert.match(core, /visibilitychange/);

// File nhóm chỉ còn khai báo phần riêng và nối vào khung chung.
assert.match(adapter, /core\?\.resolveGameId\(window\.location\?\.pathname, window\.BongRoutes, 2, 4\)/);
assert.match(adapter, /globalName: 'BongGamesAutosave'/);
assert.match(adapter, /source: 'games2-4-autosave'/);
assert.equal(
  /window\.location\.pathname\.match/.test(adapter),
  false,
  'file nhóm không được tự nhận dạng đường dẫn nữa'
);
assert.match(adapter, /game2: \{[\s\S]*?capture: captureGame2,/);
assert.match(adapter, /game3: \{[\s\S]*?capture: captureGame3,/);
assert.match(adapter, /game4: \{[\s\S]*?capture: captureGame4,/);
assert.ok(serviceWorker.includes('./js/autosave-core.js'), 'khung chung phải được cache offline');

console.log('Game 2-4 autosave checks passed.');
