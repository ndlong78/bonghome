const assert = require('node:assert/strict');
const createStorage = require('../js/storage.js');
const createProgress = require('../js/progress.js');

function adapter(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
}

{
  const store = createStorage(adapter());
  assert.equal(store.schemaVersion, 1);
  assert.equal(store.get('missing', 'fallback'), 'fallback');
  store.set('profile:test', { name: 'Bông' });
  assert.deepEqual(store.get('profile:test'), { name: 'Bông' });
  assert.equal(store.clearNamespace('profile'), 1);
  assert.equal(store.get('profile:test', null), null);
  assert.equal(store.exportData().schemaVersion, 1);
}

{
  const broken = adapter({ 'bonghome:data': '{not-json' });
  const store = createStorage(broken);
  assert.equal(store.get('anything', 7), 7);
  store.migrate();
  assert.equal(store.exportData().schemaVersion, 1);
}

{
  const failing = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); }
  };
  const store = createStorage(failing);
  store.set('x', { value: 1 });
  assert.deepEqual(store.get('x'), { value: 1 });
  assert.equal(store.isPersistent(), false);
}

{
  const store = createStorage(adapter());
  const progress = createProgress(store);
  progress.saveGame('game1', {
    difficulty: 'easy',
    state: { cards: [1, 2], moves: 1 }
  });
  assert.equal(progress.loadGame('game1').status, 'in_progress');
  assert.equal(progress.getSummary().inProgress, 1);

  const first = progress.completeGame('game1', {
    transactionId: 'game1-run-1',
    durationSeconds: 20,
    moves: 4
  });
  assert.equal(first.duplicate, false);
  assert.equal(progress.loadGame('game1'), null);
  assert.equal(progress.getSummary().completed, 1);

  const duplicate = progress.completeGame('game1', {
    transactionId: 'game1-run-1',
    durationSeconds: 99
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(progress.getSummary().completed, 1);

  progress.saveGame('game2', { state: { found: [1] } });
  assert.equal(progress.clearGame('game2'), true);
  assert.equal(progress.clearGame('game2'), false);
  assert.throws(() => progress.saveGame('game11', { state: {} }), /gameId/);
}

console.log('Storage and progress tests passed.');
