'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/game1-keyboard-accessibility.js'), 'utf8');
const sharedUi = fs.readFileSync(path.join(root, 'shared-ui.js'), 'utf8');

test('Game 1 card accessibility module is loaded only through the shared loader', () => {
  assert.match(sharedUi, /if \(isGame1\)[\s\S]*game1-keyboard-accessibility\.js/);
  assert.match(sharedUi, /data-bh-game1-keyboard-accessibility/);
});

test('Game 1 cards expose stable flipped and matched states', () => {
  assert.match(source, /card\.setAttribute\('aria-pressed', flipped \? 'true' : 'false'\)/);
  assert.match(source, /đang úp/);
  assert.match(source, /đang mở/);
  assert.match(source, /đã ghép đúng/);
  assert.match(source, /card\.disabled = matched/);
});

test('Game 1 card state stays synchronized after board and class changes', () => {
  assert.match(source, /new MutationObserver/);
  assert.match(source, /attributeFilter: \['class'\]/);
  assert.match(source, /board\.addEventListener\('click'/);
  assert.match(source, /queueMicrotask\(syncAllCards\)/);
});
