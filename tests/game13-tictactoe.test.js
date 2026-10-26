const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const engine = require('../js/game13-tictactoe.js');
const content = JSON.parse(read('content/games/game13.json'));
const html = read('game13.html');
const style = read('css/game13-tictactoe.css');
const sw = read('sw.js');
const redirects = read('_redirects');

const { EMPTY, PLAYER, BOT } = engine;

autoTest('nội dung Game 13 có 3 cấp độ hợp lệ và 2 hình khác nhau, tách khỏi logic', () => {
  assert.equal(content.schemaVersion, 1);
  assert.deepEqual(content.levels.map((level) => level.id), ['de', 'vua', 'kho']);
  assert.ok(content.levels.some((level) => level.id === content.defaultLevelId));
  assert.ok(['bot', 'friend'].includes(content.defaultMode));
  assert.notEqual(content.marks.player.symbol, content.marks.bot.symbol);
  const rates = content.levels.map((level) => level.mistakeRate);
  assert.ok(rates.every((rate) => rate >= 0 && rate <= 1));
  assert.deepEqual([...rates].sort((a, b) => b - a), rates, 'cấp càng khó máy càng ít đi nhầm');
  assert.equal(content.levels.find((level) => level.id === 'kho').mistakeRate, 0, 'cấp Khó phải chơi hoàn hảo');
  assert.ok(content.levels.every((level) => Number.isInteger(level.drawStars) && level.drawStars >= 1 && level.drawStars <= 3));
});

autoTest('getResult nhận đủ 8 đường thắng, hòa và ván chưa xong', () => {
  assert.equal(engine.LINES.length, 8);
  for (const line of engine.LINES) {
    const board = new Array(9).fill(EMPTY);
    line.forEach((index) => { board[index] = BOT; });
    assert.deepEqual(engine.getResult(board), { winner: BOT, line: [...line] });
  }
  assert.equal(engine.getResult(new Array(9).fill(EMPTY)), null);
  const draw = [1, 2, 1, 1, 2, 2, 2, 1, 1];
  assert.deepEqual(engine.getResult(draw), { winner: EMPTY, line: [] });
  assert.equal(engine.isValidBoard([1, 2, 3, 0, 0, 0, 0, 0, 0]), false);
});

autoTest('máy luôn ăn ngay khi thắng được và chặn khi bé sắp thắng', () => {
  //  🌸 🌸 .
  //  🐻 🐻 .
  //  .  .  .
  const board = [PLAYER, PLAYER, EMPTY, BOT, BOT, EMPTY, EMPTY, EMPTY, EMPTY];
  assert.deepEqual(engine.bestMoves(board, BOT), [5], 'ưu tiên thắng hơn chặn');
  assert.deepEqual(engine.bestMoves(board, PLAYER), [2]);

  const block = [PLAYER, PLAYER, EMPTY, BOT, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY];
  assert.deepEqual(engine.bestMoves(block, BOT), [2]);
  const rng = engine.createRng(5);
  for (let round = 0; round < 50; round += 1) {
    assert.equal(engine.chooseMove(block, BOT, { mistakeRate: 1, blocks: true }, rng), 2, 'cấp Vừa vẫn luôn chặn');
  }
});

autoTest('cấp Khó (minimax) không bao giờ thua dù bé đi bất kỳ cách nào, đi trước hay đi sau', () => {
  const kho = content.levels.find((level) => level.id === 'kho');
  let finished = 0;
  function explore(board, turn) {
    const result = engine.getResult(board);
    if (result) {
      assert.notEqual(result.winner, PLAYER, `bé không được thắng cấp Khó: ${board.join('')}`);
      finished += 1;
      return;
    }
    if (turn === BOT) {
      // Thử mọi nước tối ưu để chắc chắn mọi nhánh ngẫu nhiên đều an toàn.
      for (const move of engine.bestMoves(board, BOT)) {
        board[move] = BOT;
        explore(board, PLAYER);
        board[move] = EMPTY;
      }
      assert.ok(engine.bestMoves(board, BOT).includes(engine.chooseMove(board, BOT, kho, engine.createRng(1))));
      return;
    }
    for (const move of engine.availableMoves(board)) {
      board[move] = PLAYER;
      explore(board, BOT);
      board[move] = EMPTY;
    }
  }
  explore(new Array(9).fill(EMPTY), PLAYER);
  explore(new Array(9).fill(EMPTY), BOT);
  assert.ok(finished > 100, 'đã duyệt hết cây ván cờ');
});

