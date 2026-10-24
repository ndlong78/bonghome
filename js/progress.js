(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root?.BongStorage) root.BongProgress = factory(root.BongStorage);
})(typeof window !== 'undefined' ? window : globalThis, function createBongProgress(storage) {
  'use strict';

  if (!storage) throw new Error('BongProgress requires BongStorage');

  const STORAGE_KEY = 'progress';
  const SCHEMA_VERSION = 1;
  // Giữ chi tiết các lượt gần nhất; lượt cũ hơn được cộng dồn vào `archive` để
  // tài liệu localStorage không phình mãi tới khi chạm quota.
  const MAX_COMPLETIONS = 500;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const count = (value) => Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  const total = (value) => Number.isFinite(value) && value > 0 ? value : 0;
  const emptyArchive = () => ({
    completed: 0,
    byGame: {},
    durationTotal: 0,
    durationCount: 0,
    movesTotal: 0,
    movesCount: 0
  });
  const emptyProgress = () => ({
    schemaVersion: SCHEMA_VERSION,
    games: {},
    completions: {},
    archive: emptyArchive()
  });

  function normalizeArchive(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const byGame = {};
    if (source.byGame && typeof source.byGame === 'object' && !Array.isArray(source.byGame)) {
      Object.entries(source.byGame).forEach(([gameId, amount]) => {
        if (count(amount)) byGame[gameId] = count(amount);
      });
    }
    return {
      completed: count(source.completed),
      byGame,
      durationTotal: total(source.durationTotal),
      durationCount: count(source.durationCount),
      movesTotal: total(source.movesTotal),
      movesCount: count(source.movesCount)
    };
  }

  function readProgress() {
    const value = storage.get(STORAGE_KEY, emptyProgress());
    if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyProgress();
    return {
      schemaVersion: SCHEMA_VERSION,
      games: value.games && typeof value.games === 'object' ? value.games : {},
      completions: value.completions && typeof value.completions === 'object' ? value.completions : {},
      archive: normalizeArchive(value.archive)
    };
  }

  function completionTime(item) {
    const time = new Date(item?.completedAt).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  function compact(progress) {
    const entries = Object.entries(progress.completions);
    if (entries.length <= MAX_COMPLETIONS) return progress;
    entries
      .sort(([, a], [, b]) => completionTime(a) - completionTime(b))
      .slice(0, entries.length - MAX_COMPLETIONS)
      .forEach(([transactionId, item]) => {
        const archive = progress.archive;
        archive.completed += 1;
        if (item?.gameId) archive.byGame[item.gameId] = (archive.byGame[item.gameId] || 0) + 1;
        if (Number.isFinite(item?.durationSeconds)) {
          archive.durationTotal += item.durationSeconds;
          archive.durationCount += 1;
        }
        if (Number.isFinite(item?.moves)) {
          archive.movesTotal += item.moves;
          archive.movesCount += 1;
        }
        delete progress.completions[transactionId];
      });
    return progress;
  }

  function writeProgress(progress) {
    progress.schemaVersion = SCHEMA_VERSION;
    storage.set(STORAGE_KEY, compact(progress));
    return clone(progress);
  }

  function validateGameId(gameId) {
    if (!/^game(?:1[0-3]|[1-9])$/.test(gameId)) {
      throw new TypeError('gameId must be game1 through game13');
    }
  }

  function saveGame(gameId, state) {
    validateGameId(gameId);
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      throw new TypeError('Game state must be an object');
    }
    const progress = readProgress();
    progress.games[gameId] = {
      status: state.status || 'in_progress',
      difficulty: state.difficulty || null,
      theme: state.theme || null,
      state: clone(state.state || {}),
      startedAt: state.startedAt || progress.games[gameId]?.startedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    writeProgress(progress);
    return clone(progress.games[gameId]);
  }

  function loadGame(gameId) {
    validateGameId(gameId);
    return clone(readProgress().games[gameId] || null);
  }

  function clearGame(gameId) {
    validateGameId(gameId);
    const progress = readProgress();
    const existed = Boolean(progress.games[gameId]);
    if (existed) {
      delete progress.games[gameId];
      writeProgress(progress);
    }
    return existed;
  }

  function completeGame(gameId, result = {}) {
    validateGameId(gameId);
    const transactionId = result.transactionId;
    if (!transactionId || typeof transactionId !== 'string') {
      throw new TypeError('Completion requires a transactionId');
    }

    const progress = readProgress();
    if (progress.completions[transactionId]) {
      return { duplicate: true, completion: clone(progress.completions[transactionId]) };
    }

    const completion = {
      transactionId,
      gameId,
      difficulty: result.difficulty || progress.games[gameId]?.difficulty || null,
      theme: result.theme || progress.games[gameId]?.theme || null,
      durationSeconds: Number.isFinite(result.durationSeconds) ? Math.max(0, result.durationSeconds) : null,
      moves: Number.isFinite(result.moves) ? Math.max(0, result.moves) : null,
      completedAt: result.completedAt || new Date().toISOString(),
      metadata: clone(result.metadata || {})
    };

    progress.completions[transactionId] = completion;
    delete progress.games[gameId];
    writeProgress(progress);
    return { duplicate: false, completion: clone(completion) };
  }

  function listCompletions() {
    return clone(Object.values(readProgress().completions));
  }

  /** Tổng cộng dồn của các lượt đã được thu gọn khỏi danh sách chi tiết. */
  function getArchive() {
    return clone(readProgress().archive);
  }

  function getSummary() {
    const progress = readProgress();
    const completions = Object.values(progress.completions);
    const byGame = { ...progress.archive.byGame };
    completions.forEach((item) => {
      byGame[item.gameId] = (byGame[item.gameId] || 0) + 1;
    });
    return {
      schemaVersion: SCHEMA_VERSION,
      inProgress: Object.keys(progress.games).length,
      completed: completions.length + progress.archive.completed,
      byGame,
      games: clone(progress.games)
    };
  }

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    saveGame,
    loadGame,
    clearGame,
    completeGame,
    listCompletions,
    getArchive,
    getSummary
  });
});