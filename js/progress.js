(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root?.BongStorage) root.BongProgress = factory(root.BongStorage);
})(typeof window !== 'undefined' ? window : globalThis, function createBongProgress(storage) {
  'use strict';

  if (!storage) throw new Error('BongProgress requires BongStorage');

  const STORAGE_KEY = 'progress';
  const SCHEMA_VERSION = 1;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const emptyProgress = () => ({
    schemaVersion: SCHEMA_VERSION,
    games: {},
    completions: {}
  });

  function readProgress() {
    const value = storage.get(STORAGE_KEY, emptyProgress());
    if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyProgress();
    return {
      schemaVersion: SCHEMA_VERSION,
      games: value.games && typeof value.games === 'object' ? value.games : {},
      completions: value.completions && typeof value.completions === 'object' ? value.completions : {}
    };
  }

  function writeProgress(progress) {
    progress.schemaVersion = SCHEMA_VERSION;
    storage.set(STORAGE_KEY, progress);
    return clone(progress);
  }

  function validateGameId(gameId) {
    if (!/^game(?:10|[1-9])$/.test(gameId)) {
      throw new TypeError('gameId must be game1 through game10');
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

  function getSummary() {
    const progress = readProgress();
    const completions = Object.values(progress.completions);
    const byGame = {};
    completions.forEach((item) => {
      byGame[item.gameId] = (byGame[item.gameId] || 0) + 1;
    });
    return {
      schemaVersion: SCHEMA_VERSION,
      inProgress: Object.keys(progress.games).length,
      completed: completions.length,
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
    getSummary
  });
});
