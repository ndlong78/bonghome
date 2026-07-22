const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const registry = JSON.parse(read('content/themes/index.json'));
const school = JSON.parse(read('content/themes/school/game1.json'));
const loader = require('../js/game1-content.js');
const serviceWorker = read('sw.js');

const theme = registry.themes.find((item) => item.id === 'school');
assert.ok(theme && theme.available, 'Theme school phải có trong registry và available');
assert.equal(theme.name, 'Ngôi trường của Bông');
assert.equal(theme.icon, '🎒');

const valid = loader.validateContent(school);
assert.ok(valid, 'Nội dung Game 1 chủ đề Trường học phải hợp lệ');
assert.equal(valid.schemaVersion, 1);
assert.equal(valid.gameId, 'game1');
assert.equal(valid.themeId, 'school');
assert.equal(valid.cards.length, 12);
assert.equal(new Set(valid.cards.map((card) => card.id)).size, 12);
assert.ok(valid.cards.every((card) => card.name.trim() && card.svg.startsWith('<svg')));
assert.deepEqual(valid.difficulties.map((level) => level.pairs), [3, 6, 12]);

assert.equal(loader.resolveContentUrl('school'), './content/themes/school/game1.json');
assert.ok(serviceWorker.includes('./content/themes/school/game1.json'));
assert.match(serviceWorker, /bonghome-v20-school-theme/);

console.log('School theme checks passed.');