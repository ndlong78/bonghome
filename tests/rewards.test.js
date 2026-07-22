const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const createStorage = require('../js/storage.js');
const createRewards = require('../js/rewards.js');
const catalog = JSON.parse(read('content/rewards/catalog.json'));
const serviceWorker = read('sw.js');

const memoryStorage = (() => {
  const data = new Map();
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value))
  };
})();

const storage = createStorage(memoryStorage);
storage.migrate();
const rewards = createRewards(storage);
rewards.migrate();

assert.equal(rewards.schemaVersion, 1);
assert.equal(catalog.schemaVersion, 1);
assert.equal(new Set(catalog.stickers.map((item) => item.id)).size, catalog.stickers.length);
assert.equal(new Set(catalog.badges.map((item) => item.id)).size, catalog.badges.length);

let result = rewards.awardStars('game1-finish-001', 2, { gameId: 'game1' });
assert.equal(result.duplicate, false);
assert.equal(result.summary.stars, 2);
result = rewards.awardStars('game1-finish-001', 2);
assert.equal(result.duplicate, true);
assert.equal(result.summary.stars, 2, 'Transaction trùng không được cộng sao lần hai');

assert.equal(rewards.unlockSticker('happy-star').duplicate, false);
assert.equal(rewards.unlockSticker('happy-star').duplicate, true);
assert.equal(rewards.unlockBadge('first-finish').duplicate, false);
assert.deepEqual(rewards.getSummary().stickerIds, ['happy-star']);
assert.deepEqual(rewards.getSummary().badgeIds, ['first-finish']);

assert.throws(() => rewards.awardStars('../bad', 1), /kebab-case/);
assert.throws(() => rewards.awardStars('valid-id', 11), /1 to 10/);
assert.ok(serviceWorker.includes('./js/rewards.js'));
assert.ok(serviceWorker.includes('./content/rewards/catalog.json'));
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

console.log('Rewards foundation checks passed.');
