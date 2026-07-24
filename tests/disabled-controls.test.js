'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const common = read('css/common.css');
const quality = read('pwa-quality.js');
const sharedUi = read('shared-ui.js');
const games = Array.from({ length: 10 }, (_, index) => read(`game${index + 1}.html`));

test('native and custom disabled controls share a clear visual state', () => {
  assert.match(common, /button:disabled,[\s\S]*\[role="button"\]\[aria-disabled="true"\]/);
  assert.match(common, /cursor:\s*not-allowed/);
  assert.match(common, /opacity:\s*0\.58/);
  assert.match(common, /filter:\s*saturate\(0\.55\)/);
  assert.match(common, /pointer-events:\s*none/);
});

test('custom disabled buttons cannot be triggered from the keyboard', () => {
  assert.match(quality, /button\.getAttribute\('aria-disabled'\) === 'true'/);
  assert.match(quality, /if \(!button \|\| button\.getAttribute/);
});

test('shared accessibility CSS stays connected through the shared loader', () => {
  assert.match(sharedUi, /loadSharedStyle\('\.\/css\/common\.css',\s*'data-bh-common'\)/);
  games.forEach((html, index) => {
    assert.match(html, /<script[^>]+src=["']\.\/shared-ui\.js["']/i,
      `game${index + 1}.html must load shared-ui.js`);
  });
});

console.log('Disabled control accessibility checks passed.');
