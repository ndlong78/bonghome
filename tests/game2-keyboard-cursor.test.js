'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/game2-keyboard-cursor.js'), 'utf8');
const sharedUi = fs.readFileSync(path.join(root, 'shared-ui.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('Game 2 keyboard cursor is loaded only on Game 2 and stays available offline', () => {
  assert.match(sharedUi, /const isGame2 = \/\\\/game2\\\.html\$\//);
  assert.match(sharedUi, /game2-keyboard-cursor\.js/);
  assert.match(sharedUi, /data-bh-game2-keyboard-cursor/);
  assert.match(serviceWorker, /\.\/js\/game2-keyboard-cursor\.js/);
});

test('Game 2 pictures expose arrow-key movement and Enter or Space selection', () => {
  assert.match(source, /setAttribute\('tabindex', '0'\)/);
  assert.match(source, /setAttribute\('aria-describedby'/);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /ArrowUp/);
  assert.match(source, /ArrowDown/);
  assert.match(source, /Enter: choose/);
  assert.match(source, /' ': choose/);
  assert.match(source, /dispatchEvent\(new MouseEvent\('click'/);
});

test('Game 2 cursor provides visible and spoken position feedback', () => {
  assert.match(source, /bh-game2-keyboard-cursor/);
  assert.match(source, /role', 'status'/);
  assert.match(source, /aria-live', 'polite'/);
  assert.match(source, /aria-atomic', 'true'/);
  assert.match(source, /prefers-reduced-motion: reduce/);
});
