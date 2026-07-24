'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const game = fs.readFileSync(path.join(root, 'game5.html'), 'utf8');
const helper = fs.readFileSync(path.join(root, 'js/game5-touch-target.js'), 'utf8');
const loader = fs.readFileSync(path.join(root, 'js/games5-7-rewards.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('Game 5 keeps the visible dot small while adding a larger transparent hit circle', () => {
  assert.match(game, /<circle cx="\$\{x\}" cy="\$\{y\}" r="13"\/>/);
  assert.match(helper, /const HIT_RADIUS = 27/);
  assert.match(helper, /style\.fill = 'transparent'/);
  assert.match(helper, /style\.pointerEvents = 'all'/);
  assert.match(helper, /insertBefore\(hitTarget, visibleCircle\)/);
});

test('Game 5 touch targets are restored after every board render', () => {
  assert.match(helper, /MutationObserver\(syncTouchTargets\)/);
  assert.match(helper, /observer\.observe\(layer, \{ childList: true \}\)/);
  assert.match(helper, /querySelectorAll\(DOT_SELECTOR\)\.forEach\(addHitTarget\)/);
});

test('Game 5 touch target helper loads only on Game 5 and is cached offline', () => {
  assert.match(loader, /\/game5\\\.html\$/);
  assert.match(loader, /game5-touch-target\.js/);
  assert.match(loader, /data-bh-game5-touch-target/);
  assert.match(serviceWorker, /\.\/js\/game5-touch-target\.js/);
});
