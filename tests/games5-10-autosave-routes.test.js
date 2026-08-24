'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const routes = require(path.join(root, 'js', 'routes.js'));
const createCore = require(path.join(root, 'js', 'autosave-core.js'));
const core = createCore({ document: {} });

// Ba dạng URL phải được đối xử như nhau: có đuôi, không đuôi, và có dấu / ở cuối.
const shapes = (gameId) => [`/game${gameId}.html`, `/game${gameId}`, `/game${gameId}/`];

const RANGES = [
  { label: 'Game 2-4', min: 2, max: 4 },
  { label: 'Game 5-7', min: 5, max: 7 },
  { label: 'Game 8-10', min: 8, max: 10 }
];

// resolveGameId là hàm thuần trong khung chung: kiểm trực tiếp cả đường đi chính
// (có BongRoutes) lẫn đường dự phòng (chưa có BongRoutes).
for (const { label, min, max } of RANGES) {
  for (const [mode, sharedRoutes] of [['BongRoutes', routes], ['dự phòng', undefined]]) {
    for (let gameId = 1; gameId <= 10; gameId += 1) {
      const expected = gameId >= min && gameId <= max ? `game${gameId}` : null;
      for (const pathname of shapes(gameId)) {
        assert.equal(
          core.resolveGameId(pathname, sharedRoutes, min, max),
          expected,
          `${label} (${mode}) với ${pathname}`
        );
      }
    }

    for (const pathname of ['/', '/index.html', '/index', '/parents', '/collection.html', '/game11', '/game0', '']) {
      assert.equal(
        core.resolveGameId(pathname, sharedRoutes, min, max),
        null,
        `${label} (${mode}) không được chạy trên "${pathname}"`
      );
    }
  }
}

/**
 * Chạy thật module nhóm với một đường dẫn cho trước và cho biết nó có nhận ra
 * trang game hay không. Module chỉ gọi window.BongModulesReady.then() sau khi đã
 * vượt qua guard đường dẫn, nên đó là tín hiệu đáng tin cậy.
 */
function detectsGamePage(source, pathname, sharedRoutes) {
  let reached = false;
  const window = {
    location: { pathname },
    BongRoutes: sharedRoutes,
    BongAutosaveCore: core,
    addEventListener() {},
    BongModulesReady: {
      then() {
        reached = true;
        return { catch() {} };
      }
    }
  };
  vm.runInNewContext(source, {
    window,
    document: { getElementById: () => null, querySelectorAll: () => [], addEventListener() {}, body: { appendChild() {} } },
    console,
    setInterval: () => 0,
    clearInterval() {},
    setTimeout: () => 0,
    clearTimeout() {}
  });
  return reached;
}

const MODULES = [
  { file: 'js/games2-4-autosave.js', label: 'Game 2-4', own: [2, 3, 4] },
  { file: 'js/games5-7-autosave.js', label: 'Game 5-7', own: [5, 6, 7] },
  { file: 'js/games8-10-autosave.js', label: 'Game 8-10', own: [8, 9, 10] }
];

for (const { file, label, own } of MODULES) {
  const source = read(file);

  for (let gameId = 1; gameId <= 10; gameId += 1) {
    const expected = own.includes(gameId);
    for (const pathname of shapes(gameId)) {
      assert.equal(detectsGamePage(source, pathname, routes), expected, `${label} với ${pathname}`);
      assert.equal(detectsGamePage(source, pathname, undefined), expected, `${label} (dự phòng) với ${pathname}`);
    }
  }

  for (const pathname of ['/', '/index.html', '/parents', '/game11']) {
    assert.equal(detectsGamePage(source, pathname, routes), false, `${label} không được chạy trên ${pathname}`);
  }

  assert.equal(
    /window\.location\.pathname\.match/.test(source),
    false,
    `${label} không được tự nhận dạng đường dẫn nữa`
  );
}

// Bản dự phòng trong shared-ui.js quyết định việc nạp CSS/JS trước khi routes.js
// kịp tải, nên nó phải nhận cùng tập đường dẫn với BongRoutes.
const sharedUi = read('shared-ui.js');
const fallbackSource = sharedUi.match(/const FALLBACK_ROUTES = (Object\.freeze\(\{[\s\S]*?\n  \}\));/);
assert.ok(fallbackSource, 'Không tìm thấy FALLBACK_ROUTES trong shared-ui.js — hãy cập nhật test nếu file đã đổi cấu trúc');
const fallback = vm.runInNewContext(`(${fallbackSource[1]})`, {});

for (let gameId = 1; gameId <= 10; gameId += 1) {
  for (const pathname of shapes(gameId)) {
    assert.equal(fallback.isGame(gameId, pathname), true, `fallback.isGame(${gameId}) phải khớp ${pathname}`);
    assert.equal(fallback.isGameInRange(gameId, gameId, pathname), true, `fallback.isGameInRange phải khớp ${pathname}`);
    assert.equal(routes.getGameId(pathname), gameId, `BongRoutes phải khớp ${pathname}`);
  }
}

assert.equal(fallback.isGame(1, '/game10.html'), false, 'game1 không được khớp game10');
assert.equal(fallback.isGame(1, '/game10'), false, 'game1 không được khớp game10 không đuôi');
assert.equal(fallback.isGameInRange(2, 4, '/game5'), false);
assert.equal(fallback.isHome('/'), true);
assert.equal(fallback.isHome('/index'), true);
assert.equal(fallback.isHome('/index.html'), true);
assert.equal(fallback.isHome('/game1'), false);

assert.match(read('sw.js'), /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);
assert.ok(read('sw.js').includes('./js/autosave-core.js'), 'khung chung phải được cache offline');

console.log('Game 2-10 autosave route checks passed.');
