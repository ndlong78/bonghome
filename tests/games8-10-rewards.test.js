const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootPath = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(rootPath, file), 'utf8');
const createRewardsAdapter = require('../js/games8-10-rewards.js');
const sharedUi = read('shared-ui.js');
const serviceWorker = read('sw.js');
const catalog = JSON.parse(read('content/rewards/catalog.json'));

const completedByGame = {};
const progress = {
  schemaVersion: 1,
  saveGame() {},
  loadGame() {},
  clearGame() {},
  completeGame(gameId, result) {
    completedByGame[gameId] = (completedByGame[gameId] || 0) + 1;
    return { duplicate: false, completion: { gameId, transactionId: result.transactionId } };
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
assert.equal(adapter.rewardConfig.game8.stars, 2);
assert.equal(adapter.rewardConfig.game8.stickerId, 'explorer-compass');
assert.equal(adapter.rewardConfig.game9.stickerId, 'story-book');
assert.equal(adapter.rewardConfig.game10.stickerId, 'happy-note');

adapter.completeGame('game8', { transactionId: 'game8-session-a' });
assert.equal(stars, 2);
assert.ok(stickers.has('explorer-compass'));
assert.ok(!badges.has('conqueror-kid'));

adapter.completeGame('game9', { transactionId: 'game9-session-a' });
adapter.completeGame('game10', { transactionId: 'game10-session-a' });
assert.equal(stars, 6);
assert.ok(stickers.has('story-book'));
assert.ok(stickers.has('happy-note'));
assert.ok(badges.has('conqueror-kid'));

adapter.completeGame('game10', { transactionId: 'game10-session-a' });
assert.equal(stars, 6, 'Duplicate completion must not award stars twice');

assert.ok(adapter.rewardLines({ stars: 2, newSticker: true, stickerIcon: '🧭', stickerName: 'La bàn khám phá', newBadge: true }).includes('🏆 Huy hiệu mới: Bé chinh phục'));
assert.ok(catalog.stickers.some((item) => item.id === 'explorer-compass'));
assert.ok(catalog.stickers.some((item) => item.id === 'story-book'));
assert.ok(catalog.stickers.some((item) => item.id === 'happy-note'));
assert.ok(catalog.badges.some((item) => item.id === 'conqueror-kid'));

const rewardIndex = sharedUi.indexOf("loadSharedScript('./js/games8-10-rewards.js'");
const autosaveIndex = sharedUi.indexOf("loadSharedScript('./js/games8-10-autosave.js'");
assert.ok(rewardIndex >= 0 && autosaveIndex > rewardIndex, 'Reward adapter must load before autosave');
assert.ok(sharedUi.includes('if (!modules.progress || !modules.rewards) return null;'));
assert.ok(serviceWorker.includes('./js/games8-10-rewards.js'));
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

console.log('Games 8-10 reward checks passed.');
