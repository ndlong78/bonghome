(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root?.BongProgress && root?.BongThemes) {
    root.BongGame1Progress = factory(root.BongProgress, root.BongThemes);
  }
})(typeof window !== 'undefined' ? window : globalThis, function createGame1ThemeProgress(baseProgress, themes) {
  'use strict';

  if (!baseProgress || !themes) throw new Error('Game 1 theme progress requires progress and themes');

  const OUTER_VERSION = 1;
  const GAME_ID = 'game1';
  const DEFAULT_THEME_ID = 'bong-home';
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function activeThemeId() {
    return themes.getActiveTheme()?.id || DEFAULT_THEME_ID;
  }

  function emptyOuter() {
    return { themeBundleVersion: OUTER_VERSION, activeThemeId: null, themes: {} };
  }

  function validateSavedRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (!value.state || typeof value.state !== 'object' || Array.isArray(value.state)) return null;
    return {
      status: value.status || 'in_progress',
      difficulty: value.difficulty || null,
      theme: value.theme || null,
      state: clone(value.state),
      startedAt: typeof value.startedAt === 'string' ? value.startedAt : null,
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null
    };
  }

  function validateOuter(saved) {
    const outer = emptyOuter();
    if (!saved) return outer;

    if (saved.state?.themeBundleVersion !== OUTER_VERSION) {
      const legacy = validateSavedRecord(saved);
      if (legacy) {
        legacy.theme = DEFAULT_THEME_ID;
        outer.activeThemeId = DEFAULT_THEME_ID;
        outer.themes[DEFAULT_THEME_ID] = legacy;
      }
      return outer;
    }

    for (const [themeId, record] of Object.entries(saved.state.themes || {})) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(themeId)) continue;
      const valid = validateSavedRecord(record);
      if (valid) {
        valid.theme = themeId;
        outer.themes[themeId] = valid;
      }
    }
    const requestedActive = saved.state.activeThemeId;
    outer.activeThemeId = outer.themes[requestedActive] ? requestedActive : (Object.keys(outer.themes)[0] || null);
    return outer;
  }

  function readOuter() {
    return validateOuter(baseProgress.loadGame(GAME_ID));
  }

  function persistOuter(outer) {
    const ids = Object.keys(outer.themes);
    if (!ids.length) return baseProgress.clearGame(GAME_ID);
    if (!outer.activeThemeId || !outer.themes[outer.activeThemeId]) outer.activeThemeId = ids[0];
    const active = outer.themes[outer.activeThemeId];
    return baseProgress.saveGame(GAME_ID, {
      status: 'in_progress',
      difficulty: active.difficulty,
      theme: outer.activeThemeId,
      state: outer,
      startedAt: active.startedAt || undefined
    });
  }

  function saveGame(gameId, state) {
    if (gameId !== GAME_ID) return baseProgress.saveGame(gameId, state);
    const themeId = activeThemeId();
    const outer = readOuter();
    const previous = outer.themes[themeId];
    const record = {
      status: state.status || 'in_progress',
      difficulty: state.difficulty || null,
      theme: themeId,
      state: clone(state.state || {}),
      startedAt: state.startedAt || previous?.startedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    outer.themes[themeId] = record;
    outer.activeThemeId = themeId;
    persistOuter(outer);
    return clone(record);
  }

  function loadGame(gameId) {
    if (gameId !== GAME_ID) return baseProgress.loadGame(gameId);
    return clone(readOuter().themes[activeThemeId()] || null);
  }

  function clearGame(gameId) {
    if (gameId !== GAME_ID) return baseProgress.clearGame(gameId);
    const themeId = activeThemeId();
    const outer = readOuter();
    const existed = Boolean(outer.themes[themeId]);
    delete outer.themes[themeId];
    if (outer.activeThemeId === themeId) outer.activeThemeId = null;
    persistOuter(outer);
    return existed;
  }

  function completeGame(gameId, result = {}) {
    if (gameId !== GAME_ID) return baseProgress.completeGame(gameId, result);
    const themeId = activeThemeId();
    const outer = readOuter();
    delete outer.themes[themeId];
    if (outer.activeThemeId === themeId) outer.activeThemeId = null;

    const completionResult = baseProgress.completeGame(gameId, {
      ...result,
      theme: themeId,
      metadata: { ...(result.metadata || {}), themeId }
    });
    persistOuter(outer);
    return completionResult;
  }

  return Object.freeze({
    schemaVersion: baseProgress.schemaVersion,
    themeBundleVersion: OUTER_VERSION,
    validateOuter,
    saveGame,
    loadGame,
    clearGame,
    completeGame,
    getSummary: baseProgress.getSummary
  });
});
