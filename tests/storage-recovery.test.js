const assert = require('node:assert/strict');

const createStorage = require('../js/storage.js');
const createProgress = require('../js/progress.js');
const createRewards = require('../js/rewards.js');
const createProfile = require('../js/profile.js');

class MemoryAdapter {
  constructor(initialValue = null) {
    this.values = new Map();
    if (initialValue !== null) this.values.set('bonghome:data', initialValue);
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

function readStoredDocument(adapter) {
  return JSON.parse(adapter.getItem('bonghome:data'));
}

{
  const adapter = new MemoryAdapter();
  const storage = createStorage(adapter);
  const migrated = storage.migrate();

  assert.equal(migrated.schemaVersion, 1);
  assert.deepEqual(migrated.data, {});
  assert.equal(storage.isPersistent(), true);
}

{
  const adapter = new MemoryAdapter(JSON.stringify({
    data: { progress: { games: { game1: { status: 'in_progress' } } } }
  }));
  const storage = createStorage(adapter);
  const migrated = storage.migrate();

  assert.equal(migrated.schemaVersion, 1);
  assert.equal(migrated.data.progress.games.game1.status, 'in_progress');
}

{
  const adapter = new MemoryAdapter('{broken-json');
  const storage = createStorage(adapter);
  const migrated = storage.migrate();

  assert.equal(storage.getRecoveryMode(), 'corrupt-json');
  assert.equal(migrated.schemaVersion, 1);
  assert.deepEqual(migrated.data, {});
  assert.deepEqual(readStoredDocument(adapter).data, {});
}

{
  const adapter = new MemoryAdapter(JSON.stringify({ schemaVersion: 1 }));
  const storage = createStorage(adapter);
  const progress = createProgress(storage);
  const rewards = createRewards(storage);
  const profile = createProfile(storage);

  storage.migrate();
  rewards.migrate();
  profile.migrate();

  assert.deepEqual(progress.getSummary(), {
    schemaVersion: 1,
    inProgress: 0,
    completed: 0,
    byGame: {},
    games: {}
  });
  assert.deepEqual(rewards.getSummary(), {
    schemaVersion: 1,
    stars: 0,
    stickerIds: [],
    badgeIds: [],
    transactionCount: 0
  });
  assert.deepEqual(profile.getProfile(), {
    schemaVersion: 1,
    displayName: 'Bông',
    avatarId: 'flower'
  });
}

{
  const futureRaw = JSON.stringify({
    schemaVersion: 999,
    updatedAt: '2099-01-01T00:00:00.000Z',
    data: { futureOnly: { keep: true } }
  });
  const adapter = new MemoryAdapter(futureRaw);
  const storage = createStorage(adapter);

  const migrated = storage.migrate();
  assert.equal(migrated.schemaVersion, 1);
  assert.equal(storage.isPersistent(), false);
  assert.equal(storage.getRecoveryMode(), 'future-schema');
  assert.equal(adapter.getItem('bonghome:data'), futureRaw, 'dữ liệu schema tương lai phải được giữ nguyên');

  storage.set('session-only', { safe: true });
  assert.deepEqual(storage.get('session-only'), { safe: true });
  assert.equal(adapter.getItem('bonghome:data'), futureRaw, 'ghi trong phiên không được đè dữ liệu tương lai');
}

console.log('✓ Storage recovery and migration checks passed');
