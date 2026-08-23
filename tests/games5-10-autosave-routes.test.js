'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const routes = require(path.join(root, 'js', 'routes.js'));

/**
 * Chạy thật module autosave với một đường dẫn cho trước và cho biết nó có nhận
 * ra trang game hay không. Module chỉ gọi window.BongModulesReady.then() sau khi
 * đã vượt qua guard đường dẫn, nên đó là tín hiệu đáng tin cậy.
 *
 * `sharedRoutes` cho phép mô phỏng cả hai tình huống: js/routes.js đã tải xong
 * (dùng BongRoutes) và chưa tải xong (rơi về regex dự phòng).
 */
function detectsGamePage(source, pathname, sharedRoutes) {
  let reached = false;
  const window = {
    location: { pathname },
    BongRoutes: sharedRoutes,
    addEventListener() {},
    BongModulesReady: {
      then() {
        reached = true;
        return { catch() {} };
      }
    }
  };
  const document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    createElement: () => ({ setAttribute() {}, appendChild() {}, classList: { contains: () => false } }),
    body: { appendChild() {} }
  };

  vm.runInNewContext(source, {
    window,
    document,
    console,
    setInterval: () => 0,
    clearInterval() {},
    setTimeout: () => 0,
    clearTimeout() {},
    MutationObserver: class { observe() {} }
  });

  return reached;
}

const MODULES = [
  { file: 'js/games5-7-autosave.js', label: 'Game 5-7', own: [5, 6, 7], foreign: [1, 2, 3, 4, 8, 9, 10] },
  { file: 'js/games8-10-autosave.js', label: 'Game 8-10', own: [8, 9, 10], foreign: [1, 2, 3, 4, 5, 6, 7] }
];

// Ba dạng URL phải được đối xử như nhau: có đuôi, không đuôi, và có dấu / ở cuối.
const shapes = (gameId) => [`/game${gameId}.html`, `/game${gameId}`, `/game${gameId}/`];

for (const { file, label, own, foreign } of MODULES) {
  const source = read(file);

  // Có BongRoutes (đường đi chính) và không có BongRoutes (đường dự phòng).
  for (const [mode, sharedRoutes] of [['BongRoutes', routes], ['dự phòng', undefined]]) {
    for (const gameId of own) {
      for (const pathname of shapes(gameId)) {
        assert.equal(
          detectsGamePage(source, pathname, sharedRoutes),
          true,
          `${label} (${mode}) phải nhận ra ${pathname}`
        );
      }
    }

    for (const gameId of foreign) {
      for (const pathname of shapes(gameId)) {
        assert.equal(
          detectsGamePage(source, pathname, sharedRoutes),
          false,
          `${label} (${mode}) không được nhận nhầm ${pathname}`
        );
      }
    }

    for (const pathname of ['/', '/index.html', '/index', '/parents', '/collection.html', '/game11', '/game0']) {
      assert.equal(
        detectsGamePage(source, pathname, sharedRoutes),
        false,
        `${label} (${mode}) không được chạy trên ${pathname}`
      );
    }
  }

  assert.ok(
    source.includes('const sharedGameId = routes?.getGameId?.(path);'),
    `${label} phải dùng API đường dẫn dùng chung`
  );
  assert.equal(
    /window\.location\.pathname\.match\(\/\\\/\(game[^)]*\)\\\.html\$\//.test(source),
    false,
    `${label} không được giữ lại phép kiểm tra chỉ chấp nhận .html`
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
    assert.equal(
      fallback.isGameInRange(gameId, gameId, pathname),
      true,
      `fallback.isGameInRange phải khớp ${pathname}`
    );
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

console.log('Game 5-10 autosave route checks passed.');
