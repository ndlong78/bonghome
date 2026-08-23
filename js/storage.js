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
  let recoveryMode = null;

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const emptyDocument = () => ({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    data: {}
  });

  function useMemoryFallback(document, mode) {
    persistent = false;
    recoveryMode = mode;
    memory.set(STORAGE_KEY, JSON.stringify(document));
    return document;
  }

  function readRaw() {
    if (persistent) {
      try { return storageAdapter.getItem(STORAGE_KEY); }
      catch (error) {
        persistent = false;
        recoveryMode = 'storage-unavailable';
      }
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
        recoveryMode = 'storage-unavailable';
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
    try {
      const parsed = JSON.parse(raw);
      if (
        parsed
        && typeof parsed === 'object'
        && !Array.isArray(parsed)
        && Number.isInteger(parsed.schemaVersion)
        && parsed.schemaVersion > CURRENT_SCHEMA_VERSION
      ) {
        return useMemoryFallback(emptyDocument(), 'future-schema');
      }
      return normalizeDocument(parsed);
    } catch (error) {
      recoveryMode = 'corrupt-json';
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

  /**
   * Liệt kê khóa thô của thiết bị (kể cả khóa do 10 game tự ghi ngoài tài liệu
   * `bonghome:data`). Trả về mảng rỗng khi storage bị chặn hoặc không duyệt được.
   */
  function listRawKeys() {
    if (!persistent) return [];
    try {
      const total = Number(storageAdapter.length);
      if (!Number.isInteger(total) || typeof storageAdapter.key !== 'function') return [];
      const keys = [];
      for (let index = 0; index < total; index += 1) {
        const key = storageAdapter.key(index);
        if (typeof key === 'string') keys.push(key);
      }
      return keys;
    } catch (error) {
      return [];
    }
  }

  /**
   * Xóa các khóa thô thỏa `predicate`. Tài liệu chính luôn được bảo vệ để một
   * predicate quá rộng không thể xóa nhầm toàn bộ dữ liệu.
   */
  function removeRawKeys(predicate) {
    if (typeof predicate !== 'function') throw new TypeError('removeRawKeys requires a predicate function');
    let removed = 0;
    listRawKeys()
      .filter((key) => key !== STORAGE_KEY && predicate(key))
      .forEach((key) => {
        try {
          storageAdapter.removeItem(key);
          removed += 1;
        } catch (error) {
          /* Bỏ qua khóa không xóa được, vẫn xóa tiếp các khóa còn lại. */
        }
      });
    return removed;
  }

  return Object.freeze({
    STORAGE_KEY,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    get,
    set,
    remove,
    clearNamespace,
    listRawKeys,
    removeRawKeys,
    migrate,
    exportData: () => clone(readDocument()),
    isPersistent: () => persistent,
    getRecoveryMode: () => recoveryMode
  });
});
