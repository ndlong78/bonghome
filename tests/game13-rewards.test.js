const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootPath = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(rootPath, file), 'utf8');
const createStorage = require('../js/storage.js');
const createProgress = require('../js/progress.js');
const createRewards = require('../js/rewards.js');
const createStatistics = require('../js/statistics.js');
const createGame13Rewards = require('../js/game13-rewards.js');
const createParentDataControls = require('../js/parent-data-controls.js');

const rewardCatalog = JSON.parse(read('content/rewards/catalog.json'));
const gameCatalog = JSON.parse(read('content/games/index.json'));
const html = read('game13.html');
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
  return { adapter, storage, progress, rewards, events, api: createGame13Rewards(progress, rewards, root) };
}

autoTest('catalog có Game 13, sticker Cáo tinh nhanh và huy hiệu Kỳ thủ Ca-rô nhí', () => {
  assert.ok(gameCatalog.games.some((item) => item.id === 'game13' && item.title === 'Cờ Ca-rô Tí Hon' && item.rewardsEnabled === true));
  assert.deepEqual(rewardCatalog.stickers.find((item) => item.id === 'clever-fox'), { id: 'clever-fox', name: 'Cáo tinh nhanh', icon: '🦊' });
  assert.deepEqual(rewardCatalog.badges.find((item) => item.id === 'tictactoe-master'), { id: 'tictactoe-master', name: 'Kỳ thủ Ca-rô nhí', icon: '🏅' });
});

autoTest('progress và rewards nhận game13 nhưng vẫn từ chối id ngoài phạm vi', () => {
  const { progress, rewards } = setup();
  assert.doesNotThrow(() => progress.saveGame('game13', { state: {} }));
  assert.throws(() => progress.saveGame('game14', { state: {} }), /gameId/);
  rewards.unlockSticker('clever-fox', { source: 'game13-completion' });
  assert.deepEqual(rewards.getByGameSummary().game13.stickerIds, ['clever-fox']);
});

autoTest('thắng cấp Dễ: ghi lượt chơi, cộng 3 sao, mở sticker, chưa mở huy hiệu', () => {
  const { progress, rewards, events, api } = setup();
  api.trackProgress({ levelId: 'de', moves: 1 });
  assert.equal(progress.getSummary().inProgress, 1);

  const detail = api.complete({ levelId: 'de', matchId: 'm1', outcome: 'win', stars: 3, moves: 7, durationSeconds: 30 });
  assert.equal(detail.duplicate, false);
  assert.equal(detail.stars, 3);
  assert.equal(detail.newSticker, true);
  assert.equal(detail.newBadge, false);
  assert.deepEqual(api.rewardLines(detail), ['⭐ Bé nhận 3 sao', '🦊 Sticker mới: Cáo tinh nhanh']);
  assert.equal(events.length, 1);

  const summary = progress.getSummary();
  assert.equal(summary.completed, 1);
  assert.equal(summary.inProgress, 0);
  assert.equal(summary.byGame.game13, 1);
  const [completion] = progress.listCompletions();
  assert.equal(completion.difficulty, 'de');
  assert.equal(completion.moves, 7);
  assert.equal(completion.metadata.outcome, 'win');
  assert.deepEqual(rewards.getByGameSummary().game13, { stars: 3, stickerIds: ['clever-fox'], badgeIds: [] });
  assert.equal(createStatistics(progress).summarize().totalCompleted, 1);
});

autoTest('hòa cấp Khó mở huy hiệu; cùng một ván không cộng sao hai lần; ván mới thì cộng tiếp', () => {
  const { rewards, api } = setup();
  const draw = api.complete({ levelId: 'kho', matchId: 'm-kho', outcome: 'draw', stars: 3, moves: 9 });
  assert.equal(draw.newBadge, true);
  assert.deepEqual(rewards.getByGameSummary().game13.badgeIds, ['tictactoe-master']);

  const again = api.complete({ levelId: 'kho', matchId: 'm-kho', outcome: 'draw', stars: 3 });
  assert.equal(again.duplicate, true);
  assert.equal(rewards.getSummary().stars, 3);

  const next = api.complete({ levelId: 'vua', matchId: 'm-2', outcome: 'draw', stars: 2 });
  assert.equal(next.duplicate, false);
  assert.equal(next.newSticker, false);
  assert.equal(rewards.getSummary().stars, 5);
});

autoTest('ván thua chỉ gỡ "đang chơi dở", không tính hoàn thành; outcome lạ bị từ chối', () => {
  const { progress, rewards, api } = setup();
  api.trackProgress({ levelId: 'vua', moves: 1 });
  assert.equal(api.abandon(), true);
  assert.equal(progress.getSummary().inProgress, 0);
  assert.equal(progress.getSummary().completed, 0);
  assert.equal(rewards.getSummary().stars, 0);
  assert.throws(() => api.complete({ levelId: 'de', matchId: 'x', outcome: 'lose', stars: 1 }), /outcome/);
});

autoTest('sao luôn trong khoảng 1–3 và transaction id hợp lệ', () => {
  const { rewards, api } = setup();
  api.complete({ levelId: 'de', matchId: 'big', outcome: 'win', stars: 9 });
  assert.equal(rewards.getSummary().stars, 3);
  assert.match(api.makeRewardTransactionId(api.makeProgressTransactionId('de', 'abc')), /^game13-reward-[a-z0-9]+$/);
  assert.throws(() => api.makeProgressTransactionId('Dễ', 'abc'), /levelId/);
  assert.throws(() => api.makeProgressTransactionId('de', ''), /matchId/);
});

autoTest('Xóa lịch sử chơi ở Góc phụ huynh xóa luôn ván Ca-rô đang chơi dở', () => {
  const adapter = memoryAdapter({ bonghome_game13_tictactoe: '{}', bonghome_game12_sudoku: '{}', other_key: 'x' });
  const storage = createStorage(adapter);
  const controls = createParentDataControls(storage, null);
  assert.equal(controls.isRecordKey('bonghome_game13_tictactoe'), true);
  controls.clearScope('activity');
  assert.equal(adapter.has('bonghome_game13_tictactoe'), false);
  assert.equal(adapter.has('bonghome_game12_sudoku'), false);
  assert.equal(adapter.has('other_key'), true);
});

autoTest('trang Game 13 nạp module phần thưởng trước game, chỉ thưởng khi chơi với máy và precache offline', () => {
  assert.ok(html.indexOf('js/game13-rewards.js') > 0 && html.indexOf('js/game13-rewards.js') < html.indexOf('js/game13-tictactoe.js'));
  assert.match(html, /id="tttWinRewards"[^>]*role="status"/);
  // Chỉ thưởng khi chơi với máy (chơi với bạn không cộng thưởng): e2e/game13-tictactoe.spec.js.
  assert.ok(sw.includes('"./js/game13-rewards.js"'));
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
