const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const content = JSON.parse(read('content/games/game1.json'));
const loader = require('../js/game1-content.js');
const sharedUi = read('shared-ui.js');
const serviceWorker = read('sw.js');
const difficulty = read('game1-difficulty.js');

const valid = loader.validateContent(content);
assert.ok(valid, 'Game 1 content must be valid');
assert.equal(valid.schemaVersion, 1);
assert.equal(valid.gameId, 'game1');
assert.deepEqual(valid.difficulties.map((level) => level.pairs), [3, 6, 12]);
assert.equal(valid.cards.length, 12);
assert.equal(new Set(valid.cards.map((card) => card.id)).size, 12);
assert.ok(valid.cards.every((card) => card.svg.startsWith('<svg')));

assert.equal(loader.validateContent({ ...content, cards: content.cards.slice(0, 11) }), null);
assert.equal(loader.validateContent({ ...content, schemaVersion: 2 }), null);
assert.equal(loader.validateContent({ ...content, difficulties: [{ pairs: 3, label: 'x', ariaLabel: 'x' }] }), null);

assert.ok(sharedUi.includes("./js/game1-content.js"));
assert.ok(sharedUi.includes('loadGame1Content().then(() => loadGame1Difficulty())'));
assert.ok(serviceWorker.includes('./content/games/game1.json'));
assert.ok(serviceWorker.includes('./js/game1-content.js'));
assert.match(serviceWorker, /bonghome-v13-game1-content/);
assert.ok(!difficulty.includes('HINH_BO_SUNG'));
assert.ok(difficulty.includes('window.BongGame1Content'));

console.log('Game 1 content checks passed.');
