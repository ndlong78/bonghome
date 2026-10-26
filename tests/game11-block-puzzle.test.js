const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const content = JSON.parse(read('content/games/game11.json'));
const sw = read('sw.js');
const redirects = read('_redirects');

autoTest('nội dung Game 11 có schemaVersion và tetromino tách khỏi logic', () => {
  assert.equal(content.schemaVersion, 2);
  assert.equal(content.boardRows, 16);
  assert.equal(content.boardCols, 10);
  assert.equal(content.fallIntervalMs, 1430);
  assert.equal(content.shapes.length, 7);
  assert.ok(content.shapes.every((shape) => typeof shape.id === 'string' && Array.isArray(shape.cells) && shape.cells.length === 4));
  // Bàn dựng theo tệp nội dung này và Game 11 không tự ghi localStorage: e2e/game11-block-puzzle.spec.js.
});

// Khối rơi, bám chuột, bấm để quay, nút và phím điều khiển, dọn hàng ngang: e2e/game11-block-puzzle.spec.js,
// e2e/game11-rewards.spec.js. Khoá viewport mobile, 16 hàng bằng nhau, vùng chạm: e2e/game11-block-puzzle.spec.js.
// Bàn là grid nhận focus, nút có tên, hướng dẫn chuột chỉ hiện trên máy có chuột, không đếm ngược:
// e2e/page-structure.spec.js. Giảm chuyển động, focus ring: e2e/reduced-motion-all-pages.spec.js,
// e2e/focus-visible.spec.js. Ở đây chỉ còn hợp đồng precache và route.
autoTest('PWA precache và route có Game 11', () => {
  for (const asset of [
    './game11.html',
    './js/game11-blocks.js',
    './css/game11-blocks.css',
    './content/games/game11.json',
    './js/game11-home-card.js'
  ]) {
    assert.ok(sw.includes(`"${asset}"`), `Service Worker cần precache ${asset}`);
  }
  assert.match(redirects, /\/game11 \/game11\.html 301/);
  assert.match(redirects, /\/game11\/ \/game11\.html 301/);
});

function autoTest(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}
