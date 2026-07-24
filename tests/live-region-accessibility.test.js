'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const quality = fs.readFileSync(path.join(__dirname, '..', 'pwa-quality.js'), 'utf8');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('shared quality layer makes current and future live regions atomic', () => {
  assert.match(quality, /function setupLiveRegions\(\)/);
  assert.match(quality, /\[role="status"\],\[aria-live\]:not\(\[aria-live="off"\]\)/);
  assert.match(quality, /setAttribute\('aria-atomic', 'true'\)/);
  assert.match(quality, /new MutationObserver/);
  assert.match(quality, /addedNodes\.forEach\(enhance\)/);
  assert.match(quality, /setupLiveRegions\(\);/);
});

test('reward and autosave modules expose polite status regions for enhancement', () => {
  const files = [
    'game1-autosave.js',
    'js/game1-rewards.js',
    'js/games2-4-autosave.js',
    'js/games2-4-rewards.js',
    'js/games5-7-autosave.js',
    'js/games5-7-rewards.js',
    'js/games8-10-autosave.js',
    'js/games8-10-rewards.js'
  ];

  files.forEach((file) => {
    const source = read(file);
    assert.match(source, /setAttribute\('role', 'status'\)/, `${file} needs role=status`);
    assert.match(source, /setAttribute\('aria-live', 'polite'\)/, `${file} needs aria-live=polite`);
  });
});

test('service worker refreshes the cached quality module', () => {
  const serviceWorker = read('sw.js');
  assert.match(serviceWorker, /bonghome-v44-live-regions/);
  assert.match(serviceWorker, /\.\/pwa-quality\.js/);
});
