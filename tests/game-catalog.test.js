const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const catalog = JSON.parse(read('content/games/index.json'));
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
const expectedIds = [...expectedTitles.map((_, index) => `game${index + 1}`), 'game11', 'game12', 'game13'];
assert.equal(catalog.games.length, 13);
assert.deepEqual(catalog.games.map((game) => game.id), expectedIds);
assert.deepEqual(catalog.games.map((game) => game.title), [...expectedTitles, 'Xếp Khối Thông Minh', 'Sudoku Vui Vẻ', 'Cờ Ca-rô Tí Hon']);
assert.deepEqual(
  catalog.games.filter((game) => game.rewardsEnabled).map((game) => game.id),
  expectedIds
);
// Trang phụ huynh lấy tên trò, sticker và huy hiệu từ catalog này: e2e/parent-dashboard.spec.js.
assert.ok(parents.includes('./js/game-catalog.js'));
assert.ok(serviceWorker.includes('./js/game-catalog.js'));
assert.ok(serviceWorker.includes('./content/games/index.json'));
assert.ok(serviceWorker.includes('./content/rewards/catalog.json'));

console.log('Shared game and reward catalog checks passed.');
