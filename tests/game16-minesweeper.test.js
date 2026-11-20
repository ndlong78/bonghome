const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const engine = require('../js/game16-minesweeper.js');
const content = JSON.parse(read('content/games/game16.json'));
const sw = read('sw.js');
const redirects = read('_redirects');

const { HIDDEN, OPEN, FLAG } = engine;
const levelOf = (id) => content.levels.find((level) => level.id === id);

/** Bàn cố định để test: rải tổ ong đúng các ô cho trước (bỏ qua bước rải ngẫu nhiên lúc mở ô đầu). */
function fixedGame(level, mines) {
  const game = engine.createGame(level, 1);
  const { rows, cols } = game.level;
  const mineSet = new Set(mines);
  game.mines = [...mineSet].sort((a, b) => a - b);
  game.counts = Array.from({ length: rows * cols }, (_, index) => (mineSet.has(index)
    ? -1
    : engine.neighbors(index, rows, cols).filter((other) => mineSet.has(other)).length));
  game.status = 'playing';
  return game;
}

/**
 * Bot chơi như một bé biết suy luận: chỉ dùng hai luật cơ bản (số = số cờ quanh đó → mở hết; số = số ô chưa mở
 * quanh đó → cắm cờ hết). Kẹt thì đoán ngẫu nhiên. Trả về kết quả ván.
 */
function playWithLogic(level, seed) {
  const game = engine.createGame(level, seed);
  const { rows, cols } = game.level;
  const rng = engine.createRng(seed * 31 + 7);
  engine.reveal(game, Math.floor(rows / 2) * cols + Math.floor(cols / 2));
  let guesses = 0;
  while (game.status === 'playing') {
    let progress = false;
    for (let index = 0; index < game.cells.length; index += 1) {
      if (game.cells[index] !== OPEN || game.counts[index] <= 0) continue;
      const around = engine.neighbors(index, rows, cols);
      const hidden = around.filter((other) => game.cells[other] === HIDDEN);
      const flags = around.filter((other) => game.cells[other] === FLAG).length;
      if (!hidden.length) continue;
      if (flags === game.counts[index]) {
        engine.reveal(game, index);
        progress = true;
      } else if (flags + hidden.length === game.counts[index]) {
        hidden.forEach((other) => engine.toggleFlag(game, other));
        progress = true;
      }
      if (game.status !== 'playing') break;
    }
    if (!progress && game.status === 'playing') {
      const hidden = game.cells.map((value, index) => (value === HIDDEN ? index : -1)).filter((index) => index >= 0);
      guesses += 1;
      engine.reveal(game, hidden[Math.floor(rng() * hidden.length)]);
    }
  }
  return { status: game.status, guesses, rescuesUsed: game.rescuesUsed };
}

autoTest('nội dung Game 16: 3 cấp, bàn và số tổ ong tăng dần, cấp Dễ có Gấu Bông cứu', () => {
  assert.equal(content.schemaVersion, 1);
  assert.deepEqual(content.levels.map((level) => level.id), ['de', 'vua', 'kho']);
  assert.ok(content.levels.some((level) => level.id === content.defaultLevelId));
  const sizes = content.levels.map((level) => level.rows * level.cols);
  const density = content.levels.map((level) => level.mines / (level.rows * level.cols));
  assert.deepEqual([...sizes].sort((a, b) => a - b), sizes, 'bàn lớn dần');
  assert.deepEqual([...density].sort((a, b) => a - b), density, 'tổ ong dày dần');
  for (const level of content.levels) assert.deepEqual(engine.normalizeLevel(level), {
    id: level.id, rows: level.rows, cols: level.cols, mines: level.mines, rescues: level.rescues, hints: level.hints
  }, `${level.id} hợp lệ`);
  assert.equal(levelOf('de').rescues, 1);
  assert.equal(levelOf('kho').rescues, 0);
});

autoTest('normalizeLevel chặn cấu hình vô lý', () => {
  assert.deepEqual(engine.normalizeLevel({ id: 'x', rows: 99, cols: 3, mines: 500 }), { id: 'x', rows: 8, cols: 8, mines: 55, rescues: 0, hints: 0 });
  assert.equal(engine.normalizeLevel({ rows: 5, cols: 5, mines: 17 }).mines, 16, 'còn ít nhất 9 ô an toàn');
  assert.equal(engine.normalizeLevel({ rows: 8, cols: 8 }).mines, 8, 'thiếu số tổ ong: mật độ mặc định');
});

