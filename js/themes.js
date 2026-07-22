(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root?.BongStorage) root.BongThemes = factory(root.BongStorage, root);
})(typeof window !== 'undefined' ? window : globalThis, function createBongThemes(storage, root = globalThis) {
  'use strict';

  if (!storage) throw new Error('BongThemes requires BongStorage');

  const REGISTRY_URL = './content/themes/index.json';
  const STORAGE_KEY = 'themes';
  const SCHEMA_VERSION = 1;
  const TOKEN_NAMES = [
    'background', 'surface', 'text', 'primary', 'primaryStrong',
    'secondary', 'accent', 'success', 'info'
  ];
  let registry = null;

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function validateRegistry(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (value.schemaVersion !== SCHEMA_VERSION || typeof value.defaultThemeId !== 'string') return null;
    if (!Array.isArray(value.themes) || value.themes.length < 1) return null;

    const ids = new Set();
    const themes = [];
    for (const theme of value.themes) {
      if (!theme || typeof theme !== 'object' || Array.isArray(theme)) return null;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(theme.id || '') || ids.has(theme.id)) return null;
      if (typeof theme.name !== 'string' || !theme.name.trim()) return null;
      if (!theme.tokens || typeof theme.tokens !== 'object' || Array.isArray(theme.tokens)) return null;
      if (!TOKEN_NAMES.every((name) => typeof theme.tokens[name] === 'string' && theme.tokens[name].trim())) return null;
      ids.add(theme.id);
      themes.push(clone(theme));
    }
    if (!ids.has(value.defaultThemeId)) return null;
    return { schemaVersion: SCHEMA_VERSION, defaultThemeId: value.defaultThemeId, themes };
  }

  function migratePreferences(value) {
    if (typeof value === 'string' && value) {
      return { schemaVersion: SCHEMA_VERSION, activeThemeId: value };
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { schemaVersion: SCHEMA_VERSION, activeThemeId: null };
    }
    if (value.schemaVersion === SCHEMA_VERSION) {
      return {
        schemaVersion: SCHEMA_VERSION,
        activeThemeId: typeof value.activeThemeId === 'string' ? value.activeThemeId : null
      };
    }
    return { schemaVersion: SCHEMA_VERSION, activeThemeId: null };
  }

  function readPreferences() {
    const migrated = migratePreferences(storage.get(STORAGE_KEY, null));
    storage.set(STORAGE_KEY, migrated);
    return migrated;
  }

  function findTheme(themeId) {
    return registry?.themes.find((theme) => theme.id === themeId && theme.available !== false) || null;
  }

  function applyTheme(theme) {
    if (!theme) throw new TypeError('Theme is required');
    const element = root.document?.documentElement;
    if (element) {
      element.dataset.theme = theme.id;
      TOKEN_NAMES.forEach((name) => {
        const cssName = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
        element.style.setProperty(`--bh-theme-${cssName}`, theme.tokens[name]);
      });
    }
    root.dispatchEvent?.(new CustomEvent('bonghome:themechange', { detail: { theme: clone(theme) } }));
    return clone(theme);
  }

  function listThemes() {
    return clone(registry?.themes.filter((theme) => theme.available !== false) || []);
  }

  function getActiveTheme() {
    if (!registry) return null;
    const preferences = readPreferences();
    return clone(findTheme(preferences.activeThemeId) || findTheme(registry.defaultThemeId));
  }

  function setActiveTheme(themeId) {
    if (!registry) throw new Error('Theme registry is not loaded');
    const theme = findTheme(themeId);
    if (!theme) throw new RangeError(`Unknown or unavailable theme: ${themeId}`);
    storage.set(STORAGE_KEY, { schemaVersion: SCHEMA_VERSION, activeThemeId: theme.id });
    return applyTheme(theme);
  }

  async function init(fetchImpl = root.fetch?.bind(root)) {
    if (!fetchImpl) throw new Error('Fetch is unavailable');
    const response = await fetchImpl(REGISTRY_URL, { cache: 'no-cache' });
    if (!response?.ok) throw new Error(`Unable to load theme registry: HTTP ${response?.status || 0}`);
    const valid = validateRegistry(await response.json());
    if (!valid) throw new TypeError('Theme registry is invalid');
    registry = valid;
    return applyTheme(getActiveTheme());
  }

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    registryUrl: REGISTRY_URL,
    validateRegistry,
    migratePreferences,
    init,
    listThemes,
    getActiveTheme,
    setActiveTheme,
    applyTheme
  });
});
