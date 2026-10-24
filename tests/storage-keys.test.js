const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const createStorage = require('../js/storage.js');
const createParentDataControls = require('../js/parent-data-controls.js');

const root = path.resolve(__dirname, '..');

/** Mọi tệp mã ứng dụng (bỏ test, e2e, scripts, node_modules). */
function appSources() {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', 'tests', 'e2e', 'scripts', 'docs'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(?:js|html)$/.test(entry.name) && entry.name !== 'playwright.config.js') files.push(full);
    }
  };
  walk(root);
  return files;
}

/**
 * Khóa localStorage thô mà mã ứng dụng dùng: chuỗi ngay trong getItem/setItem/removeItem
 * (phần tiền tố khi có nối chuỗi) và hằng SAVE_KEY/STORAGE_KEY ở tệp gọi localStorage trực tiếp.
 */
function rawLocalStorageKeys() {
  const keys = new Map();
  for (const file of appSources()) {
    const source = fs.readFileSync(file, 'utf8');
    if (!/localStorage\.(?:getItem|setItem|removeItem)/.test(source)) continue;
    const relative = path.relative(root, file);
    for (const match of source.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*(["'`])([^"'`]+)\1\s*([+)]?)/g)) {
      keys.set(match[3] === '+' ? `${match[2]}x` : match[2], relative);
    }
    for (const match of source.matchAll(/const (?:SAVE_KEY|STORAGE_KEY) = (["'])([^"']+)\1/g)) {
      keys.set(match[2], relative);
    }
  }
  return keys;
}

const storage = createStorage(null);
const keys = rawLocalStorageKeys();
assert.ok(keys.size >= 13, `phải tìm thấy khóa của các game (tìm được ${keys.size})`);

for (const [key, file] of keys) {
  if (key === storage.STORAGE_KEY) continue;
  assert.ok(
    storage.SETTING_KEYS.includes(key) || storage.isActivityRawKey(key),
    `${file}: khóa localStorage "${key}" không theo quy ước trong js/storage.js `
    + '(kyluc_* hoặc bonghome_game<N>_<tên> cho dữ liệu chơi, hoặc khai báo trong SETTING_KEYS)'
  );
}

// Quy ước phân loại.
assert.equal(storage.isActivityRawKey('kyluc_game8_3'), true);
assert.equal(storage.isActivityRawKey('bonghome_game12_sudoku'), true);
assert.equal(storage.isActivityRawKey('bonghome_game11_blocks'), true, 'game mới theo quy ước tự được tính');
assert.equal(storage.isActivityRawKey('bonghome_sound_enabled'), false);
assert.equal(storage.isActivityRawKey('bonghome:data'), false);
assert.equal(storage.isChildDataRawKey('bonghome:data:corrupt:2026-01-01T00:00:00.000Z'), true);
assert.equal(storage.isActivityRawKey('bonghome:data:corrupt:2026-01-01T00:00:00.000Z'), false);

// Góc phụ huynh xóa theo đúng quy ước, kể cả khóa của game chưa có trong danh sách nào.
{
  const values = new Map(Object.entries({
    'bonghome:data': JSON.stringify({ schemaVersion: 1, data: { progress: {}, rewards: { stars: 3 }, profile: {} } }),
    kyluc_game2: '30',
    bonghome_game12_sudoku: '{}',
    bonghome_game14_future: '{}',
    'bonghome:data:corrupt:2026-01-01T00:00:00.000Z': '{x',
    bonghome_sound_enabled: 'false'
  }));
  const adapter = {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; }
  };
  const controls = createParentDataControls(createStorage(adapter), null);

  controls.clearScope('activity');
  assert.equal(values.has('kyluc_game2'), false);
  assert.equal(values.has('bonghome_game12_sudoku'), false);
  assert.equal(values.has('bonghome_game14_future'), false, 'khóa ván dở của game mới cũng phải bị xóa');
  assert.equal(values.has('bonghome:data:corrupt:2026-01-01T00:00:00.000Z'), true, 'xóa lịch sử không đụng bản sao lưu');
  assert.equal(values.get('bonghome_sound_enabled'), 'false');

  controls.clearScope('child');
  assert.equal(values.has('bonghome:data:corrupt:2026-01-01T00:00:00.000Z'), false);
  assert.equal(values.get('bonghome_sound_enabled'), 'false', 'thiết lập âm thanh không phải dữ liệu của bé');
}

console.log(`Storage key convention checks passed (${keys.size} raw keys).`);
