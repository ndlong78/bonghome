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

assert.match(adapter, /\/(game\[567\])\\\.html/);
['game5', 'game6', 'game7'].forEach((gameId) => {
  assert.match(adapter, new RegExp(`${gameId}: \\{`), `${gameId} must have an adapter`);
});

assert.match(adapter, /progress\.saveGame\(gameId/);
assert.match(adapter, /progress\.loadGame\(gameId\)/);
assert.match(adapter, /progress\.completeGame\(gameId/);
assert.match(adapter, /transactionId: `\$\{gameId\}-finish-\$\{sessionId\}`/);
assert.match(adapter, /durationSeconds: giay/);
assert.match(adapter, /MutationObserver/);
assert.match(adapter, /pagehide/);
assert.match(adapter, /visibilitychange/);
assert.match(adapter, /SAVE_INTERVAL_MS = 2000/);

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
assert.match(sharedUi, /isGames2To4 \|\| isGames5To7/);

assert.match(game5, /let hinhHienTai=null, viTri=0, soSai=0, giay=0/);
assert.match(game5, /function thangCuoc\(\)/);
assert.match(game6, /let vong=0, daChon=null, khoa=false, soSai=0, giay=0/);
assert.match(game6, /function dungVong\(\)/);
assert.match(game7, /let cau=0, dungNgay=0, khoa=false, giay=0/);
assert.match(game7, /function raCau\(\)/);

assert.ok(serviceWorker.includes('./js/games5-7-autosave.js'), 'adapter must be cached offline');
assert.ok(serviceWorker.includes('./css/games-autosave.css'), 'shared autosave CSS must stay cached');
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

console.log('Game 5-7 autosave checks passed.');