autoTest('ô đầu tiên luôn an toàn: không có tổ ong trong 3×3 quanh ô đầu, đủ số tổ ong, mở ra một vùng', () => {
  for (const level of content.levels) {
    for (let seed = 1; seed <= 60; seed += 1) {
      const game = engine.createGame(level, seed);
      const { rows, cols, mines } = game.level;
      const first = (seed * 7) % (rows * cols);
      const result = engine.reveal(game, first);
      assert.notEqual(result.event, 'lost');
      assert.equal(game.mines.length, mines);
      for (const index of [first, ...engine.neighbors(first, rows, cols)]) assert.notEqual(game.counts[index], -1);
      assert.equal(game.counts[first], 0, 'ô đầu là ô 0 nên mở lan');
      assert.ok(result.opened.length >= 4, `${level.id}#${seed}: mở ra nhiều ô`);
    }
  }
});

autoTest('rải tổ ong tất định theo seed', () => {
  const a = engine.createGame(levelOf('vua'), 42);
  const b = engine.createGame(levelOf('vua'), 42);
  engine.reveal(a, 0);
  engine.reveal(b, 0);
  assert.deepEqual(a.mines, b.mines);
  const c = engine.createGame(levelOf('vua'), 43);
  engine.reveal(c, 0);
  assert.notDeepEqual(a.mines, c.mines);
});

autoTest('số trên ô đếm đúng tổ ong ở 8 ô xung quanh, kể cả mép bàn', () => {
  const level = { id: 't', rows: 5, cols: 5, mines: 3 };
  //  B . . . .
  //  . . . . .
  //  . . B . .
  //  . . . . .
  //  . . . . B
  const game = fixedGame(level, [0, 12, 24]);
  assert.equal(game.counts[1], 1);
  assert.equal(game.counts[6], 2, 'ô (1,1) kề hai tổ ong ở góc và giữa');
  assert.equal(game.counts[18], 2);
  assert.equal(game.counts[4], 0);
  assert.equal(game.counts[20], 0);
});

autoTest('mở ô 0 thì mở lan tới viền các ô số; cờ chặn mở; mở trúng tổ ong thì thua', () => {
  const level = { id: 't', rows: 5, cols: 5, mines: 1 };
  const game = fixedGame(level, [24]);
  const result = engine.reveal(game, 0);
  assert.equal(result.event, 'won', '1 tổ ong ở góc: mở một ô 0 là mở hết vườn');
  assert.equal(game.cells[24], FLAG, 'thắng thì tự cắm cờ lên tổ ong');

  const lose = fixedGame({ id: 't', rows: 5, cols: 5, mines: 2 }, [12, 13]);
  assert.ok(engine.toggleFlag(lose, 12));
  assert.equal(engine.reveal(lose, 12).event, 'ignored', 'ô cắm cờ không mở được');
  assert.ok(engine.toggleFlag(lose, 12));
  const hit = engine.reveal(lose, 13);
  assert.equal(hit.event, 'lost');
  assert.equal(lose.status, 'lost');
  assert.equal(lose.exploded, 13);
  assert.equal(engine.reveal(lose, 0).event, 'ignored', 'thua rồi thì không mở thêm');
});

autoTest('cấp Dễ: lỡ mở trúng tổ ong thì Gấu Bông cứu một lần (tự cắm cờ, chơi tiếp), lần sau mới thua', () => {
  const game = fixedGame({ id: 'de', rows: 6, cols: 6, mines: 2, rescues: 1 }, [0, 35]);
  const first = engine.reveal(game, 0);
  assert.equal(first.event, 'rescued');
  assert.equal(game.status, 'playing');
  assert.equal(game.cells[0], FLAG);
  assert.equal(game.rescuesLeft, 0);
  assert.equal(engine.reveal(game, 35).event, 'lost');
});

autoTest('chạm vào số khi quanh đó đã cắm đủ cờ thì mở các ô còn lại; cắm cờ sai chỗ thì mở trúng tổ ong', () => {
  const level = { id: 't', rows: 5, cols: 5, mines: 1 };
  const good = fixedGame(level, [6]);
  engine.reveal(good, 0);
  assert.equal(good.cells[0], OPEN);
  assert.equal(good.counts[0], 1);
  assert.equal(engine.reveal(good, 0).event, 'ignored', 'chưa cắm cờ thì chạm số không làm gì');
  engine.toggleFlag(good, 6);
  const chord = engine.reveal(good, 0);
  assert.equal(chord.event, 'opened', 'cắm đúng cờ rồi chạm số: mở các ô còn lại quanh nó');
  assert.deepEqual(chord.opened.sort((x, y) => x - y), [1, 5]);
  assert.equal(good.cells[1], OPEN);
  assert.equal(good.cells[5], OPEN);

  const bad = fixedGame(level, [6]);
  engine.reveal(bad, 0);
  engine.toggleFlag(bad, 1);
  assert.equal(engine.reveal(bad, 0).event, 'lost', 'cờ cắm nhầm ô (0,1) nên ô có ong (1,1) bị mở');
});

