'use strict';

/*
 * Hợp đồng cấu hình của nhóm Game 2-4: trang không còn script inline, nạp engine trước UI, tệp có offline.
 * Việc nạp đúng trang và đúng thứ tự: e2e/page-modules.spec.js. Hành vi của adapter js/games2-4-autosave.js nằm ở tests/games-autosave-behavior.test.js.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const serviceWorker = read('sw.js');

for (const game of ['game2', 'game3', 'game4']) {
  const html = read(`${game}.html`);
  assert.equal(/<script>(?!\s*<\/script>)/.test(html), false, `${game}.html không còn script inline`);
  assert.deepEqual(
    [...html.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]),
    ['./shared-ui.js', `./js/${game}-engine.js`, `./js/${game}-ui.js`],
    `${game}.html nạp engine trước UI`
  );
  [`./js/${game}-engine.js`, `./js/${game}-ui.js`].forEach((file) => assert.ok(serviceWorker.includes(`"${file}"`), `${file} phải có offline`));
}


const css = read('css/games-autosave.css');
assert.match(css, /bh-game-autosave-status/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /safe-area-inset/);

['./js/routes.js', './js/games2-4-autosave.js', './css/games-autosave.css'].forEach((asset) => {
  assert.ok(serviceWorker.includes(asset), `${asset} phải có offline`);
});
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

console.log('Game 2-4 autosave contract checks passed.');
