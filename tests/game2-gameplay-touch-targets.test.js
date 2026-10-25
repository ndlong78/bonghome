'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'game2.html'), 'utf8');

// Vùng chạm của các vật nằm trong engine (js/game2-engine.js), đọc thẳng dữ liệu thay vì so chuỗi mã nguồn.
const engine = require(path.join(root, 'js', 'game2-engine.js'));

test('Game 2 keeps every configured difference hit area at least 44 viewBox units wide', () => {
  assert.equal(engine.OBJECTS.length, 10, 'Game 2 cần đủ 10 vật có vùng chạm');
  engine.OBJECTS.forEach(({ id, x, y, r }) => {
    assert.ok(Number.isFinite(r) && r > 0, `${id}: bán kính vùng chạm không hợp lệ`);
    assert.ok(r * 2 >= 44, `${id}: vùng chạm đường kính ${r * 2} nhỏ hơn 44 đơn vị`);
    assert.ok(x >= 0 && x <= 300 && y >= 0 && y <= 300, `${id}: tâm nằm ngoài tranh 300x300`);
  });
});

test('Game 2 picture SVGs keep a stable 300 by 300 coordinate system', () => {
  assert.match(source, /id="tranhA"[^>]+viewBox="0 0 300 300"/);
  assert.match(source, /id="tranhB"[^>]+viewBox="0 0 300 300"/);
  assert.match(source, /\.tranh svg\{[^}]*width:100%/s);
});
