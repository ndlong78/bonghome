const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootPath = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(rootPath, file), 'utf8');
const createStorage = require('../js/storage.js');
const createProgress = require('../js/progress.js');
const createRewards = require('../js/rewards.js');
const createStatistics = require('../js/statistics.js');
const createGame15Rewards = require('../js/game15-rewards.js');
const createParentDataControls = require('../js/parent-data-controls.js');

const rewardCatalog = JSON.parse(read('content/rewards/catalog.json'));
const gameCatalog = JSON.parse(read('content/games/index.json'));
const html = read('game15.html');
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
  return { adapter, storage, progress, rewards, events, api: createGame15Rewards(progress, rewards, root) };
}

autoTest('catalog có Game 15, sticker Đám mây vui và huy hiệu Nhà phiêu lưu nhí', () => {
  assert.ok(gameCatalog.games.some((item) => item.id === 'game15' && item.title === 'Bông Phiêu Lưu' && item.rewardsEnabled === true));
  assert.deepEqual(rewardCatalog.stickers.find((item) => item.id === 'happy-cloud'), { id: 'happy-cloud', name: 'Đám mây vui', icon: '☁️' });
  assert.deepEqual(rewardCatalog.badges.find((item) => item.id === 'adventure-hero'), { id: 'adventure-hero', name: 'Nhà phiêu lưu nhí', icon: '🗺️' });
});

autoTest('progress và rewards nhận game15 nhưng vẫn từ chối id ngoài phạm vi', () => {
  const { progress, rewards } = setup();
  assert.doesNotThrow(() => progress.saveGame('game15', { state: {} }));
  assert.throws(() => progress.saveGame('game16', { state: {} }), /gameId/);
  rewards.unlockSticker('happy-cloud', { source: 'game15-completion' });
  assert.deepEqual(rewards.getByGameSummary().game15.stickerIds, ['happy-cloud']);
});

autoTest('về đích màn Vườn Hoa: ghi lượt chơi, cộng sao, mở sticker, chưa mở huy hiệu', () => {
  const { progress, rewards, events, api } = setup();
  api.trackProgress({ levelId: 'vuon-hoa' });
  assert.equal(progress.getSummary().inProgress, 1);

  const detail = api.complete({ levelId: 'vuon-hoa', runId: 'r1', stars: 2, starsCollected: 12, totalStars: 20, durationSeconds: 80 });
  assert.equal(detail.duplicate, false);
  assert.equal(detail.stars, 2);
  assert.equal(detail.newSticker, true);
  assert.equal(detail.newBadge, false);
  assert.deepEqual(api.rewardLines(detail), ['⭐ Bé nhận 2 sao', '☁️ Sticker mới: Đám mây vui']);
  assert.equal(events.length, 1);

  const summary = progress.getSummary();
  assert.equal(summary.completed, 1);
  assert.equal(summary.inProgress, 0);
  assert.equal(summary.byGame.game15, 1);
  const [completion] = progress.listCompletions();
  assert.equal(completion.difficulty, 'vuon-hoa');
  assert.deepEqual(completion.metadata, { starsCollected: 12, totalStars: 20 });
  assert.deepEqual(rewards.getByGameSummary().game15, { stars: 2, stickerIds: ['happy-cloud'], badgeIds: [] });
  assert.equal(createStatistics(progress).summarize().totalCompleted, 1);
});

autoTest('về đích Trời Mây mở huy hiệu; cùng một lượt không cộng sao hai lần; lượt mới thì cộng tiếp', () => {
  const { rewards, api } = setup();
  const sky = api.complete({ levelId: 'troi-may', runId: 'r-may', stars: 3 });
  assert.equal(sky.newBadge, true);
  assert.deepEqual(rewards.getByGameSummary().game15.badgeIds, ['adventure-hero']);
  assert.equal(api.complete({ levelId: 'troi-may', runId: 'r-may', stars: 3 }).duplicate, true);
  assert.equal(rewards.getSummary().stars, 3);
  const next = api.complete({ levelId: 'rung-xanh', runId: 'r-2', stars: 1 });
  assert.equal(next.duplicate, false);
  assert.equal(next.newSticker, false);
  assert.equal(rewards.getSummary().stars, 4);
});

autoTest('bỏ dở chỉ gỡ "đang chơi dở"; sao luôn 1–3; transaction id hợp lệ', () => {
  const { progress, rewards, api } = setup();
  api.trackProgress({ levelId: 'rung-xanh' });
  assert.equal(api.abandon(), true);
  assert.equal(progress.getSummary().inProgress, 0);
  assert.equal(progress.getSummary().completed, 0);
  api.complete({ levelId: 'vuon-hoa', runId: 'big', stars: 9 });
  assert.equal(rewards.getSummary().stars, 3);
  assert.match(api.makeRewardTransactionId(api.makeProgressTransactionId('vuon-hoa', 'abc')), /^game15-reward-[a-z0-9]+$/);
  assert.throws(() => api.makeProgressTransactionId('Vườn', 'abc'), /levelId/);
  assert.throws(() => api.makeProgressTransactionId('vuon-hoa', ''), /runId/);
});

autoTest('Xóa lịch sử chơi ở Góc phụ huynh xóa luôn màn Phiêu Lưu đang chơi dở', () => {
  const adapter = memoryAdapter({ bonghome_game15_adventure: '{}', other_key: 'x' });
  const controls = createParentDataControls(createStorage(adapter), null);
  assert.equal(controls.isRecordKey('bonghome_game15_adventure'), true);
  controls.clearScope('activity');
  assert.equal(adapter.has('bonghome_game15_adventure'), false);
  assert.equal(adapter.has('other_key'), true);
});

autoTest('trang Game 15 nạp module phần thưởng trước game và precache offline', () => {
  assert.ok(html.indexOf('js/game15-rewards.js') > 0 && html.indexOf('js/game15-rewards.js') < html.indexOf('js/game15-adventure.js'));
  assert.ok(sw.includes('"./js/game15-rewards.js"'));
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
