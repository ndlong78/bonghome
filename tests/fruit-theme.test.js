const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const registry = JSON.parse(read('content/themes/index.json'));
const fruits = JSON.parse(read('content/themes/fruits/game1.json'));
const loader = require('../js/game1-content.js');
const serviceWorker = read('sw.js');

const fruitTheme = registry.themes.find((theme) => theme.id === 'fruits');
assert.ok(fruitTheme && fruitTheme.available, 'Fruit theme must be available');
assert.equal(fruitTheme.name, 'Vườn trái cây');
assert.equal(fruitTheme.icon, '🍎');
assert.ok(fruitTheme.tokens.primary);
assert.ok(fruitTheme.tokens.primaryStrong);

const valid = loader.validateContent(fruits);
assert.ok(valid, 'Fruit Game 1 content must be valid');
assert.equal(valid.themeId, 'fruits');
assert.equal(valid.cards.length, 12);
assert.equal(new Set(valid.cards.map((card) => card.id)).size, 12);
assert.deepEqual(valid.difficulties.map((level) => level.pairs), [3, 6, 12]);
assert.ok(valid.cards.every((card) => card.svg.startsWith('<svg')));
assert.equal(loader.resolveContentUrl('fruits'), './content/themes/fruits/game1.json');

assert.ok(serviceWorker.includes('./content/themes/fruits/game1.json'));
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

console.log('Fruit theme checks passed.');
