const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const autosave = require(path.join(root, 'game1-autosave.js'));
const sharedUi = fs.readFileSync(path.join(root, 'shared-ui.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/game1-autosave.css'), 'utf8');
const autosaveSource = fs.readFileSync(path.join(root, 'game1-autosave.js'), 'utf8');

const validSnapshot = {
  version: 1,
  difficulty: 3,
  deck: [0, 1, 2, 0, 1, 2],
  matchedIndices: [0, 3],
  openIndices: [1],
  moves: 2,
  seconds: 15,
  started: true,
  locked: false
};

const mediumSnapshot = {
  version: 1,
  difficulty: 6,
  deck: [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5],
  matchedIndices: [],
  openIndices: [2],
  moves: 0,
  seconds: 4,
  started: true,
  locked: false
};

assert.deepEqual(autosave.validateSnapshot(validSnapshot), validSnapshot);
assert.equal(autosave.validateSnapshot({ ...validSnapshot, deck: [0, 0, 1] }), null);
assert.equal(autosave.validateSnapshot({ ...validSnapshot, matchedIndices: [0] }), null);
assert.equal(autosave.validateSnapshot({ ...validSnapshot, openIndices: [0] }), null);
assert.equal(autosave.validateSnapshot({ ...validSnapshot, difficulty: 5 }), null);
assert.equal(autosave.makeTransactionId('2026-07-22T00:00:00.000Z', 3), 'game1:3:2026-07-22T00:00:00.000Z');
assert.equal(autosave.makeTransactionId(null, 6), 'game1:6:unknown');

const bundle = autosave.validateBundle({
  bundleVersion: 1,
  activeDifficulty: 6,
  snapshots: {
    3: { snapshot: validSnapshot, startedAt: '2026-07-22T00:00:00.000Z' },
    6: { snapshot: mediumSnapshot, startedAt: '2026-07-22T00:01:00.000Z' }
  }
});
assert.equal(bundle.activeDifficulty, 6);
assert.deepEqual(bundle.snapshots['3'].snapshot, validSnapshot);
assert.deepEqual(bundle.snapshots['6'].snapshot, mediumSnapshot);
assert.equal(Object.keys(bundle.snapshots).length, 2, '6 → 12 lá không được ghi đè snapshot 6 lá');

const migratedLegacy = autosave.validateBundle(validSnapshot, '2026-07-22T00:00:00.000Z');
assert.equal(migratedLegacy.activeDifficulty, 3);
assert.deepEqual(migratedLegacy.snapshots['3'].snapshot, validSnapshot);
assert.equal(migratedLegacy.snapshots['3'].startedAt, '2026-07-22T00:00:00.000Z');

assert.match(autosaveSource, /addEventListener\('click',[\s\S]*true\);/);
assert.match(autosaveSource, /restoreDifficulty\(targetDifficulty/);
assert.doesNotMatch(autosaveSource, /#nutChoiLai, #mucDo button/);
assert.match(sharedUi, /game1-autosave\.js/);
assert.match(sharedUi, /game1-autosave\.css/);
assert.match(sharedUi, /game1-theme-progress\.js/);
assert.match(sharedUi, /window\.BongProgress = window\.BongGame1Progress/);
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);
assert.ok(serviceWorker.includes('./game1-autosave.js'));
assert.ok(serviceWorker.includes('./css/game1-autosave.css'));
assert.match(css, /min-height:var\(--bh-touch-target,44px\)/);
assert.match(css, /prefers-reduced-motion/);

console.log('Game 1 autosave checks passed.');
