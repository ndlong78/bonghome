const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootPath = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(rootPath, file), 'utf8');
const createRewardsAdapter = require('../js/games2-4-rewards.js');
const sharedUi = read('shared-ui.js');
const serviceWorker = read('sw.js');
const catalog = JSON.parse(read('content/rewards/catalog.json'));

const completions = [];
const completedByGame = {};
const progress = {
  schemaVersion: 1,
  saveGame() {},
  loadGame() {},
  clearGame() {},
  completeGame(gameId, result) {
    const completion = { gameId, transactionId: result.transactionId };
    completions.push(completion);
    completedByGame[gameId] = (completedByGame[gameId] || 0) + 1;
    return { duplicate: false, completion };
  },
  getSummary() { return { byGame: { ...completedByGame } }; }
};

let stars = 0;
const transactions = new Set();
const stickers = new Set();
const badges = new Set();
const rewards = {
  awardStars(transactionId, amount) {
    const duplicate = transactions.has(transactionId);
    if (!duplicate) {
      transactions.add(transactionId);
      stars += amount;
    }
    return { duplicate, summary: { stars } };
  },
  unlockSticker(id) {
    const duplicate = stickers.has(id);
    stickers.add(id);
    return { duplicate };
  },
  unlockBadge(id) {
    const duplicate = badges.has(id);
    badges.add(id);
    return { duplicate };
  }
};

const adapter = createRewardsAdapter(progress, rewards, null);
assert.equal(adapter.rewardConfig.game2.stars, 2);
assert.equal(adapter.rewardConfig.game3.stickerId, 'rainbow-friend');
assert.equal(adapter.rewardConfig.game4.stickerId, 'kind-heart');

adapter.completeGame('game2', { transactionId: 'game2-session-a' });
assert.equal(stars, 2);
assert.ok(stickers.has('little-flower'));
assert.ok(!badges.has('curious-learner'));

adapter.completeGame('game3', { transactionId: 'game3-session-a' });
adapter.completeGame('game4', { transactionId: 'game4-session-a' });
assert.equal(stars, 6);
assert.ok(stickers.has('rainbow-friend'));
assert.ok(stickers.has('kind-heart'));
assert.ok(badges.has('curious-learner'));

adapter.completeGame('game4', { transactionId: 'game4-session-a' });
assert.equal(stars, 6, 'same completion transaction must not add stars twice');

adapter.completeGame('game5', { transactionId: 'game5-session-a' });
assert.equal(stars, 6, 'Games outside 2-4 must not receive rewards from this adapter');

for (const id of ['little-flower', 'rainbow-friend', 'kind-heart']) {
  assert.ok(catalog.stickers.some((item) => item.id === id), `${id} must exist in reward catalog`);
}
assert.ok(catalog.badges.some((item) => item.id === 'curious-learner'));
assert.ok(sharedUi.includes('./js/games2-4-rewards.js'));
assert.ok(sharedUi.indexOf('./js/games2-4-rewards.js') < sharedUi.indexOf('./js/games2-4-autosave.js'));
assert.ok(serviceWorker.includes('./js/games2-4-rewards.js'));
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

console.log('Games 2-4 reward checks passed.');
