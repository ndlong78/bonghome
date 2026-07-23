const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

assert.match(sw, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);
assert.match(sw, /const TEN_CACHE = Object\.freeze\(/);
assert.match(sw, /shell: `\$\{PHIEN_BAN\}-shell`/);
assert.match(sw, /games: `\$\{PHIEN_BAN\}-games`/);
assert.match(sw, /content: `\$\{PHIEN_BAN\}-content`/);
assert.match(sw, /runtime: `\$\{PHIEN_BAN\}-runtime`/);

for (const group of ['TEP_SHELL', 'TEP_GAME', 'TEP_NOI_DUNG', 'NHOM_PRECACHE']) {
  assert.ok(sw.includes(`const ${group}`), `${group} must exist`);
}

for (let game = 1; game <= 10; game++) {
  assert.ok(sw.includes(`"./game${game}.html"`), `game${game}.html must be cached`);
}

for (const required of [
  './index.html',
  './parents.html',
  './manifest.json',
  './js/storage.js',
  './js/progress.js',
  './content/themes/index.json',
  './content/rewards/catalog.json'
]) {
  assert.ok(sw.includes(`"${required}"`), `${required} must remain precached`);
}

assert.match(sw, /NHOM_PRECACHE\.map\(\(group\) => luuNhom\(group\.cacheName, group\.urls\)\)/);
assert.match(sw, /const currentCaches = new Set\(Object\.values\(TEN_CACHE\)\)/);
assert.match(sw, /caches\.open\(TEN_CACHE\.runtime\)/);
assert.match(sw, /caches\.match\("\.\/index\.html"\)/);
assert.doesNotMatch(sw, /const DANH_SACH_LUU =/);

const quotedPaths = [...sw.matchAll(/"(\.\/[^"\n]+)"/g)].map((match) => match[1]);
const duplicates = quotedPaths.filter((item, index) => quotedPaths.indexOf(item) !== index);
assert.deepEqual([...new Set(duplicates)], ['./index.html'], 'only the navigation fallback may repeat a precache path');

console.log('Service Worker cache group checks passed.');
