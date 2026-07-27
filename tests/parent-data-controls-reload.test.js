const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'e2e', 'parent-data-controls.spec.js'), 'utf8');

assert.match(source, /waitForEvent\('framenavigated'/, 'E2E phải chờ điều hướng thật sau khi xác nhận xóa');
assert.match(source, /window\.BongModulesReady/, 'E2E phải chờ shared modules hoàn tất sau reload');
assert.doesNotMatch(
  source,
  /Promise\.all\(\[\s*page\.waitForLoadState\('domcontentloaded'\),\s*page\.locator\('#parentDataConfirm'\)\.click\(\)/,
  'Không được dùng load state hiện tại để thay cho chờ reload tương lai'
);

console.log('✓ Parent data reload timing contract passed');
