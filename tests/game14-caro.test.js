const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const engine = require('../js/game14-caro.js');
const content = JSON.parse(read('content/games/game14.json'));
const sw = read('sw.js');
const redirects = read('_redirects');

const { EMPTY, PLAYER, BOT } = engine;
const rules = engine.normalizeRules(content.board);
const { size } = rules;
const at = (row, col) => row * size + col;
const levelOf = (id) => content.levels.find((level) => level.id === id);

/** Bàn mới đặt sẵn các quân: [[row, col, mark], ...]. */
function boardWith(stones) {
  const board = engine.createBoard(rules);
  for (const [row, col, mark] of stones) board[at(row, col)] = mark;
  return board;
}

/** Đấu một ván giữa hai cấu hình; trả về người thắng (0 khi hòa). */
function playMatch(playerLevel, botLevel, seed, starter = PLAYER) {
  const board = engine.createBoard(rules);
  const rngs = { [PLAYER]: engine.createRng(seed), [BOT]: engine.createRng(seed * 7 + 1) };
  let turn = starter;
  while (!engine.getResult(board, rules)) {
    const move = engine.chooseMove(board, rules, turn, turn === PLAYER ? playerLevel : botLevel, rngs[turn]);
    assert.equal(board[move], EMPTY, 'chỉ đi vào ô trống');
    board[move] = turn;
    turn = engine.other(turn);
  }
  return engine.getResult(board, rules).winner;
}

autoTest('nội dung Game 14: bàn 10×10 nối 5, 3 cấp độ hợp lệ, 2 hình khác nhau, tách khỏi logic', () => {
  assert.equal(content.schemaVersion, 1);
  assert.deepEqual(content.board, { size: 10, winLength: 5 });
  assert.deepEqual(rules, { size: 10, winLength: 5 });
  assert.deepEqual(content.levels.map((level) => level.id), ['de', 'vua', 'kho']);
  assert.ok(content.levels.some((level) => level.id === content.defaultLevelId));
  assert.ok(['bot', 'friend'].includes(content.defaultMode));
  assert.notEqual(content.marks.player.symbol, content.marks.bot.symbol);
  const rates = content.levels.map((level) => level.mistakeRate);
  assert.ok(rates.every((rate) => rate >= 0 && rate <= 1));
  assert.deepEqual([...rates].sort((a, b) => b - a), rates, 'cấp càng khó máy càng ít đi nhầm');
  const defenses = content.levels.map((level) => level.defense);
  assert.deepEqual([...defenses].sort((a, b) => a - b), defenses, 'cấp càng khó máy càng chịu phòng thủ');
  assert.equal(levelOf('kho').mistakeRate, 0);
  assert.ok(levelOf('vua').blocks && levelOf('kho').blocks);
  assert.ok(content.levels.every((level) => Number.isInteger(level.drawStars) && level.drawStars >= 1 && level.drawStars <= 3));
});

autoTest('normalizeRules chặn luật vô lý về mặc định an toàn', () => {
  assert.deepEqual(engine.normalizeRules({ size: 99, winLength: 5 }), { size: 10, winLength: 5 });
  assert.deepEqual(engine.normalizeRules({ size: 7, winLength: 9 }), { size: 7, winLength: 5 });
  assert.deepEqual(engine.normalizeRules({ size: 8, winLength: 4 }), { size: 8, winLength: 4 });
  assert.deepEqual(engine.normalizeRules(null), { size: 10, winLength: 5 });
});

autoTest('getResult nhận 5 hình theo hàng ngang, dọc, chéo xuôi, chéo ngược; 4 hình chưa thắng', () => {
  const lines = {
    ngang: [[3, 2], [3, 3], [3, 4], [3, 5], [3, 6]],
    doc: [[1, 8], [2, 8], [3, 8], [4, 8], [5, 8]],
    cheoXuoi: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]],
    cheoNguoc: [[2, 9], [3, 8], [4, 7], [5, 6], [6, 5]]
  };
  for (const [name, cells] of Object.entries(lines)) {
    const four = boardWith(cells.slice(0, 4).map(([r, c]) => [r, c, BOT]));
    assert.equal(engine.getResult(four, rules), null, `${name}: 4 hình chưa thắng`);
    const five = boardWith(cells.map(([r, c]) => [r, c, BOT]));
    assert.deepEqual(engine.getResult(five, rules), { winner: BOT, line: cells.map(([r, c]) => at(r, c)).sort((a, b) => a - b) }, name);
  }
  // Sáu hình liền cũng tính thắng (luật dễ cho bé, không cấm "quá 5").
  const six = boardWith([0, 1, 2, 3, 4, 5].map((c) => [9, c, PLAYER]));
  assert.equal(engine.getResult(six, rules).winner, PLAYER);
  assert.equal(engine.getResult(six, rules).line.length, 6);
});

