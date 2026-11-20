const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootPath = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(rootPath, file), 'utf8');
const createStorage = require('../js/storage.js');
const createProgress = require('../js/progress.js');
const createRewards = require('../js/rewards.js');
const createStatistics = require('../js/statistics.js');
const createGame16Rewards = require('../js/game16-rewards.js');
const createParentDataControls = require('../js/parent-data-controls.js');

const rewardCatalog = JSON.parse(read('content/rewards/catalog.json'));
const gameCatalog = JSON.parse(read('content/games/index.json'));
const html = read('game16.html');
const sw = read('sw.js');

function memoryAdapter(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    key: (index) => [...data.keys()][index] ?? null,
    get length() { return data.size; },
    has: (key) => data.has(key)
  };
}

function setup(initial) {
  const adapter = memoryAdapter(initial);
  const storage = createStorage(adapter);
  const progress = createProgress(storage);
  const rewards = createRewards(storage);
  const events = [];
  const root = { dispatchEvent: (event) => events.push(event.detail), CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } } };
  return { adapter, storage, progress, rewards, events, api: createGame16Rewards(progress, rewards, root) };
}

autoTest('catalog có Game 16, sticker Ong chăm chỉ và huy hiệu Thám tử vườn hoa', () => {
  assert.ok(gameCatalog.games.some((item) => item.id === 'game16' && item.title === 'Dò Ong Trong Vườn' && item.rewardsEnabled === true));
  assert.deepEqual(rewardCatalog.stickers.find((item) => item.id === 'busy-bee'), { id: 'busy-bee', name: 'Ong chăm chỉ', icon: '🐝' });
  assert.deepEqual(rewardCatalog.badges.find((item) => item.id === 'garden-detective'), { id: 'garden-detective', name: 'Thám tử vườn hoa', icon: '🔍' });
});

autoTest('progress và rewards nhận game16 nhưng vẫn từ chối id ngoài phạm vi', () => {
  const { progress, rewards } = setup();
  assert.doesNotThrow(() => progress.saveGame('game16', { state: {} }));
  assert.throws(() => progress.saveGame('game17', { state: {} }), /gameId/);
  rewards.unlockSticker('busy-bee', { source: 'game16-completion' });
  assert.deepEqual(rewards.getByGameSummary().game16.stickerIds, ['busy-bee']);
});

autoTest('thắng cấp Dễ: ghi lượt chơi, cộng sao, mở sticker, chưa mở huy hiệu', () => {
  const { progress, rewards, events, api } = setup();
  api.trackProgress({ levelId: 'de' });
  assert.equal(progress.getSummary().inProgress, 1);

  const detail = api.complete({ levelId: 'de', runId: 'r1', stars: 3, durationSeconds: 95, moves: 14 });
  assert.equal(detail.duplicate, false);
  assert.equal(detail.stars, 3);
  assert.equal(detail.newSticker, true);
  assert.equal(detail.newBadge, false);
  assert.deepEqual(api.rewardLines(detail), ['⭐ Bé nhận 3 sao', '🐝 Sticker mới: Ong chăm chỉ']);
  assert.equal(events.length, 1);

  const summary = progress.getSummary();
  assert.equal(summary.completed, 1);
  assert.equal(summary.inProgress, 0);
  assert.equal(summary.byGame.game16, 1);
  const [completion] = progress.listCompletions();
  assert.equal(completion.difficulty, 'de');
  assert.equal(completion.moves, 14);
  assert.deepEqual(completion.metadata, { stars: 3 });
  assert.deepEqual(rewards.getByGameSummary().game16, { stars: 3, stickerIds: ['busy-bee'], badgeIds: [] });
  assert.equal(createStatistics(progress).summarize().totalCompleted, 1);
});

autoTest('thắng cấp Khó mở huy hiệu; cùng một ván không cộng sao hai lần; ván mới thì cộng tiếp', () => {
  const { rewards, api } = setup();
  const hard = api.complete({ levelId: 'kho', runId: 'r-kho', stars: 2 });
  assert.equal(hard.newBadge, true);
  assert.deepEqual(rewards.getByGameSummary().game16.badgeIds, ['garden-detective']);
  assert.equal(api.complete({ levelId: 'kho', runId: 'r-kho', stars: 2 }).duplicate, true);
  assert.equal(rewards.getSummary().stars, 2);
  const next = api.complete({ levelId: 'vua', runId: 'r-2', stars: 3 });
  assert.equal(next.duplicate, false);
  assert.equal(next.newSticker, false);
  assert.equal(rewards.getSummary().stars, 5);
});

autoTest('mở trúng tổ ong/bỏ dở chỉ gỡ "đang chơi dở"; sao luôn 1–3; transaction id hợp lệ', () => {
  const { progress, rewards, api } = setup();
  api.trackProgress({ levelId: 'vua' });
  assert.equal(api.abandon(), true);
  assert.equal(progress.getSummary().inProgress, 0);
  assert.equal(progress.getSummary().completed, 0);
  api.complete({ levelId: 'de', runId: 'big', stars: 9 });
  assert.equal(rewards.getSummary().stars, 3);
  assert.match(api.makeRewardTransactionId(api.makeProgressTransactionId('de', 'abc')), /^game16-reward-[a-z0-9]+$/);
  assert.throws(() => api.makeProgressTransactionId('Dễ', 'abc'), /levelId/);
  assert.throws(() => api.makeProgressTransactionId('de', ''), /runId/);
});

autoTest('Xóa lịch sử chơi ở Góc phụ huynh xóa luôn ván Dò Ong đang chơi dở', () => {
  const adapter = memoryAdapter({ bonghome_game16_minesweeper: '{}', other_key: 'x' });
  const controls = createParentDataControls(createStorage(adapter), null);
  assert.equal(controls.isRecordKey('bonghome_game16_minesweeper'), true);
  controls.clearScope('activity');
  assert.equal(adapter.has('bonghome_game16_minesweeper'), false);
  assert.equal(adapter.has('other_key'), true);
});

autoTest('trang Game 16 nạp module phần thưởng trước game và precache offline', () => {
  assert.ok(html.indexOf('js/game16-rewards.js') > 0 && html.indexOf('js/game16-rewards.js') < html.indexOf('js/game16-minesweeper.js'));
  assert.ok(sw.includes('"./js/game16-rewards.js"'));
});

function autoTest(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}
