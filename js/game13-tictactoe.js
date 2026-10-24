(function (root) {
  'use strict';

  /* ---------- Engine: thuần logic, chạy được cả trong Node để test ---------- */

  const EMPTY = 0;
  const PLAYER = 1;
  const BOT = 2;
  const LINES = Object.freeze([
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ].map((line) => Object.freeze(line)));

  function createRng(seed) {
    let value = (Number(seed) >>> 0) || 0x9e3779b9;
    return function next() {
      value = (value + 0x6d2b79f5) >>> 0;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function other(mark) {
    return mark === PLAYER ? BOT : PLAYER;
  }

  function isValidBoard(board) {
    return Array.isArray(board) && board.length === 9
      && board.every((value) => value === EMPTY || value === PLAYER || value === BOT);
  }

  function availableMoves(board) {
    const moves = [];
    board.forEach((value, index) => { if (value === EMPTY) moves.push(index); });
    return moves;
  }

  /** null khi ván còn tiếp; { winner: 0 } khi hòa; { winner, line } khi có người thắng. */
  function getResult(board) {
    for (const line of LINES) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return { winner: board[a], line: line.slice() };
    }
    return board.every(Boolean) ? { winner: EMPTY, line: [] } : null;
  }

  /**
   * Điểm minimax theo góc nhìn của `me`. Thắng khi còn nhiều ô trống (thắng sớm) được điểm cao hơn,
   * thua khi còn ít ô trống (thua muộn) đỡ tệ hơn. Điểm chỉ phụ thuộc thế cờ nên ghi nhớ được.
   */
  function scoreBoard(board, toMove, me, memo) {
    const result = getResult(board);
    if (result) {
      if (result.winner === EMPTY) return 0;
      const bonus = 10 + board.filter((value) => value === EMPTY).length;
      return result.winner === me ? bonus : -bonus;
    }
    const key = `${board.join('')}${toMove}${me}`;
    if (memo.has(key)) return memo.get(key);
    let best = toMove === me ? -Infinity : Infinity;
    for (const move of availableMoves(board)) {
      board[move] = toMove;
      const score = scoreBoard(board, other(toMove), me, memo);
      board[move] = EMPTY;
      best = toMove === me ? Math.max(best, score) : Math.min(best, score);
    }
    memo.set(key, best);
    return best;
  }

  /** Mọi nước đi tối ưu cho `mark` (nhiều nước bằng điểm thì trả hết để chọn ngẫu nhiên). */
  function bestMoves(board, mark) {
    if (!isValidBoard(board) || getResult(board)) return [];
    const work = board.slice();
    const memo = new Map();
    let best = -Infinity;
    let moves = [];
    for (const move of availableMoves(work)) {
      work[move] = mark;
      const score = scoreBoard(work, other(mark), mark, memo);
      work[move] = EMPTY;
      if (score > best) {
        best = score;
        moves = [move];
      } else if (score === best) {
        moves.push(move);
      }
    }
    return moves;
  }

  /** Ô giúp `mark` thắng ngay ở nước kế tiếp. */
  function winningMoves(board, mark) {
    return availableMoves(board).filter((move) => {
      const work = board.slice();
      work[move] = mark;
      return getResult(work)?.winner === mark;
    });
  }

  function pick(list, rng) {
    return list[Math.floor(rng() * list.length)];
  }

  /**
   * Chọn nước cho máy theo cấu hình cấp độ:
   *  - `blocks`: luôn ăn ngay khi thắng được và chặn ngay khi đối thủ sắp thắng;
   *  - `mistakeRate`: xác suất đi một ô ngẫu nhiên thay vì nước tối ưu.
   */
  function chooseMove(board, mark, { mistakeRate = 0, blocks = false } = {}, rng = Math.random) {
    const moves = availableMoves(board);
    if (!moves.length || getResult(board)) return -1;
    if (blocks) {
      const wins = winningMoves(board, mark);
      if (wins.length) return pick(wins, rng);
      const threats = winningMoves(board, other(mark));
      if (threats.length) return pick(threats, rng);
    }
    if (rng() < mistakeRate) return pick(moves, rng);
    return pick(bestMoves(board, mark), rng);
  }

  const engine = Object.freeze({
    EMPTY,
    PLAYER,
    BOT,
    LINES,
    createRng,
    other,
    isValidBoard,
    availableMoves,
    getResult,
    bestMoves,
    winningMoves,
    chooseMove
  });

  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (!root || !root.document) return;
  root.BongTicTacToeEngine = engine;

  /* ---------- Giao diện ---------- */

  const document = root.document;
  const CONTENT_URL = './content/games/game13.json';
  const SAVE_KEY = 'bonghome_game13_tictactoe';
  const BOT_DELAY_MS = 450;
  const MODES = Object.freeze(['bot', 'friend']);
  const FALLBACK_CONTENT = {
    schemaVersion: 1,
    defaultLevelId: 'de',
    defaultMode: 'bot',
    marks: {
      player: { symbol: '🌸', name: 'Hoa của bé' },
      bot: { symbol: '🐻', name: 'Gấu Bông' }
    },
    levels: [
      { id: 'de', label: '🌱 Dễ', description: 'Gấu Bông còn hay đi nhầm', mistakeRate: 0.6, drawStars: 2 },
      { id: 'vua', label: '🌿 Vừa', description: 'Gấu Bông biết chặn đường', mistakeRate: 0.2, blocks: true, drawStars: 2 },
      { id: 'kho', label: '🌳 Khó', description: 'Gấu Bông không bao giờ đi nhầm — hòa là giỏi lắm rồi!', mistakeRate: 0, drawStars: 3 }
    ]
  };

  const state = {
    levels: [],
    marks: FALLBACK_CONTENT.marks,
    level: null,
    mode: 'bot',
    board: new Array(9).fill(EMPTY),
    turn: PLAYER,
    starter: PLAYER,
    nextStarter: PLAYER,
    matchId: '',
    moves: 0,
    startedAt: 0,
    result: null,
    score: { player: 0, draw: 0, bot: 0 },
    focus: 4,
    rng: createRng(Date.now()),
    botTimer: 0
  };
  const els = {};
  let audioContext = null;

  function announce(message) {
    if (els.status) els.status.textContent = message;
  }

  function soundEnabled() {
    try { return root.BongSound?.isEnabled?.() !== false; }
    catch (error) { return true; }
  }

  function playTone(frequencies, duration = 0.12) {
    if (!soundEnabled()) return;
    try {
      const AudioCtor = root.AudioContext || root.webkitAudioContext;
      if (!AudioCtor) return;
      audioContext = audioContext || new AudioCtor();
      if (audioContext.state === 'suspended') audioContext.resume();
      frequencies.forEach((frequency, step) => {
        const start = audioContext.currentTime + step * duration;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain).connect(audioContext.destination);
        osc.start(start);
        osc.stop(start + duration + 0.02);
      });
    } catch (error) { /* Âm thanh chỉ là phụ, bỏ qua khi trình duyệt chặn. */ }
  }

  function vsBot() {
    return state.mode === 'bot';
  }

  function markOf(value) {
    if (value === PLAYER) return state.marks.player;
    if (value === BOT) return state.marks.bot;
    return null;
  }

  /** Tên người đi theo chế độ: chơi với máy là "Bé"/"Gấu Bông", chơi 2 người là "Bạn 🌸"/"Bạn 🐻". */
  function sideName(value) {
    if (vsBot()) return value === PLAYER ? 'Bé' : state.marks.bot.name;
    return `Bạn ${markOf(value).symbol}`;
  }

  function newMatchId() {
    return `${Date.now().toString(36)}-${Math.floor(state.rng() * 1e9).toString(36)}`;
  }

  function readSaved() {
    try {
      const parsed = JSON.parse(root.localStorage.getItem(SAVE_KEY) || 'null');
      return parsed && parsed.schemaVersion === 1 && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function isValidMatch(match) {
    if (!match || !isValidBoard(match.board) || getResult(match.board)) return false;
    if (![PLAYER, BOT].includes(match.turn) || ![PLAYER, BOT].includes(match.starter)) return false;
    if (typeof match.matchId !== 'string' || !match.matchId) return false;
    const ones = match.board.filter((value) => value === match.starter).length;
    const twos = match.board.filter((value) => value === other(match.starter)).length;
    // Người đi trước luôn có số quân bằng hoặc hơn đúng 1, và lượt phải khớp với số quân.
    if (ones - twos !== 0 && ones - twos !== 1) return false;
    return match.turn === (ones === twos ? match.starter : other(match.starter));
  }

  function validScore(score) {
    const ok = (value) => Number.isInteger(value) && value >= 0;
    return score && ok(score.player) && ok(score.draw) && ok(score.bot)
      ? { player: score.player, draw: score.draw, bot: score.bot }
      : { player: 0, draw: 0, bot: 0 };
  }

  function persist() {
    const saved = {
      schemaVersion: 1,
      levelId: state.level.id,
      mode: state.mode,
      nextStarter: state.nextStarter,
      score: state.score,
      match: state.result ? null : {
        board: state.board,
        turn: state.turn,
        starter: state.starter,
        matchId: state.matchId,
        moves: state.moves,
        startedAt: state.startedAt
      }
    };
    try { root.localStorage.setItem(SAVE_KEY, JSON.stringify(saved)); }
    catch (error) { /* Storage bị chặn: vẫn chơi được trong phiên hiện tại. */ }
  }

  function withRewards(action) {
    const ready = root.BongGame13RewardsReady;
    if (!ready || typeof ready.then !== 'function') return Promise.resolve(null);
    return ready
      .then((api) => (api ? action(api) : null))
      .catch((error) => {
        console.warn('[Bông Home] Không ghi được tiến độ/phần thưởng Game 13', error);
        return null;
      });
  }

  function normalizeContent(content) {
    const levels = Array.isArray(content?.levels) ? content.levels.filter((level) =>
      typeof level?.id === 'string'
      && typeof level.label === 'string'
      && Number.isFinite(level.mistakeRate)
      && level.mistakeRate >= 0
      && level.mistakeRate <= 1
    ) : [];
    const marks = content?.marks?.player?.symbol && content?.marks?.bot?.symbol ? content.marks : FALLBACK_CONTENT.marks;
    return levels.length ? { ...content, marks, levels } : FALLBACK_CONTENT;
  }

  function clearBotTimer() {
    if (state.botTimer) root.clearTimeout(state.botTimer);
    state.botTimer = 0;
  }

  function startMatch({ levelId, mode, starter, seed, fresh = false, saved = null } = {}) {
    clearBotTimer();
    hideWin();
    const nextLevel = state.levels.find((item) => item.id === levelId) || state.level || state.levels[0];
    const nextMode = MODES.includes(mode) ? mode : state.mode;
    const changed = Boolean(state.level) && (nextLevel.id !== state.level.id || nextMode !== state.mode);
    if (changed || fresh) abandonTracking();
    // Đổi cấp độ/chế độ thì tính tỉ số lại từ đầu.
    if (changed) state.score = { player: 0, draw: 0, bot: 0 };
    state.level = nextLevel;
    state.mode = nextMode;
    if (seed !== undefined) state.rng = createRng(seed);

    const restore = !fresh && saved && isValidMatch(saved.match) ? saved.match : null;
    if (restore) {
      state.board = restore.board.slice();
      state.turn = restore.turn;
      state.starter = restore.starter;
      state.matchId = restore.matchId;
      state.moves = Number.isInteger(restore.moves) ? restore.moves : state.board.filter(Boolean).length;
      state.startedAt = Number.isFinite(restore.startedAt) ? restore.startedAt : Date.now();
    } else {
      state.board = new Array(9).fill(EMPTY);
      state.starter = [PLAYER, BOT].includes(starter) ? starter : state.nextStarter;
      state.nextStarter = other(state.starter);
      state.turn = state.starter;
      state.matchId = newMatchId();
      state.moves = 0;
      state.startedAt = Date.now();
    }
    state.result = null;
    state.focus = 4;

    buildModes();
    buildLevels();
    render();
    persist();
    announceTurn(restore ? 'Tiếp tục ván đang chơi. ' : '');
    scheduleBot();
  }

  function announceTurn(prefix = '') {
    if (state.result) return;
    const mark = markOf(state.turn).symbol;
    if (vsBot()) {
      announce(state.turn === PLAYER
        ? `${prefix}Đến lượt bé ${mark}: chạm vào một ô trống nhé!`
        : `${prefix}${state.marks.bot.name} ${mark} đang nghĩ…`);
    } else {
      announce(`${prefix}Đến lượt ${sideName(state.turn)}.`);
    }
  }

  function buildModes() {
    const options = [
      { id: 'bot', label: `${state.marks.bot.symbol} Chơi với ${state.marks.bot.name}` },
      { id: 'friend', label: '👫 Chơi với bạn' }
    ];
    els.modes.replaceChildren(...options.map((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ttt-mode';
      button.dataset.mode = option.id;
      button.textContent = option.label;
      const active = option.id === state.mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.addEventListener('click', () => {
        if (option.id !== state.mode) startMatch({ mode: option.id, fresh: true });
      });
      return button;
    }));
  }

  function buildLevels() {
    els.levels.hidden = !vsBot();
    els.levels.replaceChildren(...state.levels.map((level) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ttt-level';
      button.dataset.level = level.id;
      button.textContent = level.label;
      button.title = level.description || '';
      const active = level.id === state.level.id;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.setAttribute('aria-label', `${level.label}: ${level.description || ''}`);
      button.addEventListener('click', () => {
        if (level.id !== state.level.id) startMatch({ levelId: level.id, fresh: true });
      });
      return button;
    }));
  }

  function buildBoard() {
    els.cells = Array.from({ length: 9 }, (_, index) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'ttt-cell';
      cell.id = `tttCell${index}`;
      cell.dataset.index = String(index);
      cell.addEventListener('click', () => play(index));
      cell.addEventListener('focus', () => { state.focus = index; syncTabStops(); });
      return cell;
    });
    els.board.replaceChildren(...els.cells);
  }

  function syncTabStops() {
    els.cells.forEach((cell, index) => { cell.tabIndex = index === state.focus ? 0 : -1; });
  }

  function render() {
    const winLine = state.result?.line || [];
    const humanTurn = !state.result && (!vsBot() || state.turn === PLAYER);
    els.board.classList.toggle('waiting', !humanTurn && !state.result);
    els.board.classList.toggle('finished', Boolean(state.result));
    els.board.setAttribute('aria-busy', !humanTurn && !state.result ? 'true' : 'false');

    els.cells.forEach((cell, index) => {
      const value = state.board[index];
      const mark = markOf(value);
      const row = Math.floor(index / 3) + 1;
      const col = (index % 3) + 1;
      cell.textContent = mark ? mark.symbol : '';
      cell.classList.toggle('filled', Boolean(value));
      cell.classList.toggle('mark-player', value === PLAYER);
      cell.classList.toggle('mark-bot', value === BOT);
      cell.classList.toggle('win', winLine.includes(index));
      cell.setAttribute('aria-disabled', value || !humanTurn ? 'true' : 'false');
      cell.setAttribute('aria-label', `Hàng ${row}, cột ${col}: ${mark ? `${mark.symbol} ${sideName(value)}` : 'trống'}`);
    });
    syncTabStops();

    const turnMark = markOf(state.turn);
    els.turn.textContent = state.result ? 'Hết ván' : `${turnMark.symbol} ${sideName(state.turn)}`;
    els.scorePlayerLabel.textContent = vsBot() ? `${state.marks.player.symbol} Bé` : `${state.marks.player.symbol} Bạn 1`;
    els.scoreBotLabel.textContent = vsBot() ? `${state.marks.bot.symbol} Gấu` : `${state.marks.bot.symbol} Bạn 2`;
    els.scorePlayer.textContent = String(state.score.player);
    els.scoreDraw.textContent = String(state.score.draw);
    els.scoreBot.textContent = String(state.score.bot);
  }

  function play(index) {
    if (!Number.isInteger(index) || index < 0 || index > 8) return false;
    if (state.result || state.board[index] !== EMPTY) {
      if (!state.result) playTone([220], 0.08);
      return false;
    }
    if (vsBot() && state.turn !== PLAYER) return false;
    place(index);
    return true;
  }

  function place(index) {
    const mark = state.turn;
    state.board[index] = mark;
    state.moves += 1;
    playTone(mark === PLAYER ? [660] : [440], 0.09);

    const result = getResult(state.board);
    if (result) {
      finish(result);
      return;
    }
    state.turn = other(mark);
    render();
    persist();
    if (vsBot() && mark === PLAYER && state.moves <= 2) {
      withRewards((api) => api.trackProgress({ levelId: state.level.id, moves: state.moves }));
    }
    announceTurn();
    scheduleBot();
  }

  function scheduleBot() {
    clearBotTimer();
    if (!vsBot() || state.result || state.turn !== BOT) return;
    state.botTimer = root.setTimeout(botMove, BOT_DELAY_MS);
  }

  function botMove() {
    state.botTimer = 0;
    if (!vsBot() || state.result || state.turn !== BOT) return;
    const move = chooseMove(state.board, BOT, state.level, state.rng);
    if (move >= 0) place(move);
  }

  function starsFor(winner) {
    if (winner === PLAYER) return 3;
    if (winner === EMPTY) return Math.min(3, Math.max(1, Number(state.level.drawStars) || 1));
    return 0;
  }

  function finish(result) {
    clearBotTimer();
    state.result = result;
    if (result.winner === PLAYER) state.score.player += 1;
    else if (result.winner === BOT) state.score.bot += 1;
    else state.score.draw += 1;
    render();
    persist();
    showWin(result);
  }

  function showWin(result) {
    const { winner } = result;
    let title;
    let text;
    let stars = 0;
    if (!vsBot()) {
      title = winner ? `${sideName(winner)} thắng!` : 'Hòa nhau rồi!';
      text = winner ? 'Ba hình thẳng hàng rồi! Đổi lượt đi trước và chơi tiếp nhé.' : 'Không ai xếp được ba hình thẳng hàng. Chơi ván nữa nào!';
    } else if (winner === PLAYER) {
      stars = starsFor(winner);
      title = 'Bé thắng rồi!';
      text = `Bé xếp được ba ${state.marks.player.symbol} thẳng hàng ở cấp ${state.level.label}.`;
    } else if (winner === EMPTY) {
      stars = starsFor(winner);
      title = 'Hòa nhau rồi!';
      text = state.level.id === 'kho'
        ? `Bé chặn được ${state.marks.bot.name} cấp Khó — giỏi lắm!`
        : `Bé và ${state.marks.bot.name} ngang tài ngang sức.`;
    } else {
      title = `${state.marks.bot.name} thắng ván này`;
      text = 'Không sao đâu! Nhìn kỹ hàng ngang, hàng dọc và đường chéo rồi thử lại nhé.';
    }

    els.winStars.textContent = stars ? '⭐'.repeat(stars) + '☆'.repeat(3 - stars) : (vsBot() ? '🤗' : '🎉');
    els.winTitle.textContent = title;
    els.winText.textContent = text;
    els.win.hidden = false;
    announce(`${title} ${text}`);
    playTone(winner === BOT && vsBot() ? [392, 330] : [523, 659, 784, 1047], 0.14);
    root.setTimeout(() => els.winNext.focus(), 30);
    awardCompletion(winner, stars);
  }

  function awardCompletion(winner, stars) {
    if (els.winRewards) {
      els.winRewards.replaceChildren();
      els.winRewards.hidden = true;
    }
    if (!vsBot()) return Promise.resolve(null);
    if (winner === BOT) return withRewards((api) => api.abandon());

    const levelId = state.level.id;
    const matchId = state.matchId;
    const result = {
      levelId,
      matchId,
      outcome: winner === PLAYER ? 'win' : 'draw',
      stars,
      moves: state.moves,
      durationSeconds: state.startedAt ? Math.max(0, Math.round((Date.now() - state.startedAt) / 1000)) : null
    };
    return withRewards((api) => {
      const detail = api.complete(result);
      if (!detail || detail.duplicate || !els.winRewards || state.matchId !== matchId) return detail;
      els.winRewards.replaceChildren(...api.rewardLines(detail).map((text, index) => {
        const line = document.createElement('p');
        line.className = index === 0 ? 'ttt-reward-stars' : 'ttt-reward-unlock';
        line.textContent = text;
        return line;
      }));
      els.winRewards.hidden = false;
      return detail;
    });
  }

  /** Bỏ ván dở với máy: xóa đánh dấu "đang chơi dở" trong Góc phụ huynh. */
  function abandonTracking() {
    if (vsBot() && state.moves > 0 && !state.result) withRewards((api) => api.abandon());
  }

  function hideWin() {
    if (els.win) els.win.hidden = true;
  }

  function focusCell(index) {
    state.focus = index;
    syncTabStops();
    els.cells[index].focus({ preventScroll: true });
  }

  function onBoardKeyDown(event) {
    if (!els.win.hidden) return;
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[event.key]) {
      event.preventDefault();
      const [dRow, dCol] = arrows[event.key];
      const row = (Math.floor(state.focus / 3) + dRow + 3) % 3;
      const col = (state.focus % 3 + dCol + 3) % 3;
      focusCell(row * 3 + col);
      return;
    }
    const digit = Number(event.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= 9) {
      event.preventDefault();
      focusCell(digit - 1);
      play(digit - 1);
    }
  }

  function init(content) {
    const normalized = normalizeContent(content);
    state.levels = normalized.levels;
    state.marks = normalized.marks;
    const saved = readSaved();
    state.score = validScore(saved?.score);
    state.nextStarter = [PLAYER, BOT].includes(saved?.nextStarter) ? saved.nextStarter : PLAYER;
    const levelId = state.levels.some((level) => level.id === saved?.levelId) ? saved.levelId : normalized.defaultLevelId;
    const mode = MODES.includes(saved?.mode) ? saved.mode : (MODES.includes(normalized.defaultMode) ? normalized.defaultMode : 'bot');
    state.level = state.levels.find((level) => level.id === levelId) || state.levels[0];
    state.mode = mode;
    buildBoard();
    startMatch({ levelId, mode, saved });

    root.BongGame13 = Object.freeze({
      getState: () => ({
        levelId: state.level.id,
        mode: state.mode,
        board: state.board.slice(),
        turn: state.turn,
        starter: state.starter,
        matchId: state.matchId,
        moves: state.moves,
        result: state.result ? { winner: state.result.winner, line: state.result.line.slice() } : null,
        score: { ...state.score }
      }),
      newGame: (options = {}) => startMatch({ ...options, fresh: true }),
      play,
      botMoveNow: () => { clearBotTimer(); botMove(); }
    });
  }

  function boot() {
    Object.assign(els, {
      board: document.getElementById('tttBoard'),
      modes: document.getElementById('tttModes'),
      levels: document.getElementById('tttLevels'),
      turn: document.getElementById('tttTurn'),
      scorePlayer: document.getElementById('tttScorePlayer'),
      scoreDraw: document.getElementById('tttScoreDraw'),
      scoreBot: document.getElementById('tttScoreBot'),
      scorePlayerLabel: document.getElementById('tttScorePlayerLabel'),
      scoreBotLabel: document.getElementById('tttScoreBotLabel'),
      status: document.getElementById('tttStatus'),
      win: document.getElementById('tttWin'),
      winStars: document.getElementById('tttWinStars'),
      winTitle: document.getElementById('tttWinTitle'),
      winText: document.getElementById('tttWinText'),
      winRewards: document.getElementById('tttWinRewards'),
      winNext: document.getElementById('tttWinNext')
    });
    if (!els.board) return;

    els.board.addEventListener('keydown', onBoardKeyDown);
    document.getElementById('tttNew').addEventListener('click', () => startMatch({ fresh: true }));
    els.winNext.addEventListener('click', () => {
      startMatch({ fresh: true });
      focusCell(4);
    });
    els.win.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        hideWin();
        focusCell(state.focus);
      }
    });

    fetch(CONTENT_URL, { cache: 'no-cache' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .catch((error) => {
        console.warn('[Bông Home] Dùng nội dung dự phòng cho Game 13', error);
        return FALLBACK_CONTENT;
      })
      .then(init);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof window !== 'undefined' ? window : null);