autoTest('gợi ý luôn là ô an toàn, ưu tiên ô sát vùng đã mở, có giới hạn số lần', () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    const game = engine.createGame(levelOf('vua'), seed);
    assert.equal(engine.safeHint(game), 55, 'chưa bắt đầu: gợi ý ô giữa');
    engine.reveal(game, 55);
    if (game.status !== 'playing') continue;
    const hint = engine.safeHint(game);
    assert.notEqual(game.counts[hint], -1);
    assert.equal(game.cells[hint], HIDDEN);
    assert.ok(engine.neighbors(hint, 10, 10).some((other) => game.cells[other] === OPEN), 'sát vùng đã mở');
  }
  const game = engine.createGame(levelOf('kho'), 3);
  engine.reveal(game, 0);
  assert.ok(engine.useHint(game) >= 0);
  assert.equal(engine.useHint(game), -1, 'cấp Khó chỉ có 1 gợi ý');
  assert.equal(game.hintsUsed, 1);
});

autoTest('sao: tự giải được 3 sao, dùng gợi ý hoặc Gấu Bông cứu thì 2 sao, chưa thắng 0 sao', () => {
  const level = { id: 't', rows: 5, cols: 5, mines: 1, hints: 1 };
  const clean = fixedGame(level, [24]);
  engine.reveal(clean, 0);
  assert.equal(engine.starsFor(clean), 3);
  const helped = fixedGame(level, [24]);
  engine.useHint(helped);
  engine.reveal(helped, 0);
  assert.equal(engine.starsFor(helped), 2);
  assert.equal(engine.starsFor(engine.createGame(level, 1)), 0);
});

autoTest('lưu và khôi phục ván dở; dữ liệu hỏng hoặc khác cấp thì bỏ', () => {
  const level = levelOf('vua');
  const game = engine.createGame(level, 9);
  engine.reveal(game, 0);
  const firstHidden = game.cells.findIndex((value, index) => value === HIDDEN && game.counts[index] === -1);
  engine.toggleFlag(game, firstHidden);
  const saved = JSON.parse(JSON.stringify(engine.serialize(game)));
  const restored = engine.restore(saved, level);
  assert.deepEqual(restored.cells, game.cells);
  assert.deepEqual(restored.counts, game.counts);
  assert.equal(restored.opened, game.opened);
  assert.equal(restored.status, 'playing');

  assert.equal(engine.restore(saved, levelOf('kho')), null, 'khác cấp');
  assert.equal(engine.restore({ ...saved, cells: saved.cells.slice(1) }, level), null, 'thiếu ô');
  assert.equal(engine.restore({ ...saved, mines: saved.mines.slice(1) }, level), null, 'thiếu tổ ong');
  const opened = saved.cells.slice();
  opened[saved.mines[0]] = OPEN;
  assert.equal(engine.restore({ ...saved, cells: opened }, level), null, 'tổ ong không thể đã mở trong ván dở');
  assert.equal(engine.restore({ ...saved, status: 'lost' }, level), null, 'ván đã xong thì không khôi phục');
});

autoTest('chơi được bằng suy luận: bot dùng hai luật cơ bản thắng nhiều ván ở mọi cấp, cấp Dễ dễ nhất', () => {
  const results = {};
  for (const level of content.levels) {
    let wins = 0;
    let guesses = 0;
    for (let seed = 1; seed <= 80; seed += 1) {
      const run = playWithLogic(level, seed);
      if (run.status === 'won') wins += 1;
      guesses += run.guesses;
    }
    results[level.id] = { wins, guesses };
  }
  assert.ok(results.de.wins >= 60, `cấp Dễ: ${JSON.stringify(results.de)}`);
  assert.ok(results.vua.wins >= 40, `cấp Vừa: ${JSON.stringify(results.vua)}`);
  assert.ok(results.kho.wins >= 25, `cấp Khó: ${JSON.stringify(results.kho)}`);
  assert.ok(results.de.wins >= results.vua.wins && results.vua.wins >= results.kho.wins, JSON.stringify(results));
});

// Bàn bấm được, cắm cờ (chuột phải/nhấn giữ/phím F/chế độ cờ), hộp thoại thắng là modal có tên, không đếm ngược:
// e2e/game16-minesweeper.spec.js và e2e/page-structure.spec.js.
autoTest('PWA precache, route và thẻ trang chủ có Game 16', () => {
  for (const asset of [
    './game16.html',
    './js/game16-minesweeper.js',
    './js/game16-rewards.js',
    './css/game16-minesweeper.css',
    './content/games/game16.json',
    './js/game16-home-card.js'
  ]) {
    assert.ok(sw.includes(`"${asset}"`), `Service Worker cần precache ${asset}`);
  }
  assert.match(redirects, /\/game16 \/game16\.html 301/);
  assert.match(redirects, /\/game16\/ \/game16\.html 301/);
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
