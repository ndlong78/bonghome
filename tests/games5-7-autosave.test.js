'use strict';

/*
 * Hợp đồng cấu hình của nhóm Game 5-7: trang không còn script inline, nạp engine trước UI, tệp có offline.
 * Hành vi của adapter js/games5-7-autosave.js nằm ở tests/games-autosave-behavior.test.js.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const sharedUi = read('shared-ui.js');
const serviceWorker = read('sw.js');

for (const game of ['game5', 'game6', 'game7']) {
  const html = read(`${game}.html`);
  assert.equal(/<script>(?!\s*<\/script>)/.test(html), false, `${game}.html không còn script inline`);
  assert.deepEqual(
    [...html.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]),
    ['./shared-ui.js', `./js/${game}-engine.js`, `./js/${game}-ui.js`],
    `${game}.html nạp engine trước UI`
  );
  [`./js/${game}-engine.js`, `./js/${game}-ui.js`].forEach((file) => assert.ok(serviceWorker.includes(`"${file}"`), `${file} phải có offline`));
}

// shared-ui.js nạp adapter cho đúng nhóm trang (chuyển sang test hành vi khi tách lớp nạp của shared-ui.js).
assert.match(sharedUi, /isGames5To7/);
assert.match(sharedUi, /\.\/js\/games5-7-autosave\.js/);
assert.match(sharedUi, /loadGames5To7Autosave\(\)/);
assert.match(sharedUi, /isGames2To4\(\) \|\| isGames5To7\(\)/);

['./js/routes.js', './js/games5-7-autosave.js', './css/games-autosave.css'].forEach((asset) => {
  assert.ok(serviceWorker.includes(asset), `${asset} phải có offline`);
});
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

console.log('Game 5-7 autosave contract checks passed.');
