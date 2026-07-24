'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'game2.html'), 'utf8');

function readHitRadii(html) {
  const start = html.indexOf('const VAT_THE = [');
  const end = html.indexOf('const SO_DIEM_KHAC', start);
  assert.notEqual(start, -1, 'Game 2 cần khai báo VAT_THE');
  assert.notEqual(end, -1, 'Game 2 cần kết thúc kho vật thể trước SO_DIEM_KHAC');
  const objectSource = html.slice(start, end);
  return [...objectSource.matchAll(/\br\s*:\s*(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]));
}

test('Game 2 keeps every configured difference hit area at least 44 viewBox units wide', () => {
  const radii = readHitRadii(source);
  assert.ok(radii.length >= 5, 'Game 2 cần có đủ vùng chạm được cấu hình');
  radii.forEach((radius) => {
    assert.ok(Number.isFinite(radius) && radius > 0, `Bán kính vùng chạm không hợp lệ: ${radius}`);
    assert.ok(radius * 2 >= 44, `Vùng chạm đường kính ${radius * 2} nhỏ hơn 44 đơn vị`);
  });
});

test('Game 2 picture SVGs keep a stable 300 by 300 coordinate system', () => {
  assert.match(source, /id="tranhA"[^>]+viewBox="0 0 300 300"/);
  assert.match(source, /id="tranhB"[^>]+viewBox="0 0 300 300"/);
  assert.match(source, /\.tranh svg\{[^}]*width:100%/s);
});
