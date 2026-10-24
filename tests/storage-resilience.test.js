const assert = require('node:assert/strict');

const createStorage = require('../js/storage.js');
const createProgress = require('../js/progress.js');
const createRewards = require('../js/rewards.js');
const createStatistics = require('../js/statistics.js');
const createParentDataControls = require('../js/parent-data-controls.js');

const DATA_KEY = 'bonghome:data';

/** localStorage giả lập đủ API (getItem/setItem/removeItem/key/length) và có thể bật lỗi ghi. */
function createAdapter(initial = {}) {
  const values = new Map(Object.entries(initial));
  const adapter = {
    values,
    failWrites: false,
    failKeys: null,
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem(key, value) {
      if (adapter.failWrites || adapter.failKeys?.test(key)) {
        const error = new Error('quota');
        error.name = 'QuotaExceededError';
        throw error;
      }
      values.set(key, String(value));
    },
    removeItem: (key) => values.delete(key),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; }
  };
  return adapter;
}

const backupKeys = (adapter) => [...adapter.values.keys()].filter((key) => key.startsWith(`${DATA_KEY}:corrupt:`));

// 1. JSON hỏng: chuỗi gốc phải được sao lưu nguyên vẹn trước khi tài liệu mới ghi đè.
{
  const corrupt = '{"schemaVersion":1,"data":{"rewards":{"stars":120}';
  const adapter = createAdapter({ [DATA_KEY]: corrupt });
  const storage = createStorage(adapter);

  storage.migrate();
  assert.equal(storage.getRecoveryMode(), 'corrupt-json');
  assert.deepEqual(JSON.parse(adapter.getItem(DATA_KEY)).data, {});

  const backups = backupKeys(adapter);
  assert.equal(backups.length, 1, 'phải có đúng một bản sao lưu');
  assert.equal(adapter.getItem(backups[0]), corrupt, 'bản sao lưu phải giữ nguyên chuỗi gốc');

  const health = storage.getHealth();
  assert.equal(health.backupKey, backups[0]);
  assert.deepEqual(health.backupKeys, backups);
}

{
  const corrupt = '{broken';
  const adapter = createAdapter({ [DATA_KEY]: corrupt });
  const storage = createStorage(adapter);
  storage.get('a');
  storage.get('b');
  storage.migrate();
  assert.equal(backupKeys(adapter).length, 1, 'đọc nhiều lần không được sao lưu trùng');
}

// 2. Không sao lưu được (thiết bị đầy) thì tuyệt đối không ghi đè bản gốc.
{
  const corrupt = '{"data":{"rewards":{"stars":9}';
  const adapter = createAdapter({ [DATA_KEY]: corrupt });
  adapter.failKeys = /:corrupt:/;
  const storage = createStorage(adapter);

  storage.migrate();
  storage.set('session', { ok: true });
  assert.equal(storage.getRecoveryMode(), 'corrupt-json-unsaved');
  assert.equal(storage.isPersistent(), false);
  assert.equal(adapter.getItem(DATA_KEY), corrupt, 'bản gốc phải còn nguyên');
  assert.deepEqual(storage.get('session'), { ok: true });
}

// 3. Chỉ giữ tối đa 3 bản sao lưu, xóa bản cũ nhất.
{
  const adapter = createAdapter({
    [`${DATA_KEY}:corrupt:2026-01-01T00:00:00.000Z`]: 'a',
    [`${DATA_KEY}:corrupt:2026-02-01T00:00:00.000Z`]: 'b',
    [`${DATA_KEY}:corrupt:2026-03-01T00:00:00.000Z`]: 'c',
    [DATA_KEY]: '{new-broken'
  });
  createStorage(adapter).migrate();
  const backups = backupKeys(adapter);
  assert.equal(backups.length, 3);
  assert.equal(backups.includes(`${DATA_KEY}:corrupt:2026-01-01T00:00:00.000Z`), false, 'bản cũ nhất phải bị xóa');
  assert.ok(backups.some((key) => adapter.getItem(key) === '{new-broken'));
}

