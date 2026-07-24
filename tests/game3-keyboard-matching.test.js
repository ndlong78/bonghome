'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/game3-keyboard-matching.js'), 'utf8');
const rewards = fs.readFileSync(path.join(root, 'js/games2-4-rewards.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('Game 3 keyboard matching module is loaded only on Game 3 and cached offline', () => {
  assert.match(rewards, /loadKeyboardModule\('game3', 'game3-keyboard-matching\.js'/);
  assert.match(rewards, /data-bh-game3-keyboard-matching/);
  assert.match(serviceWorker, /\.\/js\/game3-keyboard-matching\.js/);
});

test('Game 3 exposes pieces and shadows as two-step keyboard controls', () => {
  assert.match(source, /\.mieng-hinh:not\(\.xong\)/);
  assert.match(source, /\.o-bong:not\(\.dung\)/);
  assert.match(source, /setAttribute\('role', 'button'\)/);
  assert.match(source, /setAttribute\('tabindex', done \? '-1' : '0'\)/);
  assert.match(source, /setAttribute\('aria-pressed'/);
  assert.match(source, /event\.key !== 'Enter' && event\.key !== ' '/);
});

test('Game 3 keyboard matching reuses the existing pointer flow and announces results', () => {
  assert.match(source, /new PointerEvent\('pointerdown'/);
  assert.match(source, /new PointerEvent\('pointerup'/);
  assert.match(source, /setPointerCapture = \(\) => \{\}/);
  assert.match(source, /role', 'status'/);
  assert.match(source, /aria-live', 'polite'/);
  assert.match(source, /đã ghép đúng/);
  assert.match(source, /chưa đúng với bóng này/);
});
