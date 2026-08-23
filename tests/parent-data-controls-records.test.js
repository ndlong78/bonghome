'use strict';

const assert = require('node:assert/strict');

const createStorage = require('../js/storage.js');
const createControls = require('../js/parent-data-controls.js');

/**
 * Adapter mô phỏng localStorage thật: có length/key() nên duyệt được khóa thô,
 * đúng như các khóa kỷ lục mà 10 game tự ghi ngoài tài liệu `bonghome:data`.
 */
class DeviceStorage {
  constructor(entries) {
    this.values = new Map(Object.entries(entries));
  }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  has(key) { return this.values.has(key); }
}

const RECORD_KEYS = [
  'kyluc_game1_de', 'kyluc_game1_kho', 'kyluc_game2', 'kyluc_game3', 'kyluc_game4',
  'kyluc_game5', 'kyluc_game6', 'kyluc_game7', 'kyluc_game8_1', 'kyluc_game8_3',
  'kyluc_game9', 'kyluc_game10'
];

function device() {
  const entries = {
    'bonghome:data': JSON.stringify({
      schemaVersion: 1,
      updatedAt: '2026-08-23T00:00:00.000Z',
      data: {
        progress: { schemaVersion: 1, games: { game1: {} }, completions: { done: {} } },
        rewards: { schemaVersion: 1, stars: 5, stickers: {}, badges: {}, transactions: {} },
        profile: { schemaVersion: 1, displayName: 'Bông', avatarId: 'flower' },
        themes: { schemaVersion: 1, activeThemeId: 'animals' }
      }
    }),
    bonghome_sound_enabled: 'false',
    'khong-lien-quan': 'giu-lai'
  };
  RECORD_KEYS.forEach((key) => { entries[key] = '42'; });
  return new DeviceStorage(entries);
}

// "Xóa lịch sử chơi" — kỷ lục là lịch sử chơi, phải bị xóa cùng tiến độ.
{
  const adapter = device();
  const storage = createStorage(adapter);
  const controls = createControls(storage);

  const removed = controls.clearScope('activity');
  assert.equal(removed, 1 + RECORD_KEYS.length, 'phải đếm cả tiến độ lẫn kỷ lục');

  RECORD_KEYS.forEach((key) => {
    assert.equal(adapter.has(key), false, `${key} phải bị xóa`);
  });
  assert.equal(storage.get('progress', null), null);
  assert.equal(storage.get('rewards').stars, 5, 'sao phải được giữ lại');
  assert.equal(storage.get('profile').displayName, 'Bông', 'hồ sơ phải được giữ lại');
  assert.equal(adapter.has('bonghome:data'), true, 'tài liệu chính không được xóa');
  assert.equal(adapter.has('khong-lien-quan'), true, 'khóa không liên quan phải được giữ lại');
}

// "Xóa toàn bộ dữ liệu của bé" — không được sót kỷ lục nào.
{
  const adapter = device();
  const storage = createStorage(adapter);
  const controls = createControls(storage);

  const removed = controls.clearScope('child');
  assert.equal(removed, 3 + RECORD_KEYS.length);

  const leftovers = [...adapter.values.keys()].filter((key) => key.startsWith('kyluc_'));
  assert.deepEqual(leftovers, [], 'không được còn khóa kỷ lục nào sau khi xóa toàn bộ');

  assert.equal(storage.get('progress', null), null);
  assert.equal(storage.get('rewards', null), null);
  assert.equal(storage.get('profile', null), null);
  assert.equal(storage.get('themes').activeThemeId, 'animals', 'chủ đề là tùy chọn thiết bị, được giữ lại');
  assert.equal(adapter.has('khong-lien-quan'), true);
}

// Lời hứa trong hộp thoại phải khớp với thứ thực sự bị xóa.
{
  const controls = createControls(createStorage(device()));
  Object.values(controls.SCOPES).forEach((scope) => {
    assert.match(scope.description, /kỷ lục/i, `mô tả "${scope.title}" phải nhắc tới kỷ lục`);
    assert.equal(typeof scope.rawKeyFilter, 'function', 'mỗi phạm vi phải khai báo bộ lọc khóa thô');
  });
  assert.equal(controls.isRecordKey('kyluc_game8_3'), true);
  assert.equal(controls.isRecordKey('bonghome:data'), false);
  assert.equal(controls.isRecordKey('bonghome_sound_enabled'), false);
}

// removeRawKeys không bao giờ được xóa chính tài liệu dữ liệu.
{
  const adapter = device();
  const storage = createStorage(adapter);
  const removed = storage.removeRawKeys(() => true);
  assert.ok(removed > 0);
  assert.equal(adapter.has('bonghome:data'), true, 'tài liệu chính luôn được bảo vệ');
  assert.equal(storage.get('rewards').stars, 5, 'dữ liệu trong tài liệu chính vẫn đọc được');
  assert.throws(() => storage.removeRawKeys('kyluc_'), /predicate function/);
}

// Adapter không duyệt được khóa (hoặc storage bị chặn) thì không được ném lỗi.
{
  const blocked = createStorage({
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); }
  });
  assert.deepEqual(blocked.listRawKeys(), []);
  assert.equal(blocked.removeRawKeys(() => true), 0);
  assert.equal(createControls(blocked).clearScope('child'), 0);
}

console.log('✓ Parent data control record checks passed');
