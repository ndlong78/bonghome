'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const gameFiles = Array.from({ length: 10 }, (_, index) => `game${index + 1}.html`);
const mainPages = ['index.html', 'parents.html', 'collection.html'];

for (const file of [...mainPages, ...gameFiles]) {
  test(`${file} declares Vietnamese language and an iPhone/iPad-safe viewport`, () => {
    const html = read(file);
    assert.match(html, /<html\s+lang="vi"/i);
    assert.match(html, /<meta\s+name="viewport"[^>]*viewport-fit=cover/i);
  });
}

for (const file of gameFiles) {
  test(`${file} exposes an accessible completion dialog`, () => {
    const html = read(file);
    assert.match(html, /class="man-thang"/);
    assert.match(html, /role="dialog"/);
    assert.match(html, /aria-modal="true"/);
    assert.match(html, /aria-labelledby=/);
    assert.match(html, /class="nhom-nut"/);
  });

  test(`${file} includes reduced-motion support`, () => {
    assert.match(read(file), /prefers-reduced-motion\s*:\s*reduce/i);
  });
}

test('shared quality layer manages keyboard focus for completion dialogs', () => {
  const source = read('pwa-quality.js');
  assert.match(source, /function setupDialogFocus\(/);
  assert.match(source, /event\.key !== 'Tab'/);
  assert.match(source, /item\.inert = true/);
  assert.match(source, /previousFocus\?\.isConnected/);
});

test('parent and collection pages expose labelled main content', () => {
  for (const file of ['parents.html', 'collection.html']) {
    const html = read(file);
    assert.match(html, /<main\b[^>]*aria-labelledby=/i, `${file} needs a labelled main landmark`);
    assert.match(html, /<h1\b[^>]*id=/i, `${file} needs an h1 id for the main label`);
  }
});
