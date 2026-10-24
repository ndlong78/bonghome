const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootPath = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(rootPath, file), 'utf8');
const createStorage = require('../js/storage.js');
const createProgress = require('../js/progress.js');
const createRewards = require('../js/rewards.js');
const createStatistics = require('../js/statistics.js');
const createGame11Rewards = require('../js/game11-rewards.js');

const rewardCatalog = JSON.parse(read('content/rewards/catalog.json'));
const gameCatalog = JSON.parse(read('content/games/index.json'));

function setup() {
  const data = new Map();
  const storage = createStorage({
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    key: (index) => [...data.keys()][index] ?? null,
    get length() { return data.size; }
  });
  const progress = createProgress(storage);
  const rewards = createRewards(storage);
  const events = [];
  const root = { dispatchEvent: (event) => events.push(event.detail), CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } } };
  return { progress, rewards, events, api: createGame11Rewards(progress, rewards, root) };
}

// Catalog: Game 11 bật phần thưởng, sticker và huy hiệu có trong catalog.
assert.ok(gameCatalog.games.some((item) => item.id === 'game11' && item.title === 'Xếp Khối Thông Minh' && item.rewardsEnabled === true));
assert.deepEqual(rewardCatalog.stickers.find((item) => item.id === 'block-builder'), { id: 'block-builder', name: 'Thợ xây khối nhí', icon: '🧱' });
assert.deepEqual(rewardCatalog.badges.find((item) => item.id === 'block-master'), { id: 'block-master', name: 'Kiến trúc sư khối', icon: '🏗️' });

// Sao theo số hàng.
{
  const { api } = setup();
  assert.deepEqual([1, 3, 4, 9, 10, 25].map(api.starsForLines), [1, 1, 2, 2, 3, 3]);
}

// Bàn chưa dọn hàng nào: không tính là hoàn thành, không cộng gì.
{
  const { api, progress, rewards, events } = setup();
  assert.equal(api.complete({ roundId: 'r0', lines: 0, score: 40, pieces: 10, durationSeconds: 30 }), null);
  assert.equal(progress.getSummary().completed, 0);
  assert.equal(rewards.getSummary().stars, 0);
  assert.equal(events.length, 0);
}

// Bàn có 5 hàng: 2 sao, mở sticker, chưa mở huy hiệu; ghi vào thống kê Góc phụ huynh.
{
  const { api, progress, rewards, events } = setup();
  const detail = api.complete({ roundId: 'r1', lines: 5, score: 560, pieces: 30, durationSeconds: 95 });
  assert.equal(detail.stars, 2);
  assert.equal(detail.newSticker, true);
  assert.equal(detail.newBadge, false);
  assert.equal(detail.duplicate, false);
  assert.deepEqual(api.rewardLines(detail), ['⭐ Bé nhận 2 sao', '🧱 Sticker mới: Thợ xây khối nhí']);
  assert.equal(progress.getSummary().byGame.game11, 1);
  assert.equal(rewards.getSummary().stars, 2);
  assert.deepEqual(rewards.getByGameSummary().game11, { stars: 2, stickerIds: ['block-builder'], badgeIds: [] });
  const [completion] = progress.listCompletions();
  assert.equal(completion.moves, 30);
  assert.equal(completion.durationSeconds, 95);
  assert.deepEqual(completion.metadata, { lines: 5, score: 560 });
  assert.equal(createStatistics(progress).summarize().totalCompleted, 1);
  assert.equal(events.length, 1);

  // Ghi lại cùng một bàn (ví dụ sự kiện lặp) không cộng thêm.
  const again = api.complete({ roundId: 'r1', lines: 5, score: 560, pieces: 30, durationSeconds: 95 });
  assert.equal(again.duplicate, true);
  assert.equal(rewards.getSummary().stars, 2);
  assert.equal(progress.getSummary().completed, 1);
}

// Bàn từ 10 hàng: 3 sao và huy hiệu Kiến trúc sư khối.
{
  const { api, rewards } = setup();
  const detail = api.complete({ roundId: 'r2', lines: 12, score: 1300, pieces: 60, durationSeconds: 300 });
  assert.equal(detail.stars, 3);
  assert.equal(detail.newBadge, true);
  assert.deepEqual(rewards.getByGameSummary().game11.badgeIds, ['block-master']);
}

assert.throws(() => setup().api.complete({ roundId: '', lines: 2 }), /roundId/);

// Trang và precache tải module phần thưởng trước vòng chơi.
const html = read('game11.html');
assert.ok(html.indexOf('./js/game11-rewards.js') > 0 && html.indexOf('./js/game11-rewards.js') < html.indexOf('./js/game11-blocks.js'));
assert.ok(read('sw.js').includes('"./js/game11-rewards.js"'));

console.log('Game 11 reward checks passed.');
