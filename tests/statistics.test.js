const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const createStorage = require('../js/storage.js');
const createStatistics = require('../js/statistics.js');

const memoryStorage = (() => {
  const data = new Map();
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value))
  };
})();

const storage = createStorage(memoryStorage);
storage.migrate();
storage.set('progress', {
  schemaVersion: 1,
  games: {},
  completions: {
    one: { gameId: 'game1', completedAt: '2026-07-21T10:00:00.000Z', durationSeconds: 60, moves: 10 },
    two: { gameId: 'game1', completedAt: '2026-07-22T10:00:00.000Z', durationSeconds: 120, moves: 20 },
    old: { gameId: 'game1', completedAt: '2026-07-01T10:00:00.000Z', durationSeconds: 180, moves: 30 }
  }
});

const statistics = createStatistics(storage);
const summary = statistics.summarize(new Date('2026-07-23T12:00:00.000Z'));
assert.equal(summary.schemaVersion, 1);
assert.equal(summary.totalCompleted, 3);
assert.equal(summary.last7DaysCompleted, 2);
assert.equal(summary.latestCompletedAt, '2026-07-22T10:00:00.000Z');
assert.equal(summary.averageDurationSeconds, 120);
assert.equal(summary.averageMoves, 20);
assert.throws(() => statistics.summarize(new Date('invalid')), TypeError);

const html = read('parents.html');
const dashboard = read('js/parent-dashboard.js');
const css = read('css/parent-dashboard.css');
const serviceWorker = read('sw.js');
assert.match(html, /\.\/js\/statistics\.js/);
assert.match(html, /id="recentCount"/);
assert.match(html, /không tạo mục tiêu ngày hay áp lực/);
assert.match(dashboard, /BongStatisticsFactory/);
assert.match(dashboard, /averageDurationSeconds/);
assert.doesNotMatch(dashboard, /localStorage/);
assert.match(css, /\.bh-parent-insights/);
assert.match(css, /prefers-reduced-motion/);
assert.ok(serviceWorker.includes('./js/statistics.js'));
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

console.log('Local statistics checks passed.');