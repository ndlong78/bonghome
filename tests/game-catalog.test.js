const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const catalog = JSON.parse(read('content/games/index.json'));
const loader = read('js/game-catalog.js');
const dashboard = read('js/parent-dashboard.js');
const parents = read('parents.html');
const serviceWorker = read('sw.js');

const expectedTitles = [
  'Lật Hình Tìm Cặp',
  'Tìm Điểm Khác Biệt',
  'Tìm Bóng Cho Hình',
  'Gom Đồ Theo Màu',
  'Nối Điểm Theo Số',
  'Tìm Cặp Sinh Đôi',
  'Đoán Hình Tiếp Theo',
  'Mê Cung Về Nhà',
  'Nghe Truyện Tìm Từ',
  'Gõ Phím Theo Nhịp'
];

assert.equal(catalog.schemaVersion, 1);
assert.equal(catalog.games.length, 10);
assert.deepEqual(catalog.games.map((game) => game.id), expectedTitles.map((_, index) => `game${index + 1}`));
assert.deepEqual(catalog.games.map((game) => game.title), expectedTitles);
assert.ok(loader.includes("fetch('./content/games/index.json')"));
assert.ok(loader.includes('window.BongGameCatalog'));
assert.ok(dashboard.includes('catalog?.getTitle?.(gameId)'));
assert.ok(parents.includes('./js/game-catalog.js'));
assert.ok(serviceWorker.includes('./js/game-catalog.js'));
assert.ok(serviceWorker.includes('./content/games/index.json'));

console.log('Shared game catalog checks passed.');
