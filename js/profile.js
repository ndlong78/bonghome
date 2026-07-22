(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root?.BongStorage) root.BongProfile = factory(root.BongStorage);
})(typeof window !== 'undefined' ? window : globalThis, function createBongProfile(storage) {
  'use strict';

  if (!storage) throw new Error('BongProfile requires BongStorage');

  const STORAGE_KEY = 'profile';
  const SCHEMA_VERSION = 1;
  const DEFAULT_NAME = 'Bông';
  const DEFAULT_AVATAR_ID = 'flower';
  const AVATAR_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  function cleanName(value) {
    const name = String(value == null ? '' : value)
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return name || DEFAULT_NAME;
  }

  function normalize(input) {
    const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    if (Number.isInteger(source.schemaVersion) && source.schemaVersion > SCHEMA_VERSION) {
      throw new Error(`Unsupported profile schema: ${source.schemaVersion}`);
    }
    const avatarId = typeof source.avatarId === 'string' && AVATAR_ID_PATTERN.test(source.avatarId)
      ? source.avatarId
      : DEFAULT_AVATAR_ID;
    return {
      schemaVersion: SCHEMA_VERSION,
      displayName: cleanName(source.displayName).slice(0, 20),
      avatarId
    };
  }

  function getProfile() {
    return normalize(storage.get(STORAGE_KEY, null));
  }

  function saveProfile(value) {
    const profile = normalize(value);
    storage.set(STORAGE_KEY, profile);
    return { ...profile };
  }

  function migrate() {
    return saveProfile(getProfile());
  }

  function updateProfile(changes) {
    const current = getProfile();
    return saveProfile({ ...current, ...(changes || {}) });
  }

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    defaultProfile: Object.freeze(normalize(null)),
    getProfile,
    saveProfile,
    updateProfile,
    migrate
  });
});
