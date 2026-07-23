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

assert.ok(
  adapter.includes('match(/\\/(game(?:8|9|10))\\.html$/)'),
  'adapter must only run on Game 8-10 pages'
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
assert.match(sharedUi, /isGames2To4 \|\| isGames5To7 \|\| isGames8To10/);

assert.match(game8, /let N=8;/);
assert.match(game8, /function taoMeCung\(\)/);
assert.match(game9, /let chuyen=null, i=0, hen=null, dangChay=false/);
assert.match(game9, /function hienTu\(\)/);
assert.match(game10, /let dsSao=\[\], batDauLuc=0, dangChay=false/);
assert.match(game10, /function chay\(\)/);

assert.ok(serviceWorker.includes('./js/games8-10-autosave.js'), 'adapter must be cached offline');
assert.ok(serviceWorker.includes('./css/games-autosave.css'), 'shared autosave CSS must stay cached');
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

console.log('Game 8-10 autosave checks passed.');
