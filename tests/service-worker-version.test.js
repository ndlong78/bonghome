const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const testsDir = path.join(root, 'tests');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

assert.match(
  serviceWorker,
  /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/,
  'Service Worker phải khai báo cache version đúng định dạng'
);

const pinned = fs.readdirSync(testsDir)
  .filter((name) => name.endsWith('.test.js') && name !== path.basename(__filename))
  .filter((name) => /bonghome-v[0-9]+-[a-z0-9-]+/.test(fs.readFileSync(path.join(testsDir, name), 'utf8')));

assert.deepEqual(
  pinned,
  [],
  `Test không được khóa cứng cache version cũ: ${pinned.join(', ')}`
);

console.log('Service Worker version checks passed.');
