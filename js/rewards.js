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

  const plainObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  /**
   * Chuẩn hóa và dùng lại chính các nhánh con của `source` thay vì sao chép.
   * Chỉ gọi trên đường ghi, nơi đối tượng do kho sở hữu và sắp được ghi lại.
   */
  function normalizeInPlace(input) {
    const source = plainObject(input);
    if (Number.isInteger(source.schemaVersion) && source.schemaVersion > SCHEMA_VERSION) {
      throw new Error(`Unsupported rewards schema: ${source.schemaVersion}`);
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      stars: Number.isFinite(source.stars) ? Math.max(0, Math.floor(source.stars)) : 0,
      stickers: plainObject(source.stickers),
      badges: plainObject(source.badges),
      transactions: plainObject(source.transactions)
    };
  }

  // Bản sao chép, dùng cho đường đọc để người gọi không sửa được kho.
  function normalize(input) {
    return clone(normalizeInPlace(input));
  }

  function read() {
    return normalize(storage.get(STORAGE_KEY, emptyRewards()));
  }

  function summaryFrom(rewards) {
    return {
      schemaVersion: SCHEMA_VERSION,
      stars: rewards.stars,
      stickerIds: Object.keys(rewards.stickers),
      badgeIds: Object.keys(rewards.badges),
      transactionCount: Object.keys(rewards.transactions).length
    };
  }

  /**
   * Sửa kho phần thưởng tại chỗ. Trước đây mỗi lần trao sao phải sao chép toàn
   * bộ lịch sử giao dịch ra rồi lại vào, nên càng chơi lâu càng chậm.
   */
  function mutate(mutator) {
    // storage.update là đường nhanh; mọi kho chỉ có get/set vẫn dùng được.
    if (typeof storage.update !== 'function') {
      const rewards = normalizeInPlace(read());
      const changed = mutator(rewards);
      if (changed) storage.set(STORAGE_KEY, rewards);
      return { duplicate: !changed, summary: summaryFrom(rewards) };
    }
    let outcome = null;
    storage.update(STORAGE_KEY, (current) => {
      const rewards = normalizeInPlace(current);
      const changed = mutator(rewards);
      outcome = { duplicate: !changed, summary: summaryFrom(rewards) };
      return changed ? rewards : undefined;
    });
    return outcome;
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
    return mutate((rewards) => {
      if (rewards.transactions[transactionId]) return false;
      rewards.stars += amount;
      rewards.transactions[transactionId] = {
        type: 'stars',
        amount,
        metadata: clone(metadata),
        awardedAt: new Date().toISOString()
      };
      return true;
    });
  }

  function unlock(collection, id, metadata = {}) {
    validateId(id, 'rewardId');
    return mutate((rewards) => {
      if (rewards[collection][id]) return false;
      rewards[collection][id] = {
        unlockedAt: new Date().toISOString(),
        metadata: clone(metadata)
      };
      return true;
    });
  }

  function unlockSticker(id, metadata) {
    return unlock('stickers', id, metadata);
  }

  function unlockBadge(id, metadata) {
    return unlock('badges', id, metadata);
  }

  function getSummary() {
    return summaryFrom(read());
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
