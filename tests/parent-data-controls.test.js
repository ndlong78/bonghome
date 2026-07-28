const assert = require('node:assert/strict');

const createStorage = require('../js/storage.js');
const createControls = require('../js/parent-data-controls.js');

class MemoryAdapter {
  constructor(document) {
    this.values = new Map([['bonghome:data', JSON.stringify(document)]]);
  }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

function seed() {
  return {
    schemaVersion: 1,
    updatedAt: '2026-07-27T00:00:00.000Z',
    data: {
      progress: { schemaVersion: 1, games: { game1: {} }, completions: { done: {} } },
      rewards: { schemaVersion: 1, stars: 5, stickers: {}, badges: {}, transactions: {} },
      profile: { schemaVersion: 1, displayName: 'Bông', avatarId: 'flower' },
      themes: { schemaVersion: 1, activeThemeId: 'animals' }
    }
  };
}

{
  const adapter = new MemoryAdapter(seed());
  const storage = createStorage(adapter);
  const controls = createControls(storage);

  assert.equal(controls.clearScope('activity'), 1);
  assert.equal(storage.get('progress', null), null);
  assert.equal(storage.get('rewards').stars, 5);
  assert.equal(storage.get('profile').displayName, 'Bông');
  assert.equal(storage.get('themes').activeThemeId, 'animals');
}

{
  const adapter = new MemoryAdapter(seed());
  const storage = createStorage(adapter);
  const controls = createControls(storage);

  assert.equal(controls.clearScope('child'), 3);
  assert.equal(storage.get('progress', null), null);
  assert.equal(storage.get('rewards', null), null);
  assert.equal(storage.get('profile', null), null);
  assert.equal(storage.get('themes').activeThemeId, 'animals');
}

{
  const storage = createStorage(new MemoryAdapter(seed()));
  const controls = createControls(storage);
  assert.equal(controls.isParentPage('/parents.html'), true);
  assert.equal(controls.isParentPage('/parents'), true);
  assert.equal(controls.isParentPage('/parents/'), true);
  assert.equal(controls.isParentPage('/game1.html'), false);
}

{
  const calls = [];
  const root = {
    BongRoutes: {
      isParentPage(pathname) {
        calls.push(pathname);
        return pathname === '/custom-parent';
      }
    }
  };
  const storage = createStorage(new MemoryAdapter(seed()));
  const controls = createControls(storage, root);
  assert.equal(controls.isParentPage('/custom-parent'), true);
  assert.deepEqual(calls, ['/custom-parent']);
}

assert.throws(() => {
  const storage = createStorage(new MemoryAdapter(seed()));
  createControls(storage).clearScope('unknown');
}, /Unknown parent data control scope/);

console.log('✓ Parent data control checks passed');