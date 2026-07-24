'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const common = fs.readFileSync(path.join(root, 'css/common.css'), 'utf8');
const quality = fs.readFileSync(path.join(root, 'pwa-quality.js'), 'utf8');

const games = Array.from({ length: 10 }, (_, index) =>
  fs.readFileSync(path.join(root, `game${index + 1}.html`), 'utf8')
);

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

test('all games keep the shared accessibility styles', () => {
  games.forEach((html, index) => {
    assert.match(html, /css\/common\.css/, `game${index + 1}.html must load css/common.css`);
  });
});