autoTest('hai bên chơi hoàn hảo luôn hòa; cấp Dễ có thể bị bé thắng', () => {
  const board = new Array(9).fill(EMPTY);
  let turn = PLAYER;
  const rng = engine.createRng(2026);
  while (!engine.getResult(board)) {
    board[engine.chooseMove(board, turn, { mistakeRate: 0 }, rng)] = turn;
    turn = engine.other(turn);
  }
  assert.equal(engine.getResult(board).winner, EMPTY);

  const de = content.levels.find((level) => level.id === 'de');
  let playerWins = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    const match = new Array(9).fill(EMPTY);
    const botRng = engine.createRng(seed);
    let next = PLAYER;
    while (!engine.getResult(match)) {
      const move = next === PLAYER
        ? engine.bestMoves(match, PLAYER)[0]
        : engine.chooseMove(match, BOT, de, botRng);
      match[move] = next;
      next = engine.other(next);
    }
    const { winner } = engine.getResult(match);
    assert.notEqual(winner, BOT, 'bé chơi hoàn hảo thì không thua');
    if (winner === PLAYER) playerWins += 1;
  }
  assert.ok(playerWins > 0, 'cấp Dễ phải để bé có cơ hội thắng');
});

autoTest('chooseMove tất định theo seed và chỉ trả ô trống', () => {
  const board = [PLAYER, EMPTY, EMPTY, EMPTY, BOT, EMPTY, EMPTY, EMPTY, EMPTY];
  const pickWith = (seed) => engine.chooseMove(board, BOT, { mistakeRate: 0.6 }, engine.createRng(seed));
  assert.equal(pickWith(9), pickWith(9));
  for (let seed = 1; seed < 30; seed += 1) assert.equal(board[pickWith(seed)], EMPTY);
  assert.equal(engine.chooseMove([1, 2, 1, 1, 2, 2, 2, 1, 1], BOT), -1);
});

autoTest('Game 13 có bàn 3×3 bấm được bằng nút, chế độ chơi, tỉ số và không gây áp lực thời gian', () => {
  assert.match(html, /css\/design-tokens\.css/);
  assert.match(html, /css\/game13-tictactoe\.css/);
  assert.match(html, /js\/game13-tictactoe\.js/);
  assert.match(html, /js\/game13-rewards\.js/);
  assert.match(html, /shared-ui\.js/);
  for (const id of ['tttBoard', 'tttModes', 'tttLevels', 'tttNew', 'tttStatus', 'tttTurn', 'tttScorePlayer', 'tttScoreDraw', 'tttScoreBot', 'tttWin', 'tttWinRewards', 'tttWinNext']) {
    assert.match(html, new RegExp(`id="${id}"`), `thiếu #${id}`);
  }
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="dialog"[^>]*aria-modal="true"/);
  assert.match(html, /Không có đồng hồ đếm ngược/);
  assert.match(style, /--bh-touch-target/);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(style, /\.ttt-levels\[hidden\]\s*\{\s*display:\s*none;/);
});

autoTest('PWA precache, route và thẻ trang chủ có Game 13', () => {
  for (const asset of [
    './game13.html',
    './js/game13-tictactoe.js',
    './js/game13-rewards.js',
    './css/game13-tictactoe.css',
    './content/games/game13.json',
    './js/game13-home-card.js'
  ]) {
    assert.ok(sw.includes(`"${asset}"`), `Service Worker cần precache ${asset}`);
  }
  assert.match(redirects, /\/game13 \/game13\.html 301/);
  assert.match(redirects, /\/game13\/ \/game13\.html 301/);
  // Thẻ trang chủ nằm sau Game 12 và ghi 13 lớp học: e2e/game13-tictactoe.spec.js.
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
