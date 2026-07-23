const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootPath = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(rootPath, file), 'utf8');
const createRewardsAdapter = require('../js/games5-7-rewards.js');
const sharedUi = read('shared-ui.js');
const serviceWorker = read('sw.js');
const catalog = JSON.parse(read('content/rewards/catalog.json'));

const completedByGame = {};
const progress = {
  schemaVersion: 1,
  saveGame() {},
  loadGame() { return null; },
  clearGame() { return false; },
  completeGame(gameId, result) {
    const completion = { ...result, gameId };
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
assert.equal(adapter.rewardConfig.game5.stars, 2);
assert.equal(adapter.rewardConfig.game6.stickerId, 'best-friends');
assert.equal(adapter.rewardConfig.game7.stickerId, 'bright-idea');

adapter.completeGame('game5', { transactionId: 'game5-session-a' });
assert.equal(stars, 2);
assert.ok(stickers.has('diligent-pencil'));
assert.ok(!badges.has('thinking-kid'));

adapter.completeGame('game6', { transactionId: 'game6-session-a' });
adapter.completeGame('game7', { transactionId: 'game7-session-a' });
assert.equal(stars, 6);
assert.ok(stickers.has('best-friends'));
assert.ok(stickers.has('bright-idea'));
assert.ok(badges.has('thinking-kid'));

adapter.completeGame('game7', { transactionId: 'game7-session-a' });
assert.equal(stars, 6, 'Cùng một ván không được cộng sao hai lần');

adapter.completeGame('game8', { transactionId: 'game8-session-a' });
assert.equal(stars, 6, 'PR này chỉ thưởng cho Game 5-7');

const stickerIds = new Set(catalog.stickers.map((item) => item.id));
['diligent-pencil', 'best-friends', 'bright-idea'].forEach((id) => assert.ok(stickerIds.has(id)));
assert.ok(catalog.badges.some((item) => item.id === 'thinking-kid'));

assert.ok(sharedUi.includes("./js/games5-7-rewards.js"));
assert.ok(sharedUi.indexOf("./js/games5-7-rewards.js") < sharedUi.indexOf("./js/games5-7-autosave.js"));
assert.ok(serviceWorker.includes('./js/games5-7-rewards.js'));
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

const source = read('js/games5-7-rewards.js');
[
  'function renderInWinDialog(detail)',
  "querySelector('.man-thang .hop-thang')",
  "summary.className = 'bh-reward-summary'",
  "summary.setAttribute('aria-live', 'polite')",
  '⭐ Bé nhận ${detail.stars} sao',
  '🧠 Huy hiệu mới: Bé tư duy'
].forEach((snippet) => assert.ok(source.includes(snippet), `Reward adapter must include: ${snippet}`));

console.log('Game 5-7 rewards checks passed.');
