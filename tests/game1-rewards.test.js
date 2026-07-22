const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootPath = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(rootPath, file), 'utf8');
const createGame1Rewards = require('../js/game1-rewards.js');
const sharedUi = read('shared-ui.js');
const serviceWorker = read('sw.js');

const completions = [];
const progress = {
  schemaVersion: 1,
  saveGame() {},
  loadGame() { return null; },
  clearGame() { return false; },
  completeGame(gameId, result) {
    const completion = { ...result, gameId };
    completions.push(completion);
    return { duplicate: false, completion };
  },
  getSummary() { return {}; }
};

const transactions = new Map();
const stickers = new Set();
const badges = new Set();
let stars = 0;
const rewards = {
  awardStars(id, amount, metadata) {
    if (transactions.has(id)) return { duplicate: true, summary: { stars } };
    transactions.set(id, { amount, metadata });
    stars += amount;
    return { duplicate: false, summary: { stars } };
  },
  unlockSticker(id) {
    const duplicate = stickers.has(id);
    stickers.add(id);
    return { duplicate, summary: { stars } };
  },
  unlockBadge(id) {
    const duplicate = badges.has(id);
    badges.add(id);
    return { duplicate, summary: { stars } };
  }
};

const events = [];
const bodyChildren = [];
const fakeRoot = {
  document: {
    getElementById(id) { return bodyChildren.find((item) => item.id === id) || null; },
    createElement() {
      return {
        hidden: true,
        setAttribute() {},
        textContent: '',
        className: '',
        id: ''
      };
    },
    body: { appendChild(node) { bodyChildren.push(node); } }
  },
  CustomEvent: class CustomEvent {
    constructor(type, options) { this.type = type; this.detail = options.detail; }
  },
  dispatchEvent(event) { events.push(event); },
  setTimeout(callback) { callback(); return 1; },
  clearTimeout() {}
};

const integrated = createGame1Rewards(progress, rewards, fakeRoot);
assert.equal(integrated.starsForDifficulty(3), 1);
assert.equal(integrated.starsForDifficulty(6), 2);
assert.equal(integrated.starsForDifficulty(8), 3);
assert.equal(integrated.starsForDifficulty(12), 3);

const rewardId = integrated.makeRewardTransactionId('animals:game1:6:2026-07-22T00:00:00.000Z');
assert.match(rewardId, /^game1-reward-[a-z0-9]+$/);
assert.equal(rewardId, integrated.makeRewardTransactionId('animals:game1:6:2026-07-22T00:00:00.000Z'));

integrated.completeGame('game1', {
  transactionId: 'animals:game1:6:2026-07-22T00:00:00.000Z',
  difficulty: '6',
  theme: 'animals'
});
assert.equal(stars, 2);
assert.ok(stickers.has('happy-star'));
assert.ok(badges.has('first-finish'));
assert.equal(events.length, 1);
assert.equal(events[0].detail.newSticker, true);
assert.match(bodyChildren[0].textContent, /2 sao/);

integrated.completeGame('game1', {
  transactionId: 'animals:game1:6:2026-07-22T00:00:00.000Z',
  difficulty: '6',
  theme: 'animals'
});
assert.equal(stars, 2, 'Cùng một ván không được cộng sao hai lần');
assert.equal(events.at(-1).detail.duplicate, true);

integrated.completeGame('game2', { transactionId: 'game2:finish', difficulty: '6' });
assert.equal(stars, 2, 'PR này chỉ thưởng cho Game 1');
assert.equal(completions.length, 3);

assert.ok(sharedUi.includes("./js/rewards.js"));
assert.ok(sharedUi.includes("./js/game1-rewards.js"));
assert.ok(sharedUi.indexOf("./js/game1-rewards.js") < sharedUi.indexOf("./game1-autosave.js"));
assert.ok(serviceWorker.includes('./js/game1-rewards.js'));
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

console.log('Game 1 rewards integration checks passed.');
