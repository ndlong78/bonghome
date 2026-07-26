const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'games8-10-rewards.js'), 'utf8');

test('phần thưởng trong hộp hoàn thành khai báo live region đầy đủ trước khi chèn', () => {
  assert.match(source, /summary\.setAttribute\('role', 'status'\);[\s\S]*?summary\.setAttribute\('aria-live', 'polite'\);[\s\S]*?summary\.setAttribute\('aria-atomic', 'true'\);[\s\S]*?dialog\.insertBefore\(summary,/);
});

test('thông báo phần thưởng dự phòng khai báo live region đầy đủ trước khi chèn', () => {
  assert.match(source, /status\.setAttribute\('role', 'status'\);[\s\S]*?status\.setAttribute\('aria-live', 'polite'\);[\s\S]*?status\.setAttribute\('aria-atomic', 'true'\);[\s\S]*?root\.document\.body\.appendChild\(status\)/);
});
