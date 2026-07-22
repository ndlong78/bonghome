(function (root, factory) {
  'use strict';
  const api = factory(root?.localStorage);
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root) root.BongStorage = api;
})(typeof window !== 'undefined' ? window : globalThis, function createBongStorage(storageAdapter) {
  'use strict';

  const STORAGE_KEY = 'bonghome:data';
  const CURRENT_SCHEMA_VERSION = 1;
  const memory = new Map();
  let persistent = Boolean(storageAdapter);

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const emptyDocument = () => ({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    data: {}
  });

  function readRaw() {
    if (persistent) {
      try { return storageAdapter.getItem(STORAGE_KEY); }
      catch (error) { persistent = false; }
    }
    return memory.get(STORAGE_KEY) || null;
  }

  function writeRaw(value) {
    if (persistent) {
      try {
        storageAdapter.setItem(STORAGE_KEY, value);
        return true;
      } catch (error) {
        persistent = false;
      }
    }
    memory.set(STORAGE_KEY, value);
    return false;
  }

  function normalizeDocument(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return emptyDocument();
    const version = Number.isInteger(input.schemaVersion) ? input.schemaVersion : 0;
    let document = clone(input);

    if (version === 0) {
      document = {
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        data: input.data && typeof input.data === 'object' ? input.data : {}
      };
    }

    if (document.schemaVersion > CURRENT_SCHEMA_VERSION) {
      throw new Error(`Unsupported Bông Home storage schema: ${document.schemaVersion}`);
    }

    document.schemaVersion = CURRENT_SCHEMA_VERSION;
    document.updatedAt = document.updatedAt || new Date().toISOString();
    document.data = document.data && typeof document.data === 'object' && !Array.isArray(document.data)
      ? document.data
      : {};
    return document;
  }

  function readDocument() {
    const raw = readRaw();
    if (!raw) return emptyDocument();
    try { return normalizeDocument(JSON.parse(raw)); }
    catch (error) {
      if (/Unsupported Bông Home storage schema/.test(error.message)) throw error;
      return emptyDocument();
    }
  }

  function saveDocument(document) {
    const normalized = normalizeDocument(document);
    normalized.updatedAt = new Date().toISOString();
    writeRaw(JSON.stringify(normalized));
    return clone(normalized);
  }

  function migrate() {
    const document = readDocument();
    return saveDocument(document);
  }

  function get(key, fallback = null) {
    const document = readDocument();
    return Object.prototype.hasOwnProperty.call(document.data, key)
      ? clone(document.data[key])
      : clone(fallback);
  }

  function set(key, value) {
    if (!key || typeof key !== 'string') throw new TypeError('Storage key must be a non-empty string');
    const document = readDocument();
    document.data[key] = clone(value);
    saveDocument(document);
    return clone(value);
  }

  function remove(key) {
    const document = readDocument();
    const existed = Object.prototype.hasOwnProperty.call(document.data, key);
    if (existed) {
      delete document.data[key];
      saveDocument(document);
    }
    return existed;
  }

  function clearNamespace(namespace) {
    const prefix = `${namespace}:`;
    const document = readDocument();
    let removed = 0;
    Object.keys(document.data).forEach((key) => {
      if (key === namespace || key.startsWith(prefix)) {
        delete document.data[key];
        removed += 1;
      }
    });
    if (removed) saveDocument(document);
    return removed;
  }

  return Object.freeze({
    STORAGE_KEY,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    get,
    set,
    remove,
    clearNamespace,
    migrate,
    exportData: () => clone(readDocument()),
    isPersistent: () => persistent
  });
});
