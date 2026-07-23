const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const faviconPath = path.join(root, 'favicon.ico');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

assert.ok(fs.existsSync(faviconPath), 'favicon.ico must exist at the site root');
const header = fs.readFileSync(faviconPath).subarray(0, 4);
assert.deepEqual([...header], [0, 0, 1, 0], 'favicon.ico must be a valid ICO file');
assert.ok(serviceWorker.includes('./favicon.ico'), 'favicon.ico must be cached for offline use');
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

console.log('Root favicon checks passed.');
