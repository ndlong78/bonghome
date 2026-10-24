(function (root, factory) {
  'use strict';
  const api = factory(root?.localStorage);
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root) root.BongStorage = api;
})(typeof window !== 'undefined' ? window : globalThis, function createBongStorage(storageAdapter) {
  'use strict';

  const STORAGE_KEY = 'bonghome:data';
  const BACKUP_KEY_PREFIX = `${STORAGE_KEY}:corrupt:`;
  /*
   * Quy ước khóa localStorage nằm ngoài tài liệu `bonghome:data`:
   * - `kyluc_*`: kỷ lục cá nhân của các game cũ (dữ liệu chơi của bé);
   * - `bonghome_game<N>_<tên>`: ván đang chơi dở mà game tự lưu (dữ liệu chơi của bé);
   * - `bonghome:data:corrupt:*`: bản sao lưu tài liệu hỏng (dữ liệu của bé);
   * - `bonghome_sound_enabled`: thiết lập của thiết bị, không phải dữ liệu của bé.
   * tests/storage-keys.test.js chặn khóa mới không theo quy ước này.
   */
  const ACTIVITY_KEY_PATTERNS = Object.freeze([/^kyluc_/, /^bonghome_game\d+_[a-z0-9_-]+$/]);
  const SETTING_KEYS = Object.freeze(['bonghome_sound_enabled']);
  const isActivityRawKey = (key) => typeof key === 'string' && ACTIVITY_KEY_PATTERNS.some((pattern) => pattern.test(key));
  const isChildDataRawKey = (key) => isActivityRawKey(key) || (typeof key === 'string' && key.startsWith(BACKUP_KEY_PREFIX));
  const MAX_BACKUPS = 3;
  const CURRENT_SCHEMA_VERSION = 1;
  const memory = new Map();
  let persistent = Boolean(storageAdapter);
  let recoveryMode = null;
  // Bản mới nhất chưa ghi được xuống thiết bị (ví dụ hết quota). Đọc luôn ưu tiên
  // bản này để không lùi dữ liệu, và mỗi lần ghi sau sẽ thử ghi xuống lại.
  let pendingRaw = null;
  let lastWriteError = null;
  let backupKey = null;

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
    if (pendingRaw !== null) return pendingRaw;
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
        pendingRaw = null;
        lastWriteError = null;
        if (recoveryMode === 'write-failed') recoveryMode = null;
        return true;
      } catch (error) {
        // Không tắt hẳn bộ nhớ thiết bị: lỗi quota có thể chỉ thoáng qua.
        pendingRaw = value;
        lastWriteError = error?.name || error?.message || 'write-error';
        recoveryMode = 'write-failed';
        return false;
      }
    }
    memory.set(STORAGE_KEY, value);
    return false;
  }

  /** Thử ghi lại bản đang chờ (gọi khi trang bị ẩn hoặc đóng). */
  function flush() {
    if (pendingRaw === null) return true;
    return writeRaw(pendingRaw);
  }

  function listBackupKeys() {
    return listRawKeys().filter((key) => key.startsWith(BACKUP_KEY_PREFIX)).sort();
  }

  /**
   * Giữ nguyên chuỗi hỏng trước khi ghi đè để phụ huynh còn đường khôi phục.
   * Trả về false khi không sao lưu được — khi đó tuyệt đối không ghi đè bản gốc.
   */
  function backupCorruptRaw(raw) {
    if (!persistent) return false;
    try {
      const existing = listBackupKeys();
      const same = existing.find((key) => storageAdapter.getItem(key) === raw);
      if (same) {
        backupKey = same;
        return true;
      }
      const key = `${BACKUP_KEY_PREFIX}${new Date().toISOString()}`;
      storageAdapter.setItem(key, raw);
      backupKey = key;
      existing.slice(0, Math.max(0, existing.length + 1 - MAX_BACKUPS)).forEach((oldKey) => {
        try { storageAdapter.removeItem(oldKey); } catch (error) { /* Giữ lại nếu không xóa được. */ }
      });
      return true;
    } catch (error) {
      return false;
    }
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
      if (backupCorruptRaw(raw)) {
        recoveryMode = 'corrupt-json';
        return emptyDocument();
      }
      // Không sao lưu được thì chơi tạm trong bộ nhớ, giữ nguyên bản gốc trên thiết bị.
      return useMemoryFallback(emptyDocument(), 'corrupt-json-unsaved');
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

  function getHealth() {
    let bytes = null;
    try { bytes = (readRaw() || '').length; } catch (error) { bytes = null; }
    return {
      persistent: persistent && pendingRaw === null,
      recoveryMode,
      pendingWrite: pendingRaw !== null,
      lastWriteError,
      backupKey,
      backupKeys: listBackupKeys(),
      sizeChars: bytes
    };
  }

  return Object.freeze({
    STORAGE_KEY,
    BACKUP_KEY_PREFIX,
    SETTING_KEYS,
    isActivityRawKey,
    isChildDataRawKey,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    get,
    set,
    remove,
    clearNamespace,
    listRawKeys,
    removeRawKeys,
    migrate,
    exportData: () => clone(readDocument()),
    flush,
    getHealth,
    isPersistent: () => persistent && pendingRaw === null,
    getRecoveryMode: () => recoveryMode
  });
});