autoTest('đường thắng không "quấn" qua mép bàn sang hàng kế tiếp', () => {
  // Hàng 0 cột 7–9 + hàng 1 cột 0–1 nằm liền nhau trong mảng nhưng không thẳng hàng trên bàn.
  const wrap = boardWith([[0, 7, PLAYER], [0, 8, PLAYER], [0, 9, PLAYER], [1, 0, PLAYER], [1, 1, PLAYER]]);
  assert.equal(engine.getResult(wrap, rules), null);
  const wrapDiagonal = boardWith([[0, 8, BOT], [1, 9, BOT], [2, 0, BOT], [3, 1, BOT], [4, 2, BOT]]);
  assert.equal(engine.getResult(wrapDiagonal, rules), null);
});

autoTest('kín bàn mà không ai đủ 5 hình là hòa; isValidBoard từ chối dữ liệu hỏng', () => {
  // Mẫu sọc 2 cột đổi màu mỗi hàng: không có 5 hình liền nhau theo hướng nào.
  const full = Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size);
    const col = index % size;
    return (Math.floor(col / 2) + row) % 2 ? PLAYER : BOT;
  });
  assert.deepEqual(engine.getResult(full, rules), { winner: EMPTY, line: [] });
  assert.equal(engine.isValidBoard(full, rules), true);
  assert.equal(engine.isValidBoard(full.slice(1), rules), false);
  assert.equal(engine.isValidBoard([...full.slice(1), 3], rules), false);
});

autoTest('máy đi nước đầu ở giữa bàn và chỉ xét ô gần quân đã có', () => {
  const empty = engine.createBoard(rules);
  assert.deepEqual(engine.candidateMoves(empty, rules), [at(5, 4)]);
  for (const level of content.levels) assert.equal(engine.chooseMove(empty, rules, BOT, level, engine.createRng(1)), at(5, 4));
  const one = boardWith([[0, 0, PLAYER]]);
  assert.deepEqual(engine.candidateMoves(one, rules, 1), [at(0, 1), at(1, 0), at(1, 1)]);
});

autoTest('mọi cấp đều ăn ngay khi có 4 hình; cấp Vừa/Khó luôn chặn khi bé có 4 hình', () => {
  //  Gấu có 4 ⭕ ở hàng 2 (cột 1–4), bé có 4 ❌ ở hàng 6 (cột 3–6). Gấu đến lượt: phải thắng ngay.
  const both = boardWith([
    [2, 1, BOT], [2, 2, BOT], [2, 3, BOT], [2, 4, BOT], [7, 9, BOT],
    [6, 3, PLAYER], [6, 4, PLAYER], [6, 5, PLAYER], [6, 6, PLAYER]
  ]);
  const winCells = [at(2, 0), at(2, 5)];
  for (const level of content.levels) {
    for (let seed = 1; seed <= 20; seed += 1) {
      assert.ok(winCells.includes(engine.chooseMove(both, rules, BOT, level, engine.createRng(seed))), `${level.id} phải ăn ngay`);
    }
  }

  const block = boardWith([[6, 3, PLAYER], [6, 4, PLAYER], [6, 5, PLAYER], [6, 6, PLAYER], [6, 2, BOT], [0, 0, BOT], [9, 9, BOT]]);
  for (const id of ['vua', 'kho']) {
    for (let seed = 1; seed <= 30; seed += 1) {
      assert.equal(engine.chooseMove(block, rules, BOT, levelOf(id), engine.createRng(seed)), at(6, 7), `${id} phải chặn`);
    }
  }
  assert.deepEqual(engine.winningMoves(block, rules, PLAYER), [at(6, 7)]);
});

