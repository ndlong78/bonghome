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

  /**
   * Bộ nhớ đệm tài liệu đã parse. Autosave ghi mỗi 2 giây, mà mỗi lần ghi trước
   * đây phải parse lại toàn bộ kho — càng chơi lâu càng đắt. Ta giữ lại chuỗi
   * thô đã đọc kèm tài liệu tương ứng; chỉ parse lại khi chuỗi thô khác đi
   * (tab khác ghi, hoặc chính ta vừa ghi).
   */
  let cachedRaw = null;
  let cachedDocument = null;

  function cacheDocument(raw, document) {
    cachedRaw = raw;
    cachedDocument = document;
    return document;
  }

  function dropCache() {
    cachedRaw = null;
    cachedDocument = null;
  }

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

  /**
   * Chuẩn hóa và NHẬN QUYỀN SỞ HỮU `input` thay vì sao chép nó. Chỉ được gọi với
   * tài liệu vừa parse từ chuỗi thô, hoặc tài liệu do chính module này sở hữu —
   * cả hai trường hợp đều không có ai khác giữ tham chiếu.
   */
  function normalizeDocument(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return emptyDocument();

    const version = Number.isInteger(input.schemaVersion) ? input.schemaVersion : 0;
    if (version > CURRENT_SCHEMA_VERSION) {
      throw new Error(`Unsupported Bông Home storage schema: ${version}`);
    }

    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      // Schema 0 không có mốc thời gian đáng tin, nên đánh dấu lại từ đầu.
      updatedAt: version === 0 ? new Date().toISOString() : (input.updatedAt || new Date().toISOString()),
      data: input.data && typeof input.data === 'object' && !Array.isArray(input.data) ? input.data : {}
    };
  }

  /**
   * Trả về tài liệu đang dùng. Đối tượng trả về thuộc sở hữu của module; hàm gọi
   * được phép sửa nó nhưng phải gọi persistDocument ngay sau đó.
   */
  function readDocument() {
    const raw = readRaw();
    if (!raw) {
      dropCache();
      return emptyDocument();
    }
    if (cachedDocument && raw === cachedRaw) return cachedDocument;

    try {
      const parsed = JSON.parse(raw);
      if (
        parsed
        && typeof parsed === 'object'
        && !Array.isArray(parsed)
        && Number.isInteger(parsed.schemaVersion)
        && parsed.schemaVersion > CURRENT_SCHEMA_VERSION
      ) {
        dropCache();
        return useMemoryFallback(emptyDocument(), 'future-schema');
      }
      return cacheDocument(raw, normalizeDocument(parsed));
    } catch (error) {
      recoveryMode = 'corrupt-json';
      dropCache();
      return emptyDocument();
    }
  }

  function persistDocument(document) {
    const normalized = normalizeDocument(document);
    normalized.updatedAt = new Date().toISOString();
    const raw = JSON.stringify(normalized);
    writeRaw(raw);
    return cacheDocument(raw, normalized);
  }

  function migrate() {
    return clone(persistDocument(readDocument()));
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
    persistDocument(document);
    return clone(value);
  }

  /**
   * Sửa một khóa tại chỗ. `updater` nhận giá trị SỐNG đang lưu (không phải bản
   * sao) và trả về giá trị mới; trả về `undefined` nghĩa là không có gì đổi và
   * không ghi xuống. Dùng cho đường ghi nóng như autosave, nơi set/get bắt buộc
   * phải sao chép cả blob hai lần chỉ để sửa một nhánh nhỏ.
   *
   * Đổi lại tốc độ, hàm gọi phải tự giữ kỷ luật: không được giữ lại tham chiếu
   * tới giá trị nhận được sau khi updater kết thúc.
   */
  function update(key, updater) {
    if (!key || typeof key !== 'string') throw new TypeError('Storage key must be a non-empty string');
    if (typeof updater !== 'function') throw new TypeError('Storage update requires an updater function');
    const document = readDocument();
    const next = updater(document.data[key]);
    if (next === undefined) return undefined;
    document.data[key] = next;
    persistDocument(document);
    return next;
  }

  function remove(key) {
    const document = readDocument();
    const existed = Object.prototype.hasOwnProperty.call(document.data, key);
    if (existed) {
      delete document.data[key];
      persistDocument(document);
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
    if (removed) persistDocument(document);
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
    update,
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
