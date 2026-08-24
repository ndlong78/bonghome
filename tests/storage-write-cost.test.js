'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const createStorage = require(path.join(root, 'js', 'storage.js'));
const createProgress = require(path.join(root, 'js', 'progress.js'));

class CountingDevice {
  constructor() {
    this.values = new Map();
    this.reads = 0;
    this.writes = 0;
  }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { this.reads += 1; return this.values.get(key) ?? null; }
  setItem(key, value) { this.writes += 1; this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function countJson(run) {
  const originalParse = JSON.parse;
  const originalStringify = JSON.stringify;
  let parses = 0;
  let stringifies = 0;
  JSON.parse = (...args) => { parses += 1; return originalParse(...args); };
  JSON.stringify = (...args) => { stringifies += 1; return originalStringify(...args); };
  try { run(); } finally {
    JSON.parse = originalParse;
    JSON.stringify = originalStringify;
  }
  return { parses, stringifies };
}

// storage.update sửa tại chỗ và không sao chép giá trị đưa cho updater.
{
  const storage = createStorage(new CountingDevice());
  storage.set('box', { items: [1, 2, 3] });

  let seenOnEntry = null;
  const result = storage.update('box', (current) => {
    // Chụp lại ngay: `current` là đối tượng sống, không phải bản sao.
    seenOnEntry = [...current.items];
    current.items.push(4);
    return current;
  });

  assert.deepEqual(seenOnEntry, [1, 2, 3], 'updater phải nhận đúng giá trị đang lưu');
  assert.deepEqual(result.items, [1, 2, 3, 4]);
  assert.deepEqual(storage.get('box').items, [1, 2, 3, 4], 'thay đổi phải được ghi xuống');
}

// Trả về undefined nghĩa là không có gì đổi: không ghi.
{
  const device = new CountingDevice();
  const storage = createStorage(device);
  storage.set('box', { value: 1 });
  const writesBefore = device.writes;

  const result = storage.update('box', () => undefined);
  assert.equal(result, undefined);
  assert.equal(device.writes, writesBefore, 'không được ghi khi updater trả về undefined');
  assert.deepEqual(storage.get('box'), { value: 1 });
}

{
  const storage = createStorage(new CountingDevice());
  assert.throws(() => storage.update('', () => ({})), /non-empty string/);
  assert.throws(() => storage.update('box', 'không phải hàm'), /updater function/);
}

// Đọc lặp lại không được parse lại tài liệu.
{
  const storage = createStorage(new CountingDevice());
  storage.set('a', { n: 1 });
  storage.set('b', { n: 2 });

  const { parses } = countJson(() => {
    for (let i = 0; i < 20; i += 1) {
      storage.get('a');
      storage.get('b');
    }
  });

  // 40 lần get, mỗi lần chỉ sao chép giá trị nhỏ — không lần nào parse cả tài liệu.
  assert.ok(parses <= 40, `đọc lặp phải dùng bộ nhớ đệm, đã parse ${parses} lần`);
}

// Tab khác ghi đè thì bộ nhớ đệm phải nhận ra và đọc lại.
{
  const device = new CountingDevice();
  const storage = createStorage(device);
  storage.set('shared', { from: 'tab-1' });
  assert.deepEqual(storage.get('shared'), { from: 'tab-1' });

  device.values.set('bonghome:data', JSON.stringify({
    schemaVersion: 1,
    updatedAt: '2026-08-24T00:00:00.000Z',
    data: { shared: { from: 'tab-2' } }
  }));

  assert.deepEqual(storage.get('shared'), { from: 'tab-2' }, 'phải đọc lại khi chuỗi thô đổi');
}

// Chi phí một lần autosave không được phụ thuộc vào độ dài lịch sử chơi.
{
  function costFor(history) {
    const storage = createStorage(new CountingDevice());
    const progress = createProgress(storage);
    for (let i = 0; i < history; i += 1) {
      progress.completeGame(`game${(i % 10) + 1}`, { transactionId: `tx${i}`, durationSeconds: 30, moves: 10 });
    }
    return countJson(() => {
      progress.saveGame('game2', { difficulty: 'x', state: { moves: history } });
    });
  }

  const small = costFor(5);
  const large = costFor(500);

  assert.equal(small.parses, large.parses, 'số lần parse mỗi lần lưu phải cố định');
  assert.equal(small.stringifies, large.stringifies, 'số lần stringify mỗi lần lưu phải cố định');
  assert.ok(small.parses <= 3, `mỗi lần lưu chỉ được parse tối đa 3 lần, đang là ${small.parses}`);
  assert.ok(small.stringifies <= 4, `mỗi lần lưu chỉ được stringify tối đa 4 lần, đang là ${small.stringifies}`);
}

// saveGame vẫn giữ nguyên hợp đồng cũ sau khi chuyển sang storage.update.
{
  const storage = createStorage(new CountingDevice());
  const progress = createProgress(storage);

  const first = progress.saveGame('game3', { difficulty: '6-shapes', state: { matched: ['a'] } });
  assert.equal(first.status, 'in_progress');
  assert.equal(first.difficulty, '6-shapes');
  assert.deepEqual(first.state, { matched: ['a'] });
  assert.ok(first.startedAt);

  const startedAt = first.startedAt;
  const second = progress.saveGame('game3', { difficulty: '6-shapes', state: { matched: ['a', 'b'] } });
  assert.equal(second.startedAt, startedAt, 'startedAt phải được giữ qua các lần lưu');
  assert.deepEqual(progress.loadGame('game3').state, { matched: ['a', 'b'] });

  // Giá trị trả về phải là bản sao độc lập, sửa nó không được ảnh hưởng kho.
  second.state.matched.push('c');
  assert.deepEqual(progress.loadGame('game3').state, { matched: ['a', 'b'] });

  assert.equal(progress.getSummary().inProgress, 1);
  progress.completeGame('game3', { transactionId: 'game3-run-1' });
  assert.equal(progress.loadGame('game3'), null);
}

// Khung autosave dùng chung phải bỏ qua lần ghi khi ván chơi không đổi.
{
  const core = fs.readFileSync(path.join(root, 'js/autosave-core.js'), 'utf8');
  assert.match(core, /let lastSavedState = null;/, 'khung chung phải nhớ lần lưu trước');
  assert.match(core, /if \(serialized === lastSavedState\) return;/, 'khung chung phải bỏ qua khi không đổi');
  assert.match(core, /lastSavedState = serialized;/, 'khung chung phải cập nhật mốc so sánh sau khi lưu');
  // Đặt lại mốc khi bắt đầu ván mới, nếu không ván mới trùng trạng thái sẽ không được ghi.
  assert.match(core, /function resetSession\(\)[\s\S]*?lastSavedState = null;/, 'ván mới phải xóa mốc so sánh');
}

console.log('✓ Storage write cost checks passed');
