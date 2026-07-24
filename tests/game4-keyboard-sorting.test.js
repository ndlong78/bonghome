'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/game4-keyboard-sorting.js'), 'utf8');
const rewards = fs.readFileSync(path.join(root, 'js/games2-4-rewards.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('Game 4 keyboard module is loaded only for Game 4 and cached offline', () => {
  assert.match(rewards, /game4-keyboard-sorting\.js/);
  assert.match(rewards, /data-bh-game4-keyboard-sorting/);
  assert.match(serviceWorker, /\.\/js\/game4-keyboard-sorting\.js/);
});

test('Game 4 supports two-step Enter or Space sorting through pointer events', () => {
  assert.match(source, /aria-pressed/);
  assert.match(source, /PointerEvent\('pointerdown'/);
  assert.match(source, /PointerEvent\('pointerup'/);
  assert.match(source, /event\.key !== 'Enter'/);
  assert.match(source, /event\.key !== ' '/);
});

test('Game 4 removes sorted items from Tab order and announces feedback', () => {
  assert.match(source, /setAttribute\('tabindex', done \? '-1' : '0'\)/);
  assert.match(source, /setAttribute\('aria-disabled', 'true'\)/);
  assert.match(source, /aria-live', 'polite'/);
  assert.match(source, /chưa đúng với giỏ này/);
});