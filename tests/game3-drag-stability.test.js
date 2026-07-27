'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootPath = path.resolve(__dirname, '..');
const createDragStability = require(path.join(rootPath, 'js', 'game3-drag-stability.js'));
const qualitySource = fs.readFileSync(path.join(rootPath, 'pwa-quality.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(rootPath, 'sw.js'), 'utf8');

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type, event = {}) {
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
}

const documentTarget = new FakeEventTarget();
const windowTarget = new FakeEventTarget();
const piece = {
  classList: { contains: () => false },
  closest: (selector) => selector === '.mieng-hinh' ? piece : null
};
const tray = {
  dataset: {},
  style: {
    minHeight: '',
    removeProperty(name) {
      if (name === 'min-height') this.minHeight = '';
    }
  },
  contains: (candidate) => candidate === piece,
  getBoundingClientRect: () => ({ height: 242 })
};
const fakeRoot = Object.assign(windowTarget, {
  document: Object.assign(documentTarget, {
    getElementById: (id) => id === 'khay' ? tray : null
  }),
  requestAnimationFrame: (callback) => callback(),
  setTimeout
});

const dragStability = createDragStability(fakeRoot);
assert.equal(dragStability.isReady(), false);
assert.equal(typeof dragStability.init(), 'function');
assert.equal(dragStability.isReady(), true);

documentTarget.emit('pointerdown', { target: piece });
assert.equal(tray.style.minHeight, '242px');
assert.equal(tray.dataset.bhDragLayoutLocked, 'true');

documentTarget.emit('pointerup');
assert.equal(tray.style.minHeight, '');
assert.equal('bhDragLayoutLocked' in tray.dataset, false);

assert.match(qualitySource, /game3-drag-stability\.js/);
assert.match(qualitySource, /loadGame3DragStability\(\)/);
assert.ok(serviceWorker.includes('./js/game3-drag-stability.js'), 'Game 3 drag module must be cached offline');
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

console.log('Game 3 drag stability checks passed.');
