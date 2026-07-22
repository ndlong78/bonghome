const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const tokens = read('css/design-tokens.css');
const common = read('css/common.css');
const components = read('css/components.css');
const sharedUi = read('shared-ui.js');
const serviceWorker = read('sw.js');

[
  '--bh-color-cream',
  '--bh-color-pink',
  '--bh-color-purple',
  '--bh-touch-target',
  '--kem: var(--bh-color-cream)',
  '--chu: var(--bh-color-text)'
].forEach((token) => assert.match(tokens, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));

assert.match(common, /prefers-reduced-motion/);
assert.match(common, /:focus-visible/);
assert.match(components, /\.nut-ve/);
assert.match(components, /\.man-thang/);
assert.match(components, /min-height:\s*var\(--bh-touch-target\)/);

[
  './css/design-tokens.css',
  './css/common.css',
  './css/components.css'
].forEach((file) => {
  assert.ok(sharedUi.includes(file), `${file} must be loaded by shared-ui.js`);
  assert.ok(serviceWorker.includes(file), `${file} must be cached by sw.js`);
});

assert.match(serviceWorker, /bonghome-v10-design-system/);
console.log('Design system smoke checks passed.');
