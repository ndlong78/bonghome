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
  assert.match(adapter, new RegExp(`${gameId}: \\{ capture:`), `${gameId} must have an adapter`);
});

assert.match(adapter, /progress\.saveGame\(gameId/);
assert.match(adapter, /progress\.loadGame\(gameId\)/);
assert.match(adapter, /progress\.completeGame\(gameId/);
assert.match(adapter, /transactionId: `\$\{gameId\}-finish-\$\{sessionId\}`/);
assert.match(adapter, /durationSeconds: giay/);
assert.match(adapter, /MutationObserver/);
assert.match(adapter, /pagehide/);
assert.match(adapter, /visibilitychange/);

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

console.log('Game 2-4 autosave checks passed.');
