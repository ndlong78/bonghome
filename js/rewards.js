(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root?.BongStorage) root.BongRewards = factory(root.BongStorage);
})(typeof window !== 'undefined' ? window : globalThis, function createBongRewards(storage) {
  'use strict';

  if (!storage) throw new Error('BongRewards requires BongStorage');

  const STORAGE_KEY = 'rewards';
  const SCHEMA_VERSION = 1;
  const GAME_ID_PATTERN = /^game(?:1[0-3]|[1-9])$/;
  // Chỉ giữ chi tiết các giao dịch sao gần nhất; giao dịch cũ được cộng dồn theo game.
  // Tổng `stars` không đổi khi thu gọn.
  const MAX_TRANSACTIONS = 500;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const count = (value) => Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  const emptyArchive = () => ({ transactionCount: 0, starsByGame: {} });
  const emptyRewards = () => ({
    schemaVersion: SCHEMA_VERSION,
    stars: 0,
    stickers: {},
    badges: {},
    transactions: {},
    archive: emptyArchive()
  });

  function normalizeArchive(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const starsByGame = {};
    if (source.starsByGame && typeof source.starsByGame === 'object' && !Array.isArray(source.starsByGame)) {
      Object.entries(source.starsByGame).forEach(([gameId, amount]) => {
        if (GAME_ID_PATTERN.test(gameId) && count(amount)) starsByGame[gameId] = count(amount);
      });
    }
    return { transactionCount: count(source.transactionCount), starsByGame };
  }

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
      transactions: source.transactions && typeof source.transactions === 'object' && !Array.isArray(source.transactions) ? clone(source.transactions) : {},
      archive: normalizeArchive(source.archive)
    };
  }

  function transactionTime(item) {
    const time = new Date(item?.awardedAt).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  function compact(rewards) {
    const entries = Object.entries(rewards.transactions);
    if (entries.length <= MAX_TRANSACTIONS) return rewards;
    entries
      .sort(([, a], [, b]) => transactionTime(a) - transactionTime(b))
      .slice(0, entries.length - MAX_TRANSACTIONS)
      .forEach(([transactionId, transaction]) => {
        rewards.archive.transactionCount += 1;
        const gameId = gameIdFromMetadata(transaction?.metadata);
        const amount = transaction?.type === 'stars' ? count(transaction.amount) : 0;
        if (gameId && amount) rewards.archive.starsByGame[gameId] = (rewards.archive.starsByGame[gameId] || 0) + amount;
        delete rewards.transactions[transactionId];
      });
    return rewards;
  }

  function read() {
    return normalize(storage.get(STORAGE_KEY, emptyRewards()));
  }

  function write(value) {
    const normalized = compact(normalize(value));
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
      transactionCount: Object.keys(rewards.transactions).length + rewards.archive.transactionCount
    };
  }

  function gameIdFromMetadata(metadata) {
    const direct = metadata?.gameId;
    if (GAME_ID_PATTERN.test(direct || '')) return direct;
    const source = metadata?.source;
    const match = typeof source === 'string' ? source.match(/^(game(?:1[0-3]|[1-9]))-completion$/) : null;
    return match ? match[1] : null;
  }

  function getByGameSummary() {
    const rewards = read();
    const byGame = Object.create(null);
    const ensure = (gameId) => {
      if (!byGame[gameId]) byGame[gameId] = { stars: 0, stickerIds: [], badgeIds: [] };
      return byGame[gameId];
    };

    Object.entries(rewards.archive.starsByGame).forEach(([gameId, amount]) => {
      ensure(gameId).stars += amount;
    });

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
