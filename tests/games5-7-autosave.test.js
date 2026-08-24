const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const adapter = read('js/games5-7-autosave.js');
const sharedUi = read('shared-ui.js');
const serviceWorker = read('sw.js');
// Khung autosave dùng chung cho Game 2-10; phần riêng từng game ở file nhóm.
const core = read('js/autosave-core.js');
const game5 = read('game5.html');
const game6 = read('game6.html');
const game7 = read('game7.html');

['game5', 'game6', 'game7'].forEach((gameId) => {
  assert.match(adapter, new RegExp(`${gameId}: \\{`), `${gameId} must have an adapter`);
});

assert.match(adapter, /shapeIndex:/);
assert.match(adapter, /position: viTri/);
assert.match(adapter, /round: vong/);
assert.match(adapter, /cells:/);
assert.match(adapter, /selectedIndex:/);
assert.match(adapter, /question: cau/);
assert.match(adapter, /sequence:/);
assert.match(adapter, /choices:/);
assert.match(adapter, /answer:/);
assert.match(adapter, /schemaVersion: 1/);

assert.match(sharedUi, /isGames5To7/);
assert.match(sharedUi, /\.\/js\/games5-7-autosave\.js/);
assert.match(sharedUi, /loadGames5To7Autosave\(\)/);
assert.match(sharedUi, /isGames2To4\(\) \|\| isGames5To7\(\)/);

assert.match(game5, /let hinhHienTai=null, viTri=0, soSai=0, giay=0/);
assert.match(game5, /function thangCuoc\(\)/);
assert.match(game6, /let vong=0, daChon=null, khoa=false, soSai=0, giay=0/);
assert.match(game6, /function dungVong\(\)/);
assert.match(game7, /let cau=0, dungNgay=0, khoa=false, giay=0/);
assert.match(game7, /function raCau\(\)/);

assert.ok(serviceWorker.includes('./js/games5-7-autosave.js'), 'adapter must be cached offline');
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
assert.match(adapter, /core\?\.resolveGameId\(window\.location\?\.pathname, window\.BongRoutes, 5, 7\)/);
assert.match(adapter, /globalName: 'BongGames57Autosave'/);
assert.match(adapter, /source: 'games5-7-autosave'/);
assert.equal(
  /window\.location\.pathname\.match/.test(adapter),
  false,
  'file nhóm không được tự nhận dạng đường dẫn nữa'
);
assert.match(adapter, /game5: \{[\s\S]*?capture: captureGame5,/);
assert.match(adapter, /game6: \{[\s\S]*?capture: captureGame6,/);
assert.match(adapter, /game7: \{[\s\S]*?capture: captureGame7,/);
assert.ok(serviceWorker.includes('./js/autosave-core.js'), 'khung chung phải được cache offline');

console.log('Game 5-7 autosave checks passed.');
