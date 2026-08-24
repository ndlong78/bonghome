const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const adapter = read('js/games8-10-autosave.js');
const sharedUi = read('shared-ui.js');
const serviceWorker = read('sw.js');
// Khung autosave dùng chung cho Game 2-10; phần riêng từng game ở file nhóm.
const core = read('js/autosave-core.js');
const game8 = read('game8.html');
const game9 = read('game9.html');
const game10 = read('game10.html');

['game8', 'game9', 'game10'].forEach((gameId) => {
  assert.match(adapter, new RegExp(`${gameId}: \\{`), `${gameId} must have an adapter`);
});

assert.match(adapter, /schemaVersion: 1/);

assert.match(adapter, /maze:/);
assert.match(adapter, /player:/);
assert.match(adapter, /path:/);
assert.match(adapter, /storyIndex:/);
assert.match(adapter, /wordIndex:/);
assert.match(adapter, /caughtCurrent:/);
assert.match(adapter, /stars:/);
assert.match(adapter, /elapsedMs/);
assert.match(adapter, /longestStreak:/);

assert.match(sharedUi, /isGames8To10/);
assert.match(sharedUi, /\.\/js\/games8-10-autosave\.js/);
assert.match(sharedUi, /loadGames8To10Autosave\(\)/);
assert.match(sharedUi, /isGames2To4\(\) \|\| isGames5To7\(\) \|\| isGames8To10\(\)/);

assert.match(game8, /let N=8;/);
assert.match(game8, /function taoMeCung\(\)/);
assert.match(game9, /let chuyen=null, i=0, hen=null, dangChay=false/);
assert.match(game9, /function hienTu\(\)/);
assert.match(game10, /let dsSao=\[\], batDauLuc=0, dangChay=false/);
assert.match(game10, /function chay\(\)/);

assert.ok(serviceWorker.includes('./js/games8-10-autosave.js'), 'adapter must be cached offline');
assert.ok(serviceWorker.includes('./css/games-autosave.css'), 'shared autosave CSS must stay cached');
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
assert.match(adapter, /core\?\.resolveGameId\(window\.location\?\.pathname, window\.BongRoutes, 8, 10\)/);
assert.match(adapter, /globalName: 'BongGames810Autosave'/);
assert.match(adapter, /source: 'games8-10-autosave'/);
assert.equal(
  /window\.location\.pathname\.match/.test(adapter),
  false,
  'file nhóm không được tự nhận dạng đường dẫn nữa'
);
assert.match(adapter, /game8: \{[\s\S]*?capture: captureGame8,/);
assert.match(adapter, /game9: \{[\s\S]*?capture: captureGame9,/);
assert.match(adapter, /game10: \{[\s\S]*?capture: captureGame10,/);
assert.ok(serviceWorker.includes('./js/autosave-core.js'), 'khung chung phải được cache offline');

console.log('Game 8-10 autosave checks passed.');
