const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const createRewards = require('../js/rewards.js');
const dashboard = read('js/parent-dashboard.js');
const css = read('css/parent-dashboard.css');
const serviceWorker = read('sw.js');

let state = {};
const storage = {
  get(key, fallback) { return state[key] == null ? fallback : JSON.parse(JSON.stringify(state[key])); },
  set(key, value) { state[key] = JSON.parse(JSON.stringify(value)); return value; }
};
const rewards = createRewards(storage);

assert.equal(rewards.schemaVersion, 1, 'read-only summary must not change schema version');
rewards.awardStars('game2-reward-one', 2, { gameId: 'game2' });
rewards.awardStars('game2-reward-two', 2, { gameId: 'game2' });
rewards.awardStars('game3-reward-one', 2, { gameId: 'game3' });
rewards.unlockSticker('little-flower', { source: 'game2-completion' });
rewards.unlockSticker('rainbow-friend', { source: 'game3-completion' });
rewards.unlockBadge('first-finish', { source: 'game1-completion' });
rewards.unlockBadge('curious-learner', { source: 'games2-4-complete' });

const byGame = rewards.getByGameSummary();
assert.equal(byGame.game2.stars, 4);
assert.deepEqual(byGame.game2.stickerIds, ['little-flower']);
assert.equal(byGame.game3.stars, 2);
assert.deepEqual(byGame.game3.stickerIds, ['rainbow-friend']);
assert.deepEqual(byGame.game1.badgeIds, ['first-finish']);
assert.ok(!Object.values(byGame).some((item) => item.badgeIds.includes('curious-learner')), 'group badge must not be assigned to one game');

[
  'function formatProgress(count, isInProgress)',
  'function formatRewardSummary(gameId, reward, catalog)',
  'getByGameSummary',
  'lượt hoàn thành · đang chơi dở',
  '⭐ ${reward.stars} sao',
  '🎁 Phần thưởng chưa áp dụng',
  '🎁 Chưa ghi nhận phần thưởng',
  'bh-parent-game-rewards'
].forEach((snippet) => assert.ok(dashboard.includes(snippet), `dashboard must include: ${snippet}`));

assert.ok(css.includes('.bh-parent-game-main'));
assert.ok(css.includes('.bh-parent-game-progress'));
assert.ok(css.includes('.bh-parent-game-rewards'));
assert.ok(serviceWorker.includes('./js/rewards.js'));
assert.ok(serviceWorker.includes('./js/parent-dashboard.js'));
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

console.log('Parent per-game reward summary checks passed.');
