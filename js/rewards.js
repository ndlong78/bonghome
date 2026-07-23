(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root?.BongStorage) root.BongRewards = factory(root.BongStorage);
})(typeof window !== 'undefined' ? window : globalThis, function createBongRewards(storage) {
  'use strict';

  if (!storage) throw new Error('BongRewards requires BongStorage');

  const STORAGE_KEY = 'rewards';
  const SCHEMA_VERSION = 1;
  const GAME_ID_PATTERN = /^game(?:10|[1-9])$/;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const emptyRewards = () => ({
    schemaVersion: SCHEMA_VERSION,
    stars: 0,
    stickers: {},
    badges: {},
    transactions: {}
  });

  function normalize(input) {
    const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    if (Number.isInteger(source.schemaVersion) && source.schemaVersion > SCHEMA_VERSION) {
      throw new Error(`Unsupported rewards schema: ${source.schemaVersion}`);
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      stars: Number.isFinite(source.stars) ? Math.max(0, Math.floor(source.stars)) : 0,
      stickers: source.stickers && typeof source.stickers === 'object' && !Array.isArray(source.stickers) ? clone(source.stickers) : {},
      badges: source.badges && typeof source.badges === 'object' && !Array.isArray(source.badges) ? clone(source.badges) : {},
      transactions: source.transactions && typeof source.transactions === 'object' && !Array.isArray(source.transactions) ? clone(source.transactions) : {}
    };
  }

  function read() {
    return normalize(storage.get(STORAGE_KEY, emptyRewards()));
  }

  function write(value) {
    const normalized = normalize(value);
    storage.set(STORAGE_KEY, normalized);
    return clone(normalized);
  }

  function migrate() {
    return write(read());
  }

  function validateId(id, label) {
    if (typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      throw new TypeError(`${label} must be a kebab-case id`);
    }
  }

  function awardStars(transactionId, amount, metadata = {}) {
    validateId(transactionId, 'transactionId');
    if (!Number.isInteger(amount) || amount < 1 || amount > 10) {
      throw new TypeError('Star amount must be an integer from 1 to 10');
    }
    const rewards = read();
    if (rewards.transactions[transactionId]) {
      return { duplicate: true, summary: getSummary() };
    }
    rewards.stars += amount;
    rewards.transactions[transactionId] = {
      type: 'stars',
      amount,
      metadata: clone(metadata),
      awardedAt: new Date().toISOString()
    };
    write(rewards);
    return { duplicate: false, summary: getSummary() };
  }

  function unlock(collection, id, metadata = {}) {
    validateId(id, 'rewardId');
    const rewards = read();
    if (rewards[collection][id]) return { duplicate: true, summary: getSummary() };
    rewards[collection][id] = {
      unlockedAt: new Date().toISOString(),
      metadata: clone(metadata)
    };
    write(rewards);
    return { duplicate: false, summary: getSummary() };
  }

  function unlockSticker(id, metadata) {
    return unlock('stickers', id, metadata);
  }

  function unlockBadge(id, metadata) {
    return unlock('badges', id, metadata);
  }

  function getSummary() {
    const rewards = read();
    return {
      schemaVersion: SCHEMA_VERSION,
      stars: rewards.stars,
      stickerIds: Object.keys(rewards.stickers),
      badgeIds: Object.keys(rewards.badges),
      transactionCount: Object.keys(rewards.transactions).length
    };
  }

  function gameIdFromMetadata(metadata) {
    const direct = metadata?.gameId;
    if (GAME_ID_PATTERN.test(direct || '')) return direct;
    const source = metadata?.source;
    const match = typeof source === 'string' ? source.match(/^(game(?:10|[1-9]))-completion$/) : null;
    return match ? match[1] : null;
  }

  function getByGameSummary() {
    const rewards = read();
    const byGame = Object.create(null);
    const ensure = (gameId) => {
      if (!byGame[gameId]) byGame[gameId] = { stars: 0, stickerIds: [], badgeIds: [] };
      return byGame[gameId];
    };

    Object.values(rewards.transactions).forEach((transaction) => {
      const gameId = gameIdFromMetadata(transaction?.metadata);
      if (!gameId || transaction?.type !== 'stars') return;
      const amount = Number.isFinite(transaction.amount) ? Math.max(0, Math.floor(transaction.amount)) : 0;
      ensure(gameId).stars += amount;
    });

    Object.entries(rewards.stickers).forEach(([id, reward]) => {
      const gameId = gameIdFromMetadata(reward?.metadata);
      if (gameId) ensure(gameId).stickerIds.push(id);
    });

    Object.entries(rewards.badges).forEach(([id, reward]) => {
      const gameId = gameIdFromMetadata(reward?.metadata);
      if (gameId) ensure(gameId).badgeIds.push(id);
    });

    return clone(byGame);
  }

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    migrate,
    awardStars,
    unlockSticker,
    unlockBadge,
    getSummary,
    getByGameSummary
  });
});
