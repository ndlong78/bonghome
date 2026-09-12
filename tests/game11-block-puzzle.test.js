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

autoTest('nội dung Game 11 có schemaVersion và dữ liệu hình khối tách khỏi logic', () => {
  assert.equal(content.schemaVersion, 1);
  assert.equal(content.boardSize, 10);
  assert.ok(content.shapes.length >= 6);
  assert.ok(content.shapes.every((shape) => typeof shape.id === 'string' && Array.isArray(shape.cells) && shape.cells.length));
  assert.match(script, /content\/games\/game11\.json/);
  assert.doesNotMatch(script, /localStorage\.(?:setItem|removeItem)/);
});

autoTest('Game 11 dùng shared design tokens, có giảm chuyển động và điều khiển bàn phím', () => {
  assert.match(html, /css\/design-tokens\.css/);
  assert.match(html, /role="grid"/);
  assert.match(html, /tabindex="0"/);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(style, /--bh-touch-target/);
  assert.match(script, /ArrowUp/);
  assert.match(script, /ArrowDown/);
  assert.match(script, /Enter/);
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
