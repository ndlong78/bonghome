const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootPath = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(rootPath, file), 'utf8');
const createStorage = require('../js/storage.js');
const createProgress = require('../js/progress.js');
const createRewards = require('../js/rewards.js');
const createStatistics = require('../js/statistics.js');
const createGame12Rewards = require('../js/game12-rewards.js');
const createParentDataControls = require('../js/parent-data-controls.js');

const rewardCatalog = JSON.parse(read('content/rewards/catalog.json'));
const gameCatalog = JSON.parse(read('content/games/index.json'));
const html = read('game12.html');
const sudoku = read('js/game12-sudoku.js');
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
  return { adapter, storage, progress, rewards, events, api: createGame12Rewards(progress, rewards, root) };
}

const givens = [1, 0, 0, 2, 0, 3, 4, 0, 0, 0, 0, 0, 2, 0, 0, 1];

autoTest('catalog có Game 12, sticker Cú mèo và huy hiệu Bậc thầy Sudoku', () => {
  assert.ok(gameCatalog.games.some((game) => game.id === 'game12' && game.rewardsEnabled === true));
  assert.deepEqual(rewardCatalog.stickers.find((item) => item.id === 'wise-owl'), { id: 'wise-owl', name: 'Cú mèo thông thái', icon: '🦉' });
  assert.deepEqual(rewardCatalog.badges.find((item) => item.id === 'sudoku-master'), { id: 'sudoku-master', name: 'Bậc thầy Sudoku', icon: '🎓' });
});

autoTest('progress và rewards nhận game12 nhưng vẫn từ chối id ngoài phạm vi', () => {
  const { progress, rewards } = setup();
  assert.doesNotThrow(() => progress.saveGame('game12', { state: {} }));
  assert.throws(() => progress.saveGame('game14', { state: {} }), /gameId/);
  rewards.unlockSticker('wise-owl', { source: 'game12-completion' });
  assert.deepEqual(rewards.getByGameSummary().game12.stickerIds, ['wise-owl']);
});

autoTest('hoàn thành bàn 4×4: ghi lượt chơi, cộng sao theo số sao trong game, mở sticker, chưa mở huy hiệu', () => {
  const { progress, rewards, events, api } = setup();
  api.trackProgress({ levelId: 'mam', left: 5 });
  assert.equal(progress.getSummary().inProgress, 1);

  const detail = api.complete({ levelId: 'mam', givens, stars: 3, hints: 0, moves: 12, durationSeconds: 95 });
  assert.equal(detail.duplicate, false);
  assert.equal(detail.stars, 3);
  assert.equal(detail.newSticker, true);
  assert.equal(detail.newBadge, false);
  assert.deepEqual(api.rewardLines(detail), ['⭐ Bé nhận 3 sao', '🦉 Sticker mới: Cú mèo thông thái']);
  assert.equal(events.length, 1);

  const summary = progress.getSummary();
  assert.equal(summary.completed, 1);
  assert.equal(summary.inProgress, 0, 'hoàn thành thì bỏ trạng thái đang chơi dở');
  assert.equal(summary.byGame.game12, 1);
  const [completion] = progress.listCompletions();
  assert.equal(completion.difficulty, 'mam');
  assert.equal(completion.moves, 12);
  assert.equal(completion.durationSeconds, 95);
  assert.equal(completion.metadata.hints, 0);

  assert.equal(rewards.getSummary().stars, 3);
  assert.deepEqual(rewards.getByGameSummary().game12, { stars: 3, stickerIds: ['wise-owl'], badgeIds: [] });

  const stats = createStatistics(progress).summarize();
  assert.equal(stats.totalCompleted, 1);
  assert.equal(stats.averageMoves, 12);
});

autoTest('giải lại đúng đề cũ không cộng sao lần hai; bàn 9×9 mở huy hiệu', () => {
  const { rewards, api } = setup();
  api.complete({ levelId: 'mam', givens, stars: 2 });
  const again = api.complete({ levelId: 'mam', givens, stars: 3 });
  assert.equal(again.duplicate, true);
  assert.equal(rewards.getSummary().stars, 2);

  const big = api.complete({ levelId: 'cay', givens: [...givens, 9], stars: 1, hints: 4 });
  assert.equal(big.newBadge, true);
  assert.equal(big.newSticker, false);
  assert.equal(rewards.getSummary().stars, 3);
  assert.deepEqual(rewards.getByGameSummary().game12.badgeIds, ['sudoku-master']);
});

autoTest('sao luôn trong khoảng 1–3 và transaction id hợp lệ kebab-case', () => {
  const { rewards, api } = setup();
  api.complete({ levelId: 'choi', givens, stars: 9 });
  assert.equal(rewards.getSummary().stars, 3);
  assert.match(api.makeRewardTransactionId(api.makeProgressTransactionId('choi', givens)), /^game12-reward-[a-z0-9]+$/);
  assert.throws(() => api.makeProgressTransactionId('Chồi', givens), /levelId/);
});

autoTest('Xóa lịch sử chơi ở Góc phụ huynh xóa luôn ván Sudoku đang chơi dở', () => {
  const adapter = memoryAdapter({ bonghome_game12_sudoku: '{}', kyluc_game6: '10', other_key: 'x' });
  const storage = createStorage(adapter);
  const controls = createParentDataControls(storage, null);
  assert.equal(controls.isRecordKey('bonghome_game12_sudoku'), true);
  controls.clearScope('activity');
  assert.equal(adapter.has('bonghome_game12_sudoku'), false);
  assert.equal(adapter.has('kyluc_game6'), false);
  assert.equal(adapter.has('other_key'), true);
});

autoTest('trang Game 12 nạp module phần thưởng trước engine và precache offline', () => {
  assert.ok(html.indexOf('js/game12-rewards.js') > 0 && html.indexOf('js/game12-rewards.js') < html.indexOf('js/game12-sudoku.js'));
  assert.match(html, /id="sudokuWinRewards"[^>]*role="status"/);
  assert.match(sudoku, /BongGame12RewardsReady/);
  assert.match(sudoku, /awardCompletion\(stars\)/);
  assert.ok(sw.includes('"./js/game12-rewards.js"'));
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