// 4. Lỗi ghi thoáng qua (quota): dữ liệu vẫn đọc được trong phiên và tự ghi lại ở lần ghi sau.
{
  const adapter = createAdapter();
  const storage = createStorage(adapter);
  storage.set('x', 1);

  adapter.failWrites = true;
  storage.set('x', 2);
  assert.equal(storage.get('x'), 2, 'đọc phải thấy bản mới nhất dù chưa ghi xuống được');
  assert.equal(storage.isPersistent(), false);
  assert.equal(storage.getRecoveryMode(), 'write-failed');
  assert.equal(storage.getHealth().pendingWrite, true);
  assert.equal(storage.getHealth().lastWriteError, 'QuotaExceededError');
  assert.equal(JSON.parse(adapter.getItem(DATA_KEY)).data.x, 1);

  adapter.failWrites = false;
  storage.set('y', 3);
  const disk = JSON.parse(adapter.getItem(DATA_KEY)).data;
  assert.deepEqual({ x: disk.x, y: disk.y }, { x: 2, y: 3 }, 'lần ghi sau phải đưa cả bản đang chờ xuống thiết bị');
  assert.equal(storage.isPersistent(), true);
  assert.equal(storage.getRecoveryMode(), null);
}

// 5. flush() ghi bản đang chờ mà không cần thay đổi dữ liệu.
{
  const adapter = createAdapter();
  const storage = createStorage(adapter);
  adapter.failWrites = true;
  storage.set('z', 'pending');
  assert.equal(storage.flush(), false);
  adapter.failWrites = false;
  assert.equal(storage.flush(), true);
  assert.equal(JSON.parse(adapter.getItem(DATA_KEY)).data.z, 'pending');
  assert.equal(storage.getHealth().pendingWrite, false);
}

// 6. Lịch sử hoàn thành được thu gọn nhưng tổng, số lượt theo game và trung bình vẫn đúng.
{
  const storage = createStorage(createAdapter());
  const progress = createProgress(storage);
  const total = 520;
  for (let index = 0; index < total; index += 1) {
    progress.completeGame(index % 2 ? 'game2' : 'game1', {
      transactionId: `t-${index}`,
      completedAt: new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString(),
      durationSeconds: 10,
      moves: 4
    });
  }
  assert.equal(progress.listCompletions().length, 500, 'chỉ giữ 500 lượt chi tiết gần nhất');
  assert.equal(progress.listCompletions().some((item) => item.transactionId === 't-0'), false, 'lượt cũ nhất bị thu gọn trước');
  const summary = progress.getSummary();
  assert.equal(summary.completed, total);
  assert.deepEqual(summary.byGame, { game1: 260, game2: 260 });
  assert.deepEqual(progress.getArchive(), {
    completed: 20,
    byGame: { game1: 10, game2: 10 },
    durationTotal: 200,
    durationCount: 20,
    movesTotal: 80,
    movesCount: 20
  });

  const stats = createStatistics(progress).summarize(new Date('2026-01-02T00:00:00.000Z'));
  assert.equal(stats.totalCompleted, total);
  assert.equal(stats.averageDurationSeconds, 10);
  assert.equal(stats.averageMoves, 4);
}

// 7. Giao dịch sao được thu gọn nhưng tổng sao và sao theo game không đổi.
{
  const storage = createStorage(createAdapter());
  const rewards = createRewards(storage);
  const total = 510;
  for (let index = 0; index < total; index += 1) {
    rewards.awardStars(`r-${index}`, 2, { gameId: index % 2 ? 'game13' : 'game12' });
  }
  const summary = rewards.getSummary();
  assert.equal(summary.stars, total * 2);
  assert.equal(summary.transactionCount, total);
  assert.equal(Object.keys(storage.get('rewards').transactions).length, 500);
  const byGame = rewards.getByGameSummary();
  assert.equal(byGame.game12.stars, 510);
  assert.equal(byGame.game13.stars, 510);
}

// 8. "Xóa toàn bộ dữ liệu của bé" phải xóa cả bản sao lưu dữ liệu hỏng; "Xóa lịch sử" thì không.
{
  const backupKey = `${DATA_KEY}:corrupt:2026-01-01T00:00:00.000Z`;
  const adapter = createAdapter({ [backupKey]: '{old', bonghome_sound_enabled: 'true' });
  const controls = createParentDataControls(createStorage(adapter), null);

  controls.clearScope('activity');
  assert.equal(adapter.getItem(backupKey), '{old');

  controls.clearScope('child');
  assert.equal(adapter.getItem(backupKey), null);
  assert.equal(adapter.getItem('bonghome_sound_enabled'), 'true', 'thiết lập âm thanh không phải dữ liệu của bé');
}

console.log('Storage resilience checks passed.');
