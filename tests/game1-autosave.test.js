const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const autosave = require(path.join(root, 'game1-autosave.js'));
const sharedUi = fs.readFileSync(path.join(root, 'shared-ui.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/game1-autosave.css'), 'utf8');

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

assert.deepEqual(autosave.validateSnapshot(validSnapshot), validSnapshot);
assert.equal(autosave.validateSnapshot({ ...validSnapshot, deck: [0, 0, 1] }), null);
assert.equal(autosave.validateSnapshot({ ...validSnapshot, matchedIndices: [0] }), null);
assert.equal(autosave.validateSnapshot({ ...validSnapshot, openIndices: [0] }), null);
assert.equal(autosave.validateSnapshot({ ...validSnapshot, difficulty: 5 }), null);
assert.equal(autosave.makeTransactionId('2026-07-22T00:00:00.000Z', 3), 'game1:3:2026-07-22T00:00:00.000Z');
assert.equal(autosave.makeTransactionId(null, 6), 'game1:6:unknown');

assert.match(sharedUi, /game1-autosave\.js/);
assert.match(sharedUi, /game1-autosave\.css/);
assert.match(sharedUi, /Promise\.all\(\[window\.BongModulesReady, loadGame1Difficulty\(\)\]\)/);
assert.match(serviceWorker, /bonghome-v12-game1-autosave/);
assert.ok(serviceWorker.includes('./game1-autosave.js'));
assert.ok(serviceWorker.includes('./css/game1-autosave.css'));
assert.match(css, /min-height:var\(--bh-touch-target,44px\)/);
assert.match(css, /prefers-reduced-motion/);

console.log('Game 1 autosave checks passed.');
