const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'games5-7-autosave.js'), 'utf8');

test('thông báo auto-save Game 5-7 khai báo live region đầy đủ trước khi chèn', () => {
  assert.match(source, /status\.setAttribute\('role', 'status'\);[\s\S]*?status\.setAttribute\('aria-live', 'polite'\);[\s\S]*?status\.setAttribute\('aria-atomic', 'true'\);[\s\S]*?document\.body\.appendChild\(status\)/);
});
