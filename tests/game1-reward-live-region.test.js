const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'game1-rewards.js'), 'utf8');

test('phần thưởng trong hộp thắng khai báo đầy đủ live region trước khi chèn', () => {
  assert.match(source, /summary\.setAttribute\('role', 'status'\);[\s\S]*?summary\.setAttribute\('aria-live', 'polite'\);[\s\S]*?summary\.setAttribute\('aria-atomic', 'true'\);[\s\S]*?dialog\.insertBefore\(summary,/);
});

test('thông báo phần thưởng dự phòng khai báo atomic trước khi thêm vào DOM', () => {
  assert.match(source, /status\.setAttribute\('role', 'status'\);[\s\S]*?status\.setAttribute\('aria-live', 'polite'\);[\s\S]*?status\.setAttribute\('aria-atomic', 'true'\);[\s\S]*?root\.document\.body\.appendChild\(status\);/);
});

test('cả hai vùng phần thưởng đều dùng aria-atomic true trực tiếp', () => {
  const matches = source.match(/setAttribute\('aria-atomic', 'true'\)/g) || [];
  assert.equal(matches.length, 2);
});