autoTest('cấp Khó chặn "ba mở hai đầu" của bé trước khi thành bốn không chặn được', () => {
  //  . ❌ ❌ ❌ .  (hàng 4, cột 3–5), Gấu có 2 quân rời rạc.
  const board = boardWith([[4, 3, PLAYER], [4, 4, PLAYER], [4, 5, PLAYER], [0, 9, BOT], [9, 0, BOT]]);
  const ends = [at(4, 2), at(4, 6), at(4, 1), at(4, 7)];
  for (let seed = 1; seed <= 20; seed += 1) {
    assert.ok(ends.includes(engine.chooseMove(board, rules, BOT, levelOf('kho'), engine.createRng(seed))));
  }
});

autoTest('độ khó tăng dần: bé chơi ẩu vẫn thắng được cấp Dễ, cấp Khó thắng hoặc cầm hòa người chơi giỏi', () => {
  const careless = { mistakeRate: 0.45, blocks: false, defense: 0.6 };
  const strong = { mistakeRate: 0, blocks: true, defense: 0.95 };
  const tally = (playerLevel, botId) => {
    const count = { [EMPTY]: 0, [PLAYER]: 0, [BOT]: 0 };
    for (let seed = 1; seed <= 20; seed += 1) count[playMatch(playerLevel, levelOf(botId), seed, seed % 2 ? PLAYER : BOT)] += 1;
    return count;
  };
  const deVsCareless = tally(careless, 'de');
  const khoVsCareless = tally(careless, 'kho');
  const khoVsStrong = tally(strong, 'kho');
  assert.ok(deVsCareless[PLAYER] >= 8, `cấp Dễ phải để bé thắng nhiều: ${JSON.stringify(deVsCareless)}`);
  assert.ok(khoVsCareless[BOT] >= 18, `cấp Khó phải thắng người chơi ẩu: ${JSON.stringify(khoVsCareless)}`);
  assert.equal(khoVsStrong[PLAYER], 0, `cấp Khó không thua người chơi theo heuristic: ${JSON.stringify(khoVsStrong)}`);
  assert.ok(deVsCareless[PLAYER] > khoVsCareless[PLAYER]);
});

autoTest('chooseMove tất định theo seed, chỉ trả ô trống và đủ nhanh cho máy yếu', () => {
  const board = boardWith([[4, 4, PLAYER], [5, 5, BOT], [4, 5, PLAYER], [3, 6, BOT]]);
  const pickWith = (seed) => engine.chooseMove(board, rules, BOT, levelOf('de'), engine.createRng(seed));
  assert.equal(pickWith(9), pickWith(9));
  for (let seed = 1; seed < 30; seed += 1) assert.equal(board[pickWith(seed)], EMPTY);
  const finished = boardWith([0, 1, 2, 3, 4].map((c) => [0, c, PLAYER]));
  assert.equal(engine.chooseMove(finished, rules, BOT), -1);
  assert.deepEqual(engine.bestMoves(finished, rules, BOT), []);

  const started = Date.now();
  playMatch({ mistakeRate: 0, blocks: true, defense: 0.95 }, levelOf('kho'), 3);
  assert.ok(Date.now() - started < 2000, 'một ván 10×10 giữa hai máy cấp Khó phải xong dưới 2 giây');
});

// Bàn cờ bấm được bằng nút, chế độ chơi, tỉ số, gợi ý, hộp thoại thắng là modal có tên, không đếm ngược:
// e2e/page-structure.spec.js và e2e/game14-caro.spec.js. Giảm chuyển động, focus ring, vùng chạm:
// e2e/reduced-motion-all-pages.spec.js, e2e/focus-visible.spec.js, e2e/touch-targets.spec.js.
autoTest('PWA precache, route và thẻ trang chủ có Game 14', () => {
  for (const asset of [
    './game14.html',
    './js/game14-caro.js',
    './js/game14-rewards.js',
    './css/game14-caro.css',
    './content/games/game14.json',
    './js/game14-home-card.js'
  ]) {
    assert.ok(sw.includes(`"${asset}"`), `Service Worker cần precache ${asset}`);
  }
  assert.match(redirects, /\/game14 \/game14\.html 301/);
  assert.match(redirects, /\/game14\/ \/game14\.html 301/);
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
