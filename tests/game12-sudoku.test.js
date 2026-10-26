const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const engine = require('../js/game12-sudoku.js');
const content = JSON.parse(read('content/games/game12.json'));
const html = read('game12.html');
const style = read('css/game12-sudoku.css');
const sw = read('sw.js');
const redirects = read('_redirects');

autoTest('nội dung Game 12 có 3 cỡ bàn hợp lệ, tách khỏi logic', () => {
  assert.equal(content.schemaVersion, 1);
  assert.deepEqual(content.levels.map((level) => level.size), [4, 6, 9]);
  for (const level of content.levels) {
    assert.equal(level.boxRows * level.boxCols, level.size, `${level.id}: box phải phủ đủ size`);
    assert.equal(level.symbols.length, level.size, `${level.id}: đủ ký hiệu`);
    assert.equal(new Set(level.symbols).size, level.size, `${level.id}: ký hiệu không trùng`);
    assert.ok(level.givens > 0 && level.givens < level.size * level.size);
  }
  assert.ok(content.levels.some((level) => level.id === content.defaultLevelId));
});

autoTest('engine sinh lời giải hợp lệ và đề có đúng 1 lời giải cho mọi cỡ bàn', () => {
  for (const level of content.levels) {
    for (const seed of [1, 42, 20261016]) {
      const { puzzle, solution, layout } = engine.generatePuzzle(level, seed);
      assert.equal(solution.length, level.size * level.size);
      assert.ok(engine.isSolved(solution, layout), `${level.id}/${seed}: lời giải phải hợp lệ`);
      assert.ok(puzzle.every((value, index) => !value || value === solution[index]), 'ô gợi ý khớp lời giải');
      assert.ok(puzzle.filter(Boolean).length >= level.givens, 'không ít hơn số ô gợi ý cấu hình');
      assert.equal(engine.countSolutions(puzzle, layout, 2), 1, `${level.id}/${seed}: đề phải có lời giải duy nhất`);
    }
  }
});

autoTest('engine tất định theo seed và phát hiện ô trùng', () => {
  const level = content.levels[1];
  assert.deepEqual(engine.generatePuzzle(level, 7).puzzle, engine.generatePuzzle(level, 7).puzzle);
  const layout = engine.createLayout(4, 2, 2);
  const grid = [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  assert.deepEqual([...engine.findConflicts(grid, layout)].sort(), [0, 1]);
  assert.equal(engine.isSolved(grid, layout), false);
  assert.throws(() => engine.createLayout(6, 2, 2), /không hợp lệ/);
});

autoTest('Game 12 có bàn grid, bảng chọn hình, công cụ và không gây áp lực thời gian', () => {
  assert.match(html, /css\/design-tokens\.css/);
  assert.match(html, /css\/game12-sudoku\.css/);
  assert.match(html, /js\/game12-sudoku\.js/);
  assert.match(html, /role="grid"/);
  assert.match(html, /tabindex="0"/);
  for (const id of ['sudokuBoard', 'sudokuPad', 'sudokuLevels', 'sudokuErase', 'sudokuHint', 'sudokuCheck', 'sudokuRestart', 'sudokuNew', 'sudokuStatus']) {
    assert.match(html, new RegExp(`id="${id}"`), `thiếu #${id}`);
  }
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /Không có đồng hồ đếm ngược/);
  assert.match(style, /--bh-touch-target/);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(style, /\.sudoku-row\s*\{\s*display:\s*contents;/);
});

autoTest('Game 12 có ghi chú bút chì cho bàn 9×9, cấu hình qua content', () => {
  const notesLevels = content.levels.filter((level) => level.notes === true).map((level) => level.id);
  assert.deepEqual(notesLevels, ['cay'], 'chỉ bàn 9×9 bật ghi chú');
  assert.match(html, /id="sudokuNotes"[^>]*aria-pressed="false"[^>]*hidden/);
  assert.match(html, /id="sudokuNotesTip"[^>]*hidden/);
  // Ghi, hiển thị, tự xoá ở ô liên quan, phím n, giữ sau reload: e2e/game12-sudoku.spec.js.
  assert.match(style, /\.sudoku-notes\s*\{/);
  assert.match(style, /\.sudoku-tool\[hidden\]\s*\{\s*display:\s*none;/);
});

autoTest('PWA precache, route và thẻ trang chủ có Game 12', () => {
  for (const asset of [
    './game12.html',
    './js/game12-sudoku.js',
    './css/game12-sudoku.css',
    './content/games/game12.json',
    './js/game12-home-card.js'
  ]) {
    assert.ok(sw.includes(`"${asset}"`), `Service Worker cần precache ${asset}`);
  }
  assert.match(redirects, /\/game12 \/game12\.html 301/);
  assert.match(redirects, /\/game12\/ \/game12\.html 301/);
  // Thẻ trang chủ được nạp: e2e/page-modules.spec.js.
});

function autoTest(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}
