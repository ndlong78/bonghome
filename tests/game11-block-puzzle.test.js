const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const content = JSON.parse(read('content/games/game11.json'));
const html = read('game11.html');
const script = read('js/game11-blocks.js');
const style = read('css/game11-blocks.css');
const sw = read('sw.js');
const redirects = read('_redirects');

autoTest('nội dung Game 11 có schemaVersion và tetromino tách khỏi logic', () => {
  assert.equal(content.schemaVersion, 2);
  assert.equal(content.boardRows, 16);
  assert.equal(content.boardCols, 10);
  assert.equal(content.fallIntervalMs, 1430);
  assert.equal(content.shapes.length, 7);
  assert.ok(content.shapes.every((shape) => typeof shape.id === 'string' && Array.isArray(shape.cells) && shape.cells.length === 4));
  assert.match(script, /content\/games\/game11\.json/);
  assert.doesNotMatch(script, /localStorage\.(?:setItem|removeItem)/);
});

autoTest('Game 11 có khối rơi, bám chuột ngang, quay bằng click và điều khiển dự phòng', () => {
  assert.match(html, /css\/design-tokens\.css/);
  assert.match(html, /id="blockLeft"/);
  assert.match(html, /id="blockRotate"/);
  assert.match(html, /id="blockRight"/);
  assert.match(html, /id="blockDrop"/);
  assert.match(html, /Rê chuột trái\/phải/);
  assert.match(html, /Click\/chạm: quay khối/);
  assert.match(html, /role="grid"/);
  assert.match(html, /tabindex="0"/);
  assert.match(script, /setInterval\(stepDown/);
  assert.match(script, /moveActiveToCol/);
  assert.match(script, /pointerTargetCol/);
  assert.match(script, /onBoardPointerMove/);
  assert.match(script, /addEventListener\('pointermove', onBoardPointerMove\)/);
  assert.match(script, /rotateActive/);
  assert.match(script, /onBoardClick/);
  assert.match(script, /addEventListener\('click', onBoardClick\)/);
  assert.match(script, /moveActive/);
  assert.match(script, /hardDrop/);
  assert.match(script, /ArrowLeft/);
  assert.match(script, /ArrowRight/);
  assert.match(script, /ArrowUp/);
  assert.match(script, /ArrowDown/);
  assert.match(style, /cursor:\s*ew-resize/);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(style, /--bh-touch-target/);
});

autoTest('Game 11 chỉ dọn hàng ngang và không thêm cơ chế gây áp lực', () => {
  assert.match(script, /completedRows/);
  assert.doesNotMatch(script, /completedCols|streak|countdown/i);
  assert.match(html, /không có đồng hồ đếm ngược/i);
});

